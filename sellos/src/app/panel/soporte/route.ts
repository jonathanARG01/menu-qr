import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_LOCAL, COOKIE_SOPORTE } from "@/lib/panel";

// Modo soporte: el superadmin entra al panel de un negocio (?n=<id>) o vuelve a Admin (?salir=1; con &volver=panel va a su propio panel).
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.has("salir")) {
    const r = NextResponse.redirect(new URL(url.searchParams.get("volver") === "panel" ? "/panel" : "/admin", request.url));
    r.cookies.delete(COOKIE_SOPORTE);
    r.cookies.delete(COOKIE_LOCAL);
    return r;
  }
  const id = url.searchParams.get("n") ?? "";
  const supabase = await createClient();
  const { data: admin } = await supabase.rpc("es_superadmin");
  if (admin !== true || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.redirect(new URL("/panel", request.url));
  const r = NextResponse.redirect(new URL("/panel", request.url));
  // Dura lo que dure la sesión del navegador (máximo 12 horas).
  r.cookies.set(COOKIE_SOPORTE, id, { path: "/", maxAge: 60 * 60 * 12, sameSite: "lax", httpOnly: true });
  r.cookies.delete(COOKIE_LOCAL);
  return r;
}
