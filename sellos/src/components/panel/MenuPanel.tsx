"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES: { href: string; texto: string; dueno?: boolean }[] = [
  { href: "/panel", texto: "Clientes" },
  { href: "/panel/cobrar", texto: "Sumar con QR" },
  { href: "/panel/tarjeta", texto: "Tu tarjeta", dueno: true },
  { href: "/panel/carteles", texto: "QR para unirse", dueno: true },
  { href: "/panel/negocio", texto: "Negocio", dueno: true },
  { href: "/panel/equipo", texto: "Equipo", dueno: true },
  { href: "/panel/plan", texto: "Plan", dueno: true },
];

export function MenuPanel({ dueno }: { dueno: boolean }) {
  const ruta = usePathname();
  return (
    <nav className="sin-barra mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
      {ENLACES.filter((e) => dueno || !e.dueno).map((e) => {
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
