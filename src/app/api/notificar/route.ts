import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisarSuperadmins } from "@/lib/avisosPrueba";
import { urlSitio } from "@/lib/utils";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;
const TIPOS = ["plan", "loyalty", "interes", "ayuda"] as const;
type Tipo = (typeof TIPOS)[number];

// El panel avisa aquí cuando alguien toca "Quiero el plan…", "Quiero Platovi Loyalty", "Ayuda" o abre algo de otro plan.
// La base (SQL 0035) comprueba que sea del equipo de ese restaurante, junta los avisos seguidos y no registra al
// equipo Platovi. Si es nuevo y es una venta (plan o Loyalty), además llega un aviso al celular de los superadmins.
export async function POST(request: Request) {
  const cuerpo = (await request.json().catch(() => ({}))) as { restaurante?: string; tipo?: string; detalle?: string };
  const tipo = cuerpo.tipo as Tipo;
  if (!cuerpo.restaurante || !UUID.test(cuerpo.restaurante) || !TIPOS.includes(tipo)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const detalle = String(cuerpo.detalle ?? "").slice(0, 200);
  const supabase = await createClient();
  const { data: nueva, error } = await supabase.rpc("registrar_notificacion_admin", {
    p_restaurante: cuerpo.restaurante,
    p_tipo: tipo,
    p_detalle: detalle,
  });
  if (error) return NextResponse.json({ ok: false }, { status: 200 });

  if (nueva === true && (tipo === "plan" || tipo === "loyalty")) {
    const db = createAdminClient();
    if (db) {
      const { data: r } = await db.from("restaurantes").select("nombre").eq("id", cuerpo.restaurante).maybeSingle();
      await avisarSuperadmins(db, {
        titulo: `${r?.nombre ?? "Un restaurante"} ${tipo === "plan" ? "quiere cambiar de plan" : "quiere Platovi Loyalty"}`,
        cuerpo: detalle || "Escríbele para cerrar la venta.",
        url: `${urlSitio()}/admin`,
      }).catch(() => 0);
    }
  }
  return NextResponse.json({ ok: true, nueva: nueva === true });
}
