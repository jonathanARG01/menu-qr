import Link from "next/link";
import { Icono } from "@/components/Icono";

const VENTAJAS: [string, string, string][] = [
  ["carta", "Carta QR en 6 idiomas", "Más de 20 diseños, fotos y pedidos desde la mesa."],
  ["salon", "Salón y cocina en vivo", "Plano de mesas por pisos y comandas al instante."],
  ["personas", "Cuentas sin vueltas", "Divide por persona, propinas y medios de pago."],
];

// Pantallas de acceso (entrar, crear cuenta, recuperar clave): la marca a la izquierda y el formulario a la derecha.
export function AuthShell({ titulo, children, pie }: { titulo: string; children: React.ReactNode; pie?: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-fondo lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#1a120c] p-10 text-amber-50 lg:flex lg:flex-col xl:p-14">
        {/* Fondo: luz cálida y una trama de puntos, como un salón de noche */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 20% 10%, rgb(245 158 11 / 0.35), transparent 55%), radial-gradient(ellipse at 90% 90%, rgb(180 83 9 / 0.45), transparent 55%), radial-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px) 0 0/22px 22px",
          }}
        />
        <Link href="/" className="relative flex items-center gap-3">
          <Marca />
          <span>
            <span className="block text-lg font-bold leading-tight">Mesitto</span>
            <span className="block text-xs text-amber-200/70">por Brote Digital</span>
          </span>
        </Link>

        <div className="relative mt-auto max-w-lg">
          <h2 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Tu restaurante,
            <br />
            <span className="text-amber-400">en un solo lugar.</span>
          </h2>
          <p className="mt-4 text-lg text-amber-100/80">
            La carta, el salón, la cocina y la cuenta conectados en tiempo real. El sistema se adapta a tu local, no al revés.
          </p>
          <ul className="mt-8 space-y-4">
            {VENTAJAS.map(([icono, titulo, texto]) => (
              <li key={titulo} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-300 ring-1 ring-white/10">
                  <Icono nombre={icono} />
                </span>
                <span>
                  <span className="block font-semibold">{titulo}</span>
                  <span className="block text-sm text-amber-100/70">{texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Avisos de ejemplo, como los que llegan al panel */}
        <div aria-hidden className="relative mt-10 flex flex-wrap gap-2 text-sm font-semibold">
          <span className="rounded-full bg-violet-600 px-3 py-1.5 shadow-lg shadow-violet-900/40">$ Mesa 6 pide la cuenta</span>
          <span className="rounded-full bg-emerald-600 px-3 py-1.5 shadow-lg shadow-emerald-900/40">✓ Mesa 2: pedido listo</span>
          <span className="rounded-full bg-sky-600 px-3 py-1.5 shadow-lg shadow-sky-900/40">! Mesa 9 llama al mesero</span>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <Marca />
            <span className="text-lg font-bold">Mesitto</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{titulo}</h1>
          <div className="mt-6 rounded-2xl border border-borde bg-superficie p-6 shadow-xl shadow-stone-900/5 sm:p-8">
            {children}
          </div>
          {pie && <div className="mt-6 text-center text-sm text-suave">{pie}</div>}
        </div>
      </section>
    </main>
  );
}

// Símbolo de la marca: un QR estilizado sobre un plato.
function Marca() {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg shadow-amber-900/40">
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="currentColor" aria-hidden>
        <path d="M4 4h6v6H4zm2 2v2h2V6zM14 4h6v6h-6zm2 2v2h2V6zM4 14h6v6H4zm2 2v2h2v-2zM14 14h2v2h-2zm2 2h2v2h-2zm2-2h2v2h-2zm-2 4h2v2h-2zm2 0h2v2h-2zm-4 0h2v2h-2z" />
      </svg>
    </span>
  );
}

export function Aviso({ tipo = "error", children }: { tipo?: "error" | "ok"; children: React.ReactNode }) {
  return (
    <p
      role={tipo === "error" ? "alert" : "status"}
      className={`rounded-lg px-3 py-2 text-sm ${tipo === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}
    >
      {children}
    </p>
  );
}
