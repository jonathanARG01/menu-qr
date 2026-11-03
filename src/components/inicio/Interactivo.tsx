"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icono } from "@/components/Icono";
import { CLAVE_TEMA_SITIO as CLAVE_TEMA } from "./tema";

type Tema = "oscuro" | "claro";

const COLOR_BARRA: Record<Tema, string> = { oscuro: "#0b0e14", claro: "#f7f3eb" };

/* Efectos de toda la página, montado una sola vez:
   - aparición al hacer scroll de todo lo marcado con data-revelar
   - contadores animados (data-contar)
   - luz que sigue al mouse en las tarjetas (.tarjeta-sitio)
   - cabecera más sólida al bajar (data-bajado) */
export function AnimacionesSitio() {
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

    const cabecera = document.querySelector<HTMLElement>(".cabecera-sitio");
    const alBajar = () => {
      if (!cabecera) return;
      if (window.scrollY > 24) cabecera.setAttribute("data-bajado", "");
      else cabecera.removeAttribute("data-bajado");
    };
    alBajar();
    window.addEventListener("scroll", alBajar, { passive: true });

    const alMover = (ev: PointerEvent) => {
      const tarjeta = (ev.target as Element | null)?.closest?.<HTMLElement>(".tarjeta-sitio");
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

// Botón para alternar entre modo oscuro y claro. Se recuerda en este navegador.
export function BotonTema() {
  const [tema, setTema] = useState<Tema>("oscuro");
  useEffect(() => {
    setTema(document.documentElement.dataset.temaSitio === "claro" ? "claro" : "oscuro");
  }, []);

  const alternar = () => {
    const nuevo: Tema = tema === "oscuro" ? "claro" : "oscuro";
    setTema(nuevo);
    document.documentElement.dataset.temaSitio = nuevo;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COLOR_BARRA[nuevo]);
    try {
      localStorage.setItem(CLAVE_TEMA, nuevo);
    } catch {}
  };

  const texto = tema === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={texto}
      title={texto}
      className="group relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-sitio-borde bg-sitio-vidrio text-sitio-tinta transition hover:border-sitio-oro/50"
    >
      <span key={tema} className="cambio-precio flex">
        <Icono nombre={tema === "oscuro" ? "sol" : "luna"} className="h-[18px] w-[18px] transition group-hover:rotate-12" />
      </span>
    </button>
  );
}

type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// Instalar Platovi como app de escritorio (o en el celular). Chrome y Edge muestran su propio aviso;
// Safari y Firefox no tienen ese aviso, así que se explica cómo hacerlo desde el menú del navegador.
export function BotonInstalar() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [instalada, setInstalada] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone) {
      setInstalada(true);
      return;
    }
    // Mismo service worker que la carta (alcance /), para no pisar el que recibe los avisos de pedidos.
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw-carta.js").catch(() => {});
    const guardar = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    const listo = () => {
      setEvento(null);
      setInstalada(true);
    };
    window.addEventListener("beforeinstallprompt", guardar);
    window.addEventListener("appinstalled", listo);
    return () => {
      window.removeEventListener("beforeinstallprompt", guardar);
      window.removeEventListener("appinstalled", listo);
    };
  }, []);

  useEffect(() => {
    if (!ayuda) return;
    const cerrar = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAyuda(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAyuda(false);
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("keydown", esc);
    };
  }, [ayuda]);

  if (instalada) return null;

  const instalar = () => {
    if (evento) {
      evento.prompt().finally(() => setEvento(null));
      return;
    }
    setAyuda((a) => !a);
  };

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={instalar}
        aria-expanded={evento ? undefined : ayuda}
        title="Instalar Platovi como app"
        className="flex h-10 items-center gap-2 rounded-full border border-sitio-borde bg-sitio-vidrio px-3 text-sm font-medium text-sitio-tinta transition hover:border-sitio-oro/50"
      >
        <Icono nombre="pantalla" className="h-[18px] w-[18px]" />
        <span className="hidden lg:inline">Instalar app</span>
        <span className="sr-only lg:hidden">Instalar app</span>
      </button>
      {ayuda && (
        <div
          role="dialog"
          aria-label="Cómo instalar Platovi"
          className="vidrio cambio-precio absolute right-0 top-12 z-40 w-72 rounded-3xl p-5 text-sm shadow-2xl shadow-black/40"
          style={{ background: "var(--sitio-vidrio-fuerte)" }}
        >
          <p className="font-semibold text-sitio-tinta">Instala Platovi en tu computador</p>
          <ul className="mt-3 space-y-2.5 text-sitio-suave">
            <li>
              <b className="text-sitio-tinta">Chrome o Edge:</b> toca el ícono de instalar al final de la barra de direcciones, o
              menú ⋮ → <i>Instalar Platovi</i>.
            </li>
            <li>
              <b className="text-sitio-tinta">Safari en Mac:</b> menú Archivo → <i>Agregar al Dock</i>.
            </li>
            <li>
              <b className="text-sitio-tinta">iPhone:</b> Compartir → <i>Agregar a inicio</i>.
            </li>
            <li>
              <b className="text-sitio-tinta">Firefox:</b> todavía no permite instalar sitios; ábrelo en Chrome o Edge.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
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
    <div ref={caja} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-sitio-borde bg-sitio-vidrio text-sitio-tinta"
      >
        <Icono nombre={abierto ? "cerrar" : "menu"} className="h-5 w-5" />
      </button>
      {abierto && (
        <nav
          className="vidrio cambio-precio absolute right-0 top-12 z-40 flex w-60 flex-col gap-1 rounded-3xl p-3 shadow-2xl shadow-black/40"
          style={{ background: "var(--sitio-vidrio-fuerte)" }}
        >
          {enlaces.map(([href, texto]) => (
            <a
              key={href}
              href={href}
              onClick={() => setAbierto(false)}
              className="rounded-2xl px-4 py-2.5 text-sitio-tinta transition hover:bg-sitio-vidrio"
            >
              {texto}
            </a>
          ))}
          <div className="my-1 h-px bg-sitio-borde" />
          <Link href="/login" className="rounded-2xl px-4 py-2.5 text-sitio-tinta transition hover:bg-sitio-vidrio">
            Entrar
          </Link>
          <Link href="/registro" className="boton-oro mt-1">
            Crear cuenta
          </Link>
        </nav>
      )}
    </div>
  );
}
