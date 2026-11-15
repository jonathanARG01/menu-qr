"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// quien: "todos" (también el equipo), "gestor" (dueño o encargado) o "dueno".
const ENLACES: { href: string; texto: string; quien: "todos" | "gestor" | "dueno" }[] = [
  { href: "/panel", texto: "Clientes", quien: "todos" },
  { href: "/panel/cobrar", texto: "Sumar con QR", quien: "todos" },
  { href: "/panel/metricas", texto: "Métricas", quien: "gestor" },
  { href: "/panel/campanas", texto: "Campañas", quien: "gestor" },
  { href: "/panel/premios", texto: "Premios y cupones", quien: "gestor" },
  { href: "/panel/tarjeta", texto: "Tu tarjeta", quien: "dueno" },
  { href: "/panel/carteles", texto: "QR para unirse", quien: "gestor" },
  { href: "/panel/locales", texto: "Locales", quien: "dueno" },
  { href: "/panel/negocio", texto: "Negocio", quien: "dueno" },
  { href: "/panel/equipo", texto: "Equipo", quien: "dueno" },
  { href: "/panel/integraciones", texto: "API e IA", quien: "dueno" },
  { href: "/panel/plan", texto: "Plan", quien: "dueno" },
];

export function MenuPanel({ dueno, gestor }: { dueno: boolean; gestor: boolean }) {
  const ruta = usePathname();
  return (
    <nav className="sin-barra mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
      {ENLACES.filter((e) => e.quien === "todos" || (e.quien === "gestor" ? gestor : dueno)).map((e) => {
        const activo = e.href === "/panel" ? ruta === "/panel" : ruta.startsWith(e.href);
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
              activo ? "border-marca text-tinta" : "border-transparent text-suave hover:text-tinta"
            }`}
          >
            {e.texto}
          </Link>
        );
      })}
    </nav>
  );
}
