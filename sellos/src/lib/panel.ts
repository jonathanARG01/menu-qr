import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { crearNegocio, type DatosAlta } from "./alta";
import { PROGRAMA_BASE, type Negocio, type ProgramaSellos, type Rol } from "./tipos";

export const COOKIE_NEGOCIO = "sellito_negocio";

export type Panel = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  usuario: { id: string; email: string; nombre: string };
  negocios: { id: string; nombre: string; rol: Rol }[];
  negocio: Negocio;
  rol: Rol;
  dueno: boolean;
  programa: ProgramaSellos;
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
    supabase.from("miembros").select("rol, negocio:negocios(id, nombre)").eq("user_id", user.id).order("created_at");
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
    return n ? [{ id: n.id, nombre: n.nombre, rol: m.rol as Rol }] : [];
  });
  const elegido = (await cookies()).get(COOKIE_NEGOCIO)?.value;
  const actual = negocios.find((n) => n.id === elegido) ?? negocios[0];

  const [{ data: negocio }, { data: programa }] = await Promise.all([
    supabase.from("negocios").select("*").eq("id", actual.id).single(),
    supabase.from("programas").select("*").eq("negocio_id", actual.id).maybeSingle(),
  ]);
  if (!negocio) redirect("/crear");

  return {
    supabase,
    usuario: { id: user.id, email: user.email ?? "", nombre: String(user.user_metadata?.nombre ?? "") },
    negocios,
    negocio: negocio as Negocio,
    rol: actual.rol,
    dueno: actual.rol === "dueno",
    programa: { ...PROGRAMA_BASE, ...(programa ?? {}) } as ProgramaSellos,
  };
});

// Páginas solo para el dueño.
export async function cargarPanelDueno() {
  const p = await cargarPanel();
  if (!p.dueno) redirect("/panel");
  return p;
}
