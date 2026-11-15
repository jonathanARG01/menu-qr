import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Solo las rutas que necesitan sesión: las tarjetas públicas no pasan por aquí.
export const config = {
  matcher: ["/panel/:path*", "/admin/:path*", "/nueva-clave", "/entrar", "/registro", "/equipo/:path*", "/crear"],
};
