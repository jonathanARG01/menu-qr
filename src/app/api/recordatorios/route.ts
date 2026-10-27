import webpush from "web-push";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEXTOS, type Idioma } from "@/lib/i18n";
import { leerAjustes, type Ajustes } from "@/lib/salon";
import { formatoHora, paisDe } from "@/lib/region";
import { procesarPruebas } from "@/lib/avisosPrueba";

export const runtime = "nodejs";

const limpiar = (v: string | undefined) => (v ?? "").replace(/[^A-Za-z0-9_\-:@.]/g, "");
const PUBLICA = limpiar(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
const PRIVADA = limpiar(process.env.VAPID_PRIVATE_KEY);
const CONTACTO = process.env.VAPID_CONTACTO?.trim() || "mailto:avisos@menus-qr.app";

type Fila = {
  id: string;
  restaurante_id: string;
  personas: number;
  fecha: string;
  restaurantes: { nombre: string; slug: string; logo_url: string | null; ajustes: Partial<Ajustes> | null } | null;
};
type Suscripcion = { id: string; reserva_id: string; endpoint: string; claves: { p256dh: string; auth: string }; idioma: string };

// Manda el recordatorio al celular de cada reserva que ya está dentro de las horas elegidas (y que el cliente aceptó
// avisos). Cada reserva se recuerda una sola vez. "ventana" extiende las horas (el envío diario de la mañana).
async function recordar(db: SupabaseClient, restauranteId: string | null, ventana = 0) {
  const ahora = Date.now();
  let consulta = db
    .from("reservas")
    .select("id, restaurante_id, personas, fecha, restaurantes(nombre, slug, logo_url, ajustes)")
    .eq("tipo", "reserva")
    .in("estado", ["pendiente", "confirmada"])
    .is("recordatorio_at", null)
    .gt("fecha", new Date(ahora).toISOString())
    .lte("fecha", new Date(ahora + Math.max(ventana, 24) * 3600000).toISOString())
    .limit(300);
  if (restauranteId) consulta = consulta.eq("restaurante_id", restauranteId);
  const { data, error } = await consulta;
  if (error) return { enviados: 0, error: error.message };

  const vencen = ((data ?? []) as unknown as Fila[]).filter((r) => {
    const a = leerAjustes(r.restaurantes?.ajustes);
    if (!a.modulos.reservas || !a.reservas.recordatorio) return false;
    return Date.parse(r.fecha) - Math.max(a.reservas.horas_antes, ventana) * 3600000 <= ahora;
  });
  if (!vencen.length) return { enviados: 0 };

  const { data: subs } = await db
    .from("suscripciones_push")
    .select("id, reserva_id, endpoint, claves, idioma")
    .in(
      "reserva_id",
      vencen.map((r) => r.id),
    );
  if (!subs?.length) return { enviados: 0 };

  webpush.setVapidDetails(CONTACTO, PUBLICA, PRIVADA);
  const recordadas = new Set<string>();
  const vencidas: string[] = [];
  await Promise.all(
    (subs as Suscripcion[]).map(async (s) => {
      const r = vencen.find((x) => x.id === s.reserva_id);
      if (!r?.restaurantes) return;
      const a = leerAjustes(r.restaurantes.ajustes);
      const textos = TEXTOS[(s.idioma as Idioma) in TEXTOS ? (s.idioma as Idioma) : "es"];
      const hora = formatoHora(r.fecha, { locale: paisDe(a.pais).locale, zona: a.zona_horaria });
      const carga = JSON.stringify({
        titulo: `${textos.recordatorioTitulo} · ${r.restaurantes.nombre}`,
        cuerpo: textos.recordatorioCuerpo.replace("{personas}", String(r.personas)).replace("{hora}", hora),
        url: `/${r.restaurantes.slug}/reserva/${r.id}`,
        icono: r.restaurantes.logo_url ?? undefined,
        etiqueta: `reserva-${r.id}`,
        restaurante: r.restaurantes.nombre,
      });
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.claves }, carga, { TTL: 3600 });
        recordadas.add(r.id);
      } catch (e) {
        const codigo = (e as { statusCode?: number }).statusCode;
        if (codigo === 404 || codigo === 410) vencidas.push(s.id);
      }
    }),
  );
  if (vencidas.length) await db.from("suscripciones_push").delete().in("id", vencidas);
  if (recordadas.size) {
    await db
      .from("reservas")
      .update({ recordatorio_at: new Date().toISOString(), recordatorio_medio: "push" })
      .in("id", [...recordadas]);
  }
  return { enviados: recordadas.size };
}

// El panel abierto (Reservas o Salón) llama cada pocos minutos: con la sesión del equipo solo ve su restaurante.
export async function POST(request: Request) {
  if (!PUBLICA || !PRIVADA) return NextResponse.json({ enviados: 0, motivo: "sin claves VAPID" }, { status: 501 });
  const { restaurante } = (await request.json().catch(() => ({}))) as { restaurante?: string };
  if (!restaurante || !/^[0-9a-f-]{36}$/i.test(restaurante)) return NextResponse.json({ error: "restaurante" }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sesión" }, { status: 401 });
  return NextResponse.json(await recordar(supabase, restaurante));
}

// Envío diario (Vercel Cron, ver vercel.json): recuerda las reservas del día aunque nadie tenga el panel abierto, y
// procesa las pruebas de 14 días (avisos y pausa al vencer, ver lib/avisosPrueba.ts).
// Requiere CRON_SECRET y SUPABASE_SERVICE_ROLE_KEY en Vercel; los avisos al celular, además, las claves VAPID.
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 501 });
  const sitio = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  const pruebas = await procesarPruebas(admin, sitio);
  const reservas = PUBLICA && PRIVADA ? await recordar(admin, null, 14) : { enviados: 0, motivo: "sin claves VAPID" };
  return NextResponse.json({ reservas, pruebas });
}
