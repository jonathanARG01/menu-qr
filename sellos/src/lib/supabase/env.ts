// Limpia espacios o caracteres invisibles que se cuelan al pegar las variables en Vercel
// (la URL y la clave solo usan ASCII visible; un carácter raro rompe los headers de fetch).
const limpiar = (valor: string | undefined) => (valor ?? "").replace(/[^\x21-\x7E]/g, "");

export const SUPABASE_URL = limpiar(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = limpiar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
