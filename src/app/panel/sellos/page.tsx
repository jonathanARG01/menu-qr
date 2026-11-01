import { requerirSeccion } from "@/lib/panel";
import { PROGRAMA_BASE, sellosContratado, type FilaTarjeta, type ProgramaSellos } from "@/lib/sellos/tipos";
import { OfertaSellos } from "./Oferta";
import { Sellos } from "./Sellos";

export const metadata = { title: "Tarjeta de sellos · Platovi" };
export const dynamic = "force-dynamic";

export default async function PanelSellos() {
  const { supabase, restaurante, admin, ajustes } = await requerirSeccion("sellos");
  if (!sellosContratado(restaurante)) {
    return <OfertaSellos restaurante={restaurante} grupo={restaurante.plan === "grupo"} />;
  }

  const [programa, tarjetas] = await Promise.all([
    supabase.from("sellos_programas").select("*").eq("restaurante_id", restaurante.id).maybeSingle(),
    supabase
      .from("sellos_tarjetas")
      .select("id, restaurante_id, cliente_id, codigo, nombre, telefono, email, cumpleanos, acepta_avisos, sellos, premios, total_sellos, canjes, created_at, ultima_at")
      .eq("restaurante_id", restaurante.id)
      .order("ultima_at", { ascending: false, nullsFirst: false })
      .limit(3000),
  ]);

  if (programa.error || tarjetas.error) {
    return (
      <div className="tarjeta mx-auto max-w-lg p-6">
        <h1 className="font-semibold">Falta un paso en la base de datos</h1>
        <p className="mt-2 text-sm text-suave">
          Para la tarjeta de sellos ejecuta el SQL <code>0024_sellos.sql</code> en Supabase (SQL Editor → New query → pegar →
          Run).
        </p>
      </div>
    );
  }

  return (
    <Sellos
      restaurante={restaurante}
      admin={admin}
      ajustes={ajustes}
      programaGuardado={programa.data ? ({ ...PROGRAMA_BASE, ...programa.data } as ProgramaSellos) : null}
      iniciales={(tarjetas.data ?? []) as FilaTarjeta[]}
    />
  );
}
