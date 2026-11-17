import Link from "next/link";
import { Logo } from "@/components/Logo";
import { EMPRESA } from "@/lib/marca";
import { BotonTema, ScriptTema, Tema } from "@/components/Tema";

const VENTAJAS: [string, string, string][] = [
  ["📲", "Sin app ni tarjetas de papel", "El cliente la guarda en su celular en 10 segundos."],
  ["🎁", "Premios que hacen volver", "Sellos dobles, regalo de cumpleaños y “te extrañamos”."],
  ["✂️", "Para cualquier rubro", "Café, peluquería, barbería, tienda, lavado de autos…"],
];

// Pantallas de acceso: la marca a la izquierda y el formulario a la derecha.
export function AuthShell({ titulo, children, pie }: { titulo: string; children: React.ReactNode; pie?: React.ReactNode }) {
  return (
    <main className="club fondo-club grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <ScriptTema />
      <Tema />
      <section className="relative m-3 hidden overflow-hidden rounded-[2.5rem] rounded-br-[6rem] bg-[#0d0d0f] p-10 text-[#f4efe4] lg:flex lg:flex-col xl:p-14">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 15% 10%, rgb(212 175 55 / 0.3), transparent 55%), radial-gradient(ellipse at 90% 90%, rgb(200 164 106 / 0.3), transparent 55%), radial-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px) 0 0/22px 22px",
          }}
        />
        <Link href="/" className="relative flex items-end gap-3" aria-label="Inicio">
          <Logo claro className="text-3xl" />
          <span className="pb-0.5 text-xs text-[#b5ae9f]">por Brote Digital</span>
        </Link>
        <div className="relative mt-auto max-w-lg">
          <span aria-hidden className="orbe-club flotar-lento-club right-6 -top-24 h-20 w-20" />
          <span aria-hidden className="orbe-club onix orbe-difuso flotar-lento-club -top-10 right-32 h-9 w-9" style={{ "--retraso": "1800ms" } as React.CSSProperties} />
          <h2 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Clientes que vuelven,
            <br />
            <span className="font-acento text-[1.12em] font-normal italic text-[#e6c56a]">sello a sello.</span>
          </h2>
          <ul className="mt-8 space-y-4">
            {VENTAJAS.map(([icono, titulo, texto]) => (
              <li key={titulo} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-xl ring-1 ring-[#34d6a8]/30">
                  {icono}
                </span>
                <span>
                  <span className="block font-semibold">{titulo}</span>
                  <span className="block text-sm text-[#b5ae9f]">{texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-10 text-xs text-[#b5ae9f]/70">© {new Date().getFullYear()} {EMPRESA}</p>
      </section>

      <section className="relative flex items-center justify-center px-4 py-10 sm:px-8">
        <BotonTema className="vidrio-club absolute right-4 top-4 !bg-club-vidrio" />
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex justify-center lg:hidden" aria-label="Inicio">
            <Logo className="text-3xl" />
          </Link>
          <h1 className="entrada-club text-3xl font-bold tracking-tight sm:text-4xl">{titulo}</h1>
          <div className="tarjeta entrada-club mt-6 p-6 sm:p-8" style={{ "--retraso": "120ms" } as React.CSSProperties}>
            {children}
          </div>
          {pie && <div className="mt-6 text-center text-sm text-suave">{pie}</div>}
        </div>
      </section>
    </main>
  );
}

export function Aviso({ tipo = "error", children }: { tipo?: "error" | "ok"; children: React.ReactNode }) {
  return (
    <p
      role={tipo === "error" ? "alert" : "status"}
      className={`rounded-2xl px-4 py-2.5 text-sm ${tipo === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}
    >
      {children}
    </p>
  );
}
