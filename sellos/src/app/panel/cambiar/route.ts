import { NextResponse } from "next/server";
import { COOKIE_LOCAL, COOKIE_NEGOCIO } from "@/lib/panel";

// Cambia el negocio (?n=) o el local (?l=, vacío = todos) que se ve en el panel.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("n") ?? "";
  const local = url.searchParams.get("l");
  const volver = url.searchParams.get("volver") ?? "/panel";
  const r = NextResponse.redirect(new URL(volver.startsWith("/panel") ? volver : "/panel", request.url));
  const opciones = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };
  if (/^[0-9a-f-]{36}$/.test(id)) {
    r.cookies.set(COOKIE_NEGOCIO, id, opciones);
    r.cookies.delete(COOKIE_LOCAL);
  }
  if (local !== null) {
    if (/^[0-9a-f-]{36}$/.test(local)) r.cookies.set(COOKIE_LOCAL, local, opciones);
    else r.cookies.delete(COOKIE_LOCAL);
  }
  return r;
}
