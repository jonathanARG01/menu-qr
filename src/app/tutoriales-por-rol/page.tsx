import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { WHATSAPP_VENTAS } from "@/lib/planes";
import { TUTORIALES, type IdTutorial } from "@/lib/tutoriales";
import { Tutoriales } from "./Tutoriales";
import "./tutoriales.css";

export const metadata: Metadata = {
  title: "Tutoriales por rol · Platovi",
  description:
    "Capacitación paso a paso para el administrador, los meseros y la cocina del restaurante, con pantallazos reales de Platovi.",
};

export const viewport: Viewport = { themeColor: "#0a0a0a" };

// Capacitación por rol: la misma guía que se usa para enseñar el sistema a cada persona del local.
// ?rol=administrador|mesero|cocina abre directo ese tutorial (así lo enlaza el panel).
export default async function PaginaTutoriales({ searchParams }: { searchParams: Promise<{ rol?: string }> }) {
  const { rol } = await searchParams;
  const inicial = TUTORIALES.some((t) => t.id === rol) ? (rol as IdTutorial) : null;
  const ayuda = `https://wa.me/${WHATSAPP_VENTAS}?text=${encodeURIComponent("Hola, tengo una duda con la capacitación de Platovi.")}`;

  return (
    <div className="tut">
      <header className="tut-cabecera">
        <Link href="/" aria-label="Platovi, inicio">
          <Logo oscuro className="text-xl" />
        </Link>
        <nav className="tut-cabecera-links">
          <a href={ayuda} target="_blank" rel="noopener" className="tut-link">
            Ayuda por WhatsApp
          </a>
          <Link href="/login" className="tut-boton">
            Entrar al panel
          </Link>
        </nav>
      </header>

      <main className="tut-main">
        <section className="tut-hero">
          <p className="tut-eyebrow">Capacitación Platovi</p>
          <h1 className="tut-titulo">
            Tutoriales
            <br />
            <span>por rol</span>
          </h1>
          <span className="tut-raya" aria-hidden />
          <p className="tut-bajada">
            Elige tu rol y sigue los pasos en orden. Cada pantallazo es del sistema real y los números naranjos te
            muestran exactamente dónde tocar.
          </p>
        </section>

        <Tutoriales inicial={inicial} />

        <section className="tut-cierre">
          <div className="tut-cierre-icono" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l5-5 4 4 8-8" />
              <path d="M14 8h6v6" />
            </svg>
          </div>
          <div>
            <p className="tut-cierre-titulo">¿Te quedó alguna duda?</p>
            <p className="tut-cierre-texto">
              Escríbenos por WhatsApp a cualquier hora y te ayudamos con tu local.{" "}
              <a href={ayuda} target="_blank" rel="noopener">
                Abrir WhatsApp
              </a>
            </p>
          </div>
        </section>
      </main>

      <footer className="tut-pie">
        <span>© {new Date().getFullYear()} Platovi · por Brote Digital</span>
        <Link href="/">platovi.cl</Link>
      </footer>
    </div>
  );
}
