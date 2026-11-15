import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { crearNegocio, type DatosAlta } from "./alta";
import { PROGRAMA_BASE, type Negocio, type ProgramaSellos, type Rol, type Sucursal } from "./tipos";
import { incluye, type Funcion } from "./marca";

export const COOKIE_NEGOCIO = "club_negocio";
export const COOKIE_LOCAL = "club_local";

export type Panel = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  usuario: { id: string; email: string; nombre: string };
  negocios: { id: string; nombre: string; rol: Rol }[];
  negocio: Negocio;
  rol: Rol;
  dueno: boolean;
  // dueño o encargado: campañas, premios, cupones y métricas
  gestor: boolean;
  programa: ProgramaSellos;
  sucursales: Sucursal[];
  // El local en que se está trabajando (el fijo del empleado, o el elegido). null = todos o sin locales.
  sucursal: Sucursal | null;
  // true si el miembro tiene un local fijo (no puede cambiarlo).
  localFijo: boolean;
  incluye: (f: Funcion) => boolean;
};

// Lo que necesita cada página del panel: la sesión, el negocio elegido (cookie) y su tarjeta.
// Si la cuenta todavía no tiene negocio pero se registró con los datos (confirmó el correo), termina el alta aquí.
export const cargarPanel = cache(async (): Promise<Panel> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar?next=/panel");

  const cargarMios = () =>
    supabase.from("miembros").select("rol, sucursal_id, negocio:negocios(id, nombre)").eq("user_id", user.id).order("created_at");
  let { data: mios } = await cargarMios();

  if (!mios?.length) {
    const alta = user.user_metadata?.alta as DatosAlta | undefined;
    if (alta?.nombre && alta.slug) {
      const { error } = await crearNegocio(supabase, alta);
      await supabase.auth.updateUser({ data: { alta: null } });
      if (error) redirect(`/crear?error=${encodeURIComponent(error.message)}`);
      ({ data: mios } = await cargarMios());
    }
  }
  if (!mios?.length) {
    const { data: admin } = await supabase.rpc("es_superadmin");
    redirect(admin ? "/admin" : "/crear");
  }

  const negocios = mios.flatMap((m) => {
    const n = m.negocio as unknown as { id: string; nombre: string } | null;
    return n ? [{ id: n.id, nombre: n.nombre, rol: m.rol as Rol, sucursal_id: (m.sucursal_id as string | null) ?? null }] : [];
  });
  const galletas = await cookies();
  const elegido = galletas.get(COOKIE_NEGOCIO)?.value;
  const actual = negocios.find((n) => n.id === elegido) ?? negocios[0];

  const [{ data: negocio }, { data: programa }, { data: locales }] = await Promise.all([
    supabase.from("negocios").select("*").eq("id", actual.id).single(),
    supabase.from("programas").select("*").eq("negocio_id", actual.id).maybeSingle(),
    supabase.from("sucursales").select("*").eq("negocio_id", actual.id).order("created_at"),
  ]);
  if (!negocio) redirect("/crear");
  const sucursales = (locales ?? []) as Sucursal[];
  const localElegido = galletas.get(COOKIE_LOCAL)?.value;
  const sucursal =
    sucursales.find((s) => s.id === actual.sucursal_id) ?? sucursales.find((s) => s.id === localElegido) ?? null;
  const n = negocio as Negocio;

  return {
    supabase,
    usuario: { id: user.id, email: user.email ?? "", nombre: String(user.user_metadata?.nombre ?? "") },
    negocios: negocios.map(({ id, nombre, rol }) => ({ id, nombre, rol })),
    negocio: n,
    rol: actual.rol,
    dueno: actual.rol === "dueno",
    gestor: actual.rol !== "empleado",
    programa: { ...PROGRAMA_BASE, ...(programa ?? {}) } as ProgramaSellos,
    sucursales,
    sucursal,
    localFijo: Boolean(actual.sucursal_id && sucursal),
    incluye: (f: Funcion) => incluye(n, f),
  };
});

// Páginas del dueño o del encargado.
export async function cargarPanelGestor() {
  const p = await cargarPanel();
  if (!p.gestor) redirect("/panel");
  return p;
}

// Páginas solo para el dueño.
export async function cargarPanelDueno() {
  const p = await cargarPanel();
  if (!p.dueno) redirect("/panel");
  return p;
}
