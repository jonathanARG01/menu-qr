import { NextResponse } from "next/server";
import { COOKIE_NEGOCIO } from "@/lib/panel";

// Cambia el negocio que se ve en el panel (si tienes más de uno).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("n") ?? "";
  const r = NextResponse.redirect(new URL("/panel", request.url));
  if (/^[0-9a-f-]{36}$/.test(id)) r.cookies.set(COOKIE_NEGOCIO, id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return r;
}
