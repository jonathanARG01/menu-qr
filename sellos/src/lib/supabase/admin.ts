import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

// Cliente con la clave de servicio: solo en el servidor (rutas /api). Sin la variable devuelve null.
export function createAdminClient() {
  const clave = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").replace(/[^\x21-\x7E]/g, "");
  if (!clave || !SUPABASE_URL) return null;
  return createClient(SUPABASE_URL, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}
