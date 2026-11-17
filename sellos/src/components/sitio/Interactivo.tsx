"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icono } from "@/components/Icono";

/* Efectos del sitio, montado una sola vez (igual que en platovi.cl):
   - aparición al hacer scroll de todo lo marcado con data-revelar
   - contadores animados (data-contar)
   - luz que sigue al mouse en las tarjetas (.tarjeta-club)
   - cabecera más sólida al bajar (data-bajado) */
export function AnimacionesClub() {
  useEffect(() => {
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const elementos = Array.from(document.querySelectorAll<HTMLElement>("[data-revelar]"));
    const contadores = Array.from(document.querySelectorAll<HTMLElement>("[data-contar]"));

    const contar = (el: HTMLElement) => {
      const meta = Number(el.dataset.contar);
      if (!Number.isFinite(meta) || quieto || meta === 0) return;
      const inicio = performance.now();
      const duracion = 1200;
      const paso = (ahora: number) => {
        const t = Math.min(1, (ahora - inicio) / duracion);
        el.textContent = String(Math.round(meta * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(paso);
      };
      el.textContent = "0";
      requestAnimationFrame(paso);
    };

    let observador: IntersectionObserver | null = null;
    if (quieto || !("IntersectionObserver" in window)) {
      elementos.forEach((el) => el.setAttribute("data-visible", ""));
    } else {
      observador = new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) {
            if (!e.isIntersecting) continue;
            const el = e.target as HTMLElement;
            el.setAttribute("data-visible", "");
            if (el.dataset.contar) contar(el);
            observador?.unobserve(el);
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
      );
      elementos.forEach((el) => observador!.observe(el));
      contadores.forEach((el) => observador!.observe(el));
    }

    const cabecera = document.querySelector<HTMLElement>(".cabecera-club");
    const alBajar = () => {
      if (!cabecera) return;
      if (window.scrollY > 24) cabecera.setAttribute("data-bajado", "");
      else cabecera.removeAttribute("data-bajado");
    };
    alBajar();
    window.addEventListener("scroll", alBajar, { passive: true });

    const alMover = (ev: PointerEvent) => {
      const tarjeta = (ev.target as Element | null)?.closest?.<HTMLElement>(".tarjeta-club");
      if (!tarjeta) return;
      const r = tarjeta.getBoundingClientRect();
      tarjeta.style.setProperty("--mx", `${ev.clientX - r.left}px`);
      tarjeta.style.setProperty("--my", `${ev.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", alMover, { passive: true });

    return () => {
      observador?.disconnect();
      window.removeEventListener("scroll", alBajar);
      document.removeEventListener("pointermove", alMover);
    };
  }, []);
  return null;
}

// Menú del celular: los enlaces de la cabecera, Entrar y Crear cuenta. Se cierra al elegir algo o tocar afuera.
export function MenuMovil({ enlaces }: { enlaces: [string, string][] }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const cerrar = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  return (
    <div ref={caja} className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
        className="vidrio-club flex h-10 w-10 items-center justify-center rounded-full text-tinta"
      >
        <Icono nombre={abierto ? "cerrar" : "menu"} className="h-5 w-5" />
      </button>
      {abierto && (
        <nav
          className="vidrio-club aparecer-club absolute right-0 top-12 z-40 flex w-64 flex-col gap-1 rounded-3xl p-3 shadow-2xl shadow-black/30"
          style={{ background: "var(--club-vidrio-fuerte)" }}
        >
          {enlaces.map(([href, texto]) => (
            <a key={href} href={href} onClick={() => setAbierto(false)} className="rounded-2xl px-4 py-2.5 text-tinta transition hover:bg-club-vidrio">
              {texto}
            </a>
          ))}
          <div className="my-1 h-px bg-borde" />
          <Link href="/entrar" className="rounded-2xl px-4 py-2.5 text-tinta transition hover:bg-club-vidrio">
            Entrar
          </Link>
          <Link href="/registro" className="boton-oro mt-1">
            Crear cuenta gratis
          </Link>
        </nav>
      )}
    </div>
  );
}
