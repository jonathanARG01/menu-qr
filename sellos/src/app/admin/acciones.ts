"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { urlSitio } from "@/lib/utils";

// Soporte de cuentas desde /admin: solo el superadmin, con la clave de servicio (SUPABASE_SERVICE_ROLE_KEY).
type Resultado = { ok: true; enlace?: string } | { ok: false; error: string };

async function soloSuperadmin() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("es_superadmin");
  if (data !== true) throw new Error("Solo para administradores");
  const admin = createAdminClient();
  if (!admin) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en Vercel");
  return admin;
}

async function correr(fn: () => Promise<Resultado>): Promise<Resultado> {
  try {
    return await fn();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo" };
  }
}

// Enlace para que la persona ponga una contraseña nueva (dura 1 hora). Se copia y se le manda por WhatsApp o correo.
export async function enlaceNuevaClave(email: string): Promise<Resultado> {
  return correr(async () => {
    const admin = await soloSuperadmin();
    const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
    if (error) return { ok: false, error: error.message };
    const token = data.properties?.hashed_token;
    if (!token) return { ok: false, error: "No se pudo crear el enlace" };
    return { ok: true, enlace: `${urlSitio()}/auth/confirm?token_hash=${token}&type=recovery&next=/nueva-clave` };
  });
}

// Poner una contraseña a mano (mínimo 8 caracteres).
export async function ponerClave(userId: string, clave: string): Promise<Resultado> {
  return correr(async () => {
    if (clave.length < 8) return { ok: false, error: "La contraseña necesita al menos 8 caracteres" };
    const admin = await soloSuperadmin();
    const { error } = await admin.auth.admin.updateUserById(userId, { password: clave });
    return error ? { ok: false, error: error.message } : { ok: true };
  });
}

// Cambiar el correo con que entra (queda confirmado al tiro).
export async function cambiarCorreo(userId: string, email: string): Promise<Resultado> {
  return correr(async () => {
    const limpio = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) return { ok: false, error: "Ese correo no es válido" };
    const admin = await soloSuperadmin();
    const { error } = await admin.auth.admin.updateUserById(userId, { email: limpio, email_confirm: true });
    return error ? { ok: false, error: error.message } : { ok: true };
  });
}

// Confirmar a mano una cuenta que no recibió el correo de confirmación.
export async function confirmarCuenta(userId: string): Promise<Resultado> {
  return correr(async () => {
    const admin = await soloSuperadmin();
    const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true });
    return error ? { ok: false, error: error.message } : { ok: true };
  });
}
