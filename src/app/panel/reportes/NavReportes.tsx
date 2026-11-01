import Link from "next/link";

const PESTANAS = [
  { href: "/panel/reportes", texto: "Por mesero" },
  { href: "/panel/reportes/productos", texto: "Productos" },
  { href: "/panel/reportes/gastos", texto: "Gastos" },
  { href: "/panel/reportes/autorizaciones", texto: "Autorizaciones" },
];

// Pestañas de Reportes.
export function NavReportes({ actual }: { actual: string }) {
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 text-sm" aria-label="Reportes">
      {PESTANAS.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          aria-current={p.href === actual ? "page" : undefined}
          className={`whitespace-nowrap rounded-full px-3.5 py-1.5 font-medium ${
            p.href === actual ? "bg-marca text-white" : "bg-stone-100 text-suave hover:text-tinta"
          }`}
        >
          {p.texto}
        </Link>
      ))}
    </nav>
  );
}
