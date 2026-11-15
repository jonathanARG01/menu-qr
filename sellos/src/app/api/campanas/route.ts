import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarCliente } from "@/lib/avisos";
import { leerTarjeta, sitioDe } from "@/lib/servidor";
import { unidad } from "@/lib/tipos";

export const runtime = "nodejs";
export const maxDuration = 60;

type Campana = { codigo: string; tipo: "cumpleanos" | "extranamos"; regalo: number };

// "Para que vuelvan", una vez al día (cron de Vercel): saludo de cumpleaños y "te extrañamos", con sus sellos de
// regalo. La base marca cada tarjeta para no repetir y suma los regalos; aquí solo se avisa al cliente.
// Requiere CRON_SECRET y SUPABASE_SERVICE_ROLE_KEY en Vercel.
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });

  const { data, error } = await admin.rpc("campanas_del_dia");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sitio = sitioDe(request);
  let enviados = 0;
  for (const c of (data ?? []) as Campana[]) {
    const t = await leerTarjeta(c.codigo);
    if (!t?.programa) continue;
    const nombre = t.nombre.split(" ")[0];
    const p = t.programa;
    const regalo = `${c.regalo.toLocaleString("es-CL")} ${unidad(p, c.regalo)}`;
    const cupon = (t.cupones ?? [])[0];
    const estado =
      p.tipo === "puntos"
        ? `Ya tienes ${t.puntos.toLocaleString("es-CL")} ${p.nombre_puntos} para canjear.`
        : `Te ${p.meta - t.sellos === 1 ? "falta 1 sello" : `faltan ${p.meta - t.sellos} sellos`} para ${p.premio}.`;
    const mensaje =
      c.tipo === "cumpleanos"
        ? {
            titulo: `¡Feliz cumpleaños, ${nombre}! 🎂`,
            cuerpo:
              c.regalo > 0
                ? `${t.negocio.nombre} te regala ${regalo} en tu tarjeta${cupon ? ` y el cupón “${cupon.titulo}”` : ""}. ¡Te esperamos para celebrar!`
                : `Todo el equipo de ${t.negocio.nombre} te desea un gran día. ¡Te esperamos para celebrar!`,
          }
        : {
            titulo: `${nombre}, te extrañamos en ${t.negocio.nombre}`,
            cuerpo:
              c.regalo > 0
                ? `Te dejamos ${regalo} de regalo en tu tarjeta. ${estado}`
                : `${estado} ¡Vuelve pronto!`,
          };
    const r = await avisarCliente(admin, t, mensaje, sitio);
    enviados += r.enviados;
  }
  return NextResponse.json({ tarjetas: (data ?? []).length, enviados });
}
