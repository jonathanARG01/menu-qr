import { NextResponse } from "next/server";
import { obtenerContexto } from "@/lib/panel";

export const dynamic = "force-dynamic";

// Todas las tablas con datos del restaurante que se descargan (lo que la base deja leer al administrador).
const TABLAS = [
  "categorias",
  "platos",
  "promos",
  "sucursales",
  "pisos",
  "mesas",
  "clientes",
  "reservas",
  "cuentas",
  "pedidos",
  "pedido_items",
  "pagos",
  "gastos",
  "cierres_caja",
  "opiniones",
  "eventos",
] as const;

// Descarga de todos los datos del restaurante en un archivo JSON (Ley 21.719: derecho de acceso y portabilidad).
// Solo para el administrador. Los datos de pago de Mercado Pago (la clave) nunca se incluyen.
export async function GET() {
  const { supabase, restaurante, admin } = await obtenerContexto();
  if (!restaurante || !admin) return NextResponse.json({ error: "Solo para el administrador" }, { status: 403 });

  const datos: Record<string, unknown> = {
    exportado: new Date().toISOString(),
    restaurante,
  };
  for (const tabla of TABLAS) {
    const filas: unknown[] = [];
    // De a 1000 filas (el máximo por consulta); hasta 50.000 por tabla.
    for (let desde = 0; desde < 50000; desde += 1000) {
      const { data, error } = await supabase
        .from(tabla)
        .select("*")
        .eq("restaurante_id", restaurante.id)
        .range(desde, desde + 999);
      if (error || !data?.length) break;
      filas.push(...data);
      if (data.length < 1000) break;
    }
    datos[tabla] = filas;
  }

  const fecha = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(datos, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="platovi-${restaurante.slug}-${fecha}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
