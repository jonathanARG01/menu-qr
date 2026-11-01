import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { PROGRAMA_BASE, type TarjetaPublica } from "./tipos";
import type { DatosWallet } from "./google";

// Lectura de una tarjeta desde el servidor (rutas /api y páginas /s), con la clave pública: solo lo que el cliente
// mismo puede ver con el código de su tarjeta.

export function clientePublico() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function leerTarjeta(codigo: string): Promise<TarjetaPublica | null> {
  const { data, error } = await clientePublico().rpc("sellos_tarjeta", { p_codigo: codigo });
  if (error || !data) return null;
  const t = data as TarjetaPublica;
  return { ...t, programa: t.programa ? { ...PROGRAMA_BASE, ...t.programa } : null };
}

export function datosWallet(t: TarjetaPublica, sitio: string): DatosWallet {
  return {
    sitio,
    restaurante: { id: t.restaurante.restaurante_id, nombre: t.restaurante.nombre, logo_url: t.restaurante.logo_url },
    programa: t.programa ?? PROGRAMA_BASE,
    tarjeta: { codigo: t.codigo, nombre: t.nombre, sellos: t.sellos, premios: t.premios },
  };
}

export const sitioDe = (request: Request) => process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(request.url).origin;
