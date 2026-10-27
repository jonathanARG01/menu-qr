"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Marca } from "@/components/Logo";
import { Icono } from "@/components/Icono";
import { BotonAvisos } from "@/components/BotonAvisos";

type Tema = "oscuro" | "claro";

const MENU = [
  { href: "/admin", texto: "Restaurantes", icono: "restaurantes", ayuda: "Planes, pruebas y pagos" },
  { href: "/admin/referidos", texto: "Referidos", icono: "referidos", ayuda: "Quién invitó a quién y descuentos" },
];

// Marco de /admin con el mismo estilo del panel: menú lateral flotante en computadora y pestañas arriba en el teléfono.
export function MarcoAdmin({ tema: temaInicial, email, children }: { tema: Tema; email: string; children: React.ReactNode }) {
  const ruta = usePathname();
  const [tema, setTema] = useState(temaInicial);

  // La misma cookie del panel: el tema elegido vale para los dos.
  function alternarTema() {
    const nuevo = tema === "oscuro" ? "claro" : "oscuro";
    setTema(nuevo);
    document.cookie = `panel-tema=${nuevo}; path=/; max-age=31536000; samesite=lax`;
  }
  const botonTema = (
    <button
      type="button"
      onClick={alternarTema}
      className="flex h-9 w-9 items-center justify-center rounded-full text-suave hover:bg-stone-100 hover:text-tinta"
      aria-label={tema === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      <Icono nombre={tema === "oscuro" ? "sol" : "luna"} className="h-5 w-5" />
    </button>
  );
  const activa = (href: string) => (href === "/admin" ? ruta === "/admin" : ruta.startsWith(href));

  return (
    <div className={`panel-ui panel-fondo min-h-screen text-tinta ${tema === "oscuro" ? "tema-oscuro" : ""}`}>
      <aside className="fixed inset-y-3 left-3 z-30 hidden w-60 flex-col overflow-hidden rounded-3xl border border-borde bg-superficie shadow-[0_20px_50px_-30px_rgb(0_0_0/0.5)] lg:flex">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <Marca className="h-8 w-8" oscuro />
          <span className="font-marca text-lg font-bold leading-none tracking-tight">
            Mesitto<span className="text-marca-claro">.</span>
          </span>
          <span className="ml-auto rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Admin
          </span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-3" aria-label="Secciones de administración">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Negocio</p>
          {MENU.map((m) => {
            const actual = activa(m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                title={m.ayuda}
                aria-current={actual ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-2xl px-2 py-1.5 text-sm transition ${
                  actual ? "bg-stone-100 font-semibold" : "font-medium text-stone-600 hover:bg-stone-50 hover:text-tinta"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                    actual
                      ? "bg-marca-claro text-marca-tinta shadow-[0_6px_16px_-6px_rgb(242_163_58/0.7)]"
                      : "bg-stone-100 text-stone-500 group-hover:text-tinta"
                  }`}
                >
                  <Icono nombre={m.icono} className="h-[18px] w-[18px]" />
                </span>
                {m.texto}
              </Link>
            );
          })}
          <p className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Tu restaurante</p>
          <Link
            href="/panel"
            className="group flex items-center gap-3 rounded-2xl px-2 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-tinta"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-stone-100 text-stone-500 group-hover:text-tinta">
              <Icono nombre="carta" className="h-[18px] w-[18px]" />
            </span>
            Ir a mi panel
          </Link>
        </nav>
        <div className="m-3 space-y-2 rounded-2xl border border-borde bg-stone-50 p-3">
          <p className="truncate text-xs font-semibold">{email}</p>
          <p className="text-[11px] text-suave">Avisos de pruebas por vencer:</p>
          <BotonAvisos texto="Activar en este equipo" />
          <div className="flex justify-end">{botonTema}</div>
        </div>
      </aside>

      {/* Teléfono: barra superior con las secciones */}
      <header className="sticky top-0 z-20 border-b border-borde bg-superficie/90 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2 px-4 pt-2.5">
          <Marca className="h-7 w-7" oscuro />
          <span className="font-marca font-bold">Admin</span>
          <span className="ml-auto">{botonTema}</span>
        </div>
        <nav className="sin-barra flex gap-1 overflow-x-auto px-3 py-2">
          {[...MENU, { href: "/panel", texto: "Mi panel", icono: "carta", ayuda: "" }].map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
                m.href !== "/panel" && activa(m.href) ? "bg-marca-claro text-marca-tinta" : "text-suave"
              }`}
            >
              {m.texto}
            </Link>
          ))}
        </nav>
      </header>

      <div className="pb-16 lg:pl-[16.5rem]">
        <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
