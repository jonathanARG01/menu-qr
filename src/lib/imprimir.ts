"use client";

import { PAIS_BASE, formatoFecha, formatoHora, type Region } from "./region";

// Impresión de tickets (comandas, precuenta y cierre de caja) en impresoras térmicas de 58 u 80 mm,
// o en cualquier impresora. Se arma una página mínima en un marco oculto y se manda a imprimir.
// Para que imprima sin preguntar, Chrome se abre con --kiosk-printing (ver la guía).

export type AnchoTicket = "58" | "80";

export type LineaTicket =
  | { tipo: "titulo"; texto: string }
  | { tipo: "texto"; texto: string; fuerte?: boolean; chico?: boolean }
  | { tipo: "fila"; izq: string; der?: string; fuerte?: boolean; nota?: string }
  | { tipo: "separador" };

const CLAVE_ANCHO = "impresora:ancho";

export function anchoGuardado(): AnchoTicket {
  try {
    return localStorage.getItem(CLAVE_ANCHO) === "58" ? "58" : "80";
  } catch {
    return "80";
  }
}

export function guardarAncho(ancho: AnchoTicket) {
  try {
    localStorage.setItem(CLAVE_ANCHO, ancho);
  } catch {}
}

const escapar = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function htmlTicket(lineas: LineaTicket[], ancho: AnchoTicket = anchoGuardado()) {
  const cuerpo = lineas
    .map((l) => {
      if (l.tipo === "titulo") return `<h1>${escapar(l.texto)}</h1>`;
      if (l.tipo === "separador") return "<hr>";
      if (l.tipo === "texto") return `<p class="${l.fuerte ? "b" : ""} ${l.chico ? "s" : ""}">${escapar(l.texto)}</p>`;
      return `<div class="f ${l.fuerte ? "b" : ""}"><span>${escapar(l.izq)}</span>${l.der ? `<span>${escapar(l.der)}</span>` : ""}</div>${
        l.nota ? `<p class="s n">${escapar(l.nota)}</p>` : ""
      }`;
    })
    .join("");
  const mm = ancho === "58" ? 48 : 72;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>
@page { size: ${ancho}mm auto; margin: 2mm; }
* { box-sizing: border-box; }
body { width: ${mm}mm; margin: 0 auto; font: ${ancho === "58" ? 11 : 12.5}px/1.35 ui-monospace, Menlo, Consolas, monospace; color: #000; }
h1 { font-size: 1.6em; margin: 0 0 2mm; text-align: center; }
p { margin: 0 0 1mm; } .b { font-weight: 700; } .s { font-size: .85em; } .n { padding-left: 3mm; font-style: italic; }
.f { display: flex; justify-content: space-between; gap: 2mm; margin-bottom: .6mm; }
.f span:last-child { white-space: nowrap; }
hr { border: 0; border-top: 1px dashed #000; margin: 2mm 0; }
</style></head><body>${cuerpo}</body></html>`;
}

// Imprime sin salir de la pantalla. Devuelve una promesa que se cumple al cerrar el diálogo de impresión.
export function imprimirTicket(lineas: LineaTicket[], ancho: AnchoTicket = anchoGuardado()) {
  return new Promise<void>((resolver) => {
    const marco = document.createElement("iframe");
    marco.setAttribute("aria-hidden", "true");
    marco.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(marco);
    const doc = marco.contentDocument!;
    doc.open();
    doc.write(htmlTicket(lineas, ancho));
    doc.close();
    const terminar = () => {
      setTimeout(() => marco.remove(), 500);
      resolver();
    };
    setTimeout(() => {
      try {
        marco.contentWindow!.addEventListener("afterprint", terminar, { once: true });
        marco.contentWindow!.focus();
        marco.contentWindow!.print();
      } catch {
        terminar();
      }
      // Por si el navegador no avisa al terminar.
      setTimeout(terminar, 60000);
    }, 50);
  });
}

// Con la región del local la hora sale en su zona horaria; sin ella, en la del navegador.
export const horaCorta = (iso: string | number | Date, region?: Region) =>
  region
    ? formatoHora(iso, region)
    : new Date(iso).toLocaleTimeString(PAIS_BASE.locale, { hour: "2-digit", minute: "2-digit", hour12: false });

export const fechaCorta = (iso: string | number | Date, region?: Region) => {
  const opciones: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  };
  return region ? formatoFecha(iso, region, opciones) : new Date(iso).toLocaleString(PAIS_BASE.locale, opciones);
};
