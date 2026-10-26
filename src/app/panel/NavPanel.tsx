"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/panel", texto: "Carta", icono: "☰" },
  { href: "/panel/marca", texto: "Marca", icono: "◐" },
  { href: "/panel/qr", texto: "Códigos QR", icono: "▣" },
  { href: "/panel/estadisticas", texto: "Estadísticas", icono: "▥" },
];

function useClase() {
  const ruta = usePathname();
  return (href: string) => (ruta === href ? "text-marca border-marca" : "text-suave border-transparent hover:text-tinta");
}

// Escritorio: pestañas bajo la cabecera.
export function NavEscritorio() {
  const clase = useClase();
  return (
    <nav className="mx-auto hidden max-w-3xl gap-6 px-4 sm:flex">
      {ENLACES.map((e) => (
        <Link key={e.href} href={e.href} className={`border-b-2 pb-2 text-sm font-medium ${clase(e.href)}`}>
          {e.texto}
        </Link>
      ))}
    </nav>
  );
}

// Móvil: barra inferior al alcance del pulgar. Va fuera de la cabecera: su backdrop-blur rompería el position: fixed.
export function NavMovil() {
  const clase = useClase();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-borde bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
      {ENLACES.map((e) => (
        <Link
          key={e.href}
          href={e.href}
          className={`flex flex-1 flex-col items-center border-t-2 py-2 text-xs font-medium ${clase(e.href)}`}
        >
          <span className="text-lg leading-none">{e.icono}</span>
          {e.texto}
        </Link>
      ))}
    </nav>
  );
}
