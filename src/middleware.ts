import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Solo las rutas que necesitan sesión: la carta pública no pasa por aquí.
export const config = {
  matcher: ["/panel/:path*", "/admin/:path*", "/nueva-clave", "/login", "/registro"],
};
