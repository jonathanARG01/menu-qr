import QRCode from "qrcode";
import type { Mesa, Restaurante, Sucursal } from "@/lib/types";
import { urlCarta } from "@/lib/utils";

const MARGEN = 2;

// Personalización del QR: imagen al centro (PNG cuadrado ya preparado) y color de los módulos.
export type EstiloQR = { logo: string | null; color: string };
export const ESTILO_BASE: EstiloQR = { logo: null, color: "#111111" };

// Módulos del QR y el hueco central que ocupa el logo (en módulos).
// Con logo se usa corrección de errores alta (30 %), así el código se lee aunque el centro esté tapado.
function matriz(texto: string, conLogo: boolean) {
  const { modules } = QRCode.create(texto, { errorCorrectionLevel: conLogo ? "H" : "M" });
  const size = modules.size;
  let lado = conLogo ? Math.round(size * 0.24) : 0;
  if ((size - lado) % 2) lado++;
  const inicio = (size - lado) / 2;
  const tapado = (f: number, c: number) => lado > 0 && f >= inicio && f < inicio + lado && c >= inicio && c < inicio + lado;
  return {
    size,
    total: size + MARGEN * 2,
    oscuro: (f: number, c: number) => modules.get(f, c) === 1 && !tapado(f, c),
    hueco: { inicio: inicio + MARGEN, lado },
  };
}

export async function qrPng(texto: string, ancho = 600, estilo: EstiloQR = ESTILO_BASE) {
  const m = matriz(texto, !!estilo.logo);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = ancho;
  const ctx = canvas.getContext("2d")!;
  const celda = ancho / m.total;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ancho, ancho);
  ctx.fillStyle = estilo.color;
  for (let f = 0; f < m.size; f++) {
    for (let c = 0; c < m.size; c++) {
      // Se redondean los bordes para que no queden líneas finas entre módulos.
      if (m.oscuro(f, c)) {
        const x = Math.floor((c + MARGEN) * celda);
        const y = Math.floor((f + MARGEN) * celda);
        ctx.fillRect(x, y, Math.ceil((c + MARGEN + 1) * celda) - x, Math.ceil((f + MARGEN + 1) * celda) - y);
      }
    }
  }
  if (estilo.logo) {
    const img = await cargarImagen(estilo.logo);
    ctx.drawImage(img, m.hueco.inicio * celda, m.hueco.inicio * celda, m.hueco.lado * celda, m.hueco.lado * celda);
  }
  return canvas.toDataURL("image/png");
}

export function qrSvg(texto: string, estilo: EstiloQR = ESTILO_BASE) {
  const m = matriz(texto, !!estilo.logo);
  let camino = "";
  for (let f = 0; f < m.size; f++) {
    for (let c = 0; c < m.size; c++) {
      if (m.oscuro(f, c)) camino += `M${c + MARGEN} ${f + MARGEN}h1v1h-1z`;
    }
  }
  const logo = estilo.logo
    ? `<image href="${estilo.logo}" x="${m.hueco.inicio}" y="${m.hueco.inicio}" width="${m.hueco.lado}" height="${m.hueco.lado}"/>`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.total} ${m.total}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="#fff"/><path fill="${estilo.color}" d="${camino}"/>${logo}</svg>`
  );
}

export function ordenarMesas(mesas: Mesa[]) {
  return [...mesas].sort((a, b) => a.numero.localeCompare(b.numero, "es", { numeric: true }));
}

export function descargar(href: string, nombreArchivo: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function cargarImagen(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = src;
  });
}

// Convierte cualquier imagen (también WebP) a PNG para poder meterla en el PDF.
async function imagenAPng(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

// Prepara la imagen del centro: una placa blanca redondeada con el logo encajado sin deformarlo.
export async function prepararLogoQR(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const bitmap = await createImageBitmap(blob);
    const lado = 320;
    const borde = 28;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = lado;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(0, 0, lado, lado, 56);
    ctx.fill();
    const escala = Math.min((lado - borde * 2) / bitmap.width, (lado - borde * 2) / bitmap.height);
    const [w, h] = [bitmap.width * escala, bitmap.height * escala];
    ctx.save();
    ctx.beginPath();
    ctx.roundRect((lado - w) / 2, (lado - h) / 2, w, h, 36);
    ctx.clip();
    ctx.drawImage(bitmap, (lado - w) / 2, (lado - h) / 2, w, h);
    ctx.restore();
    bitmap.close();
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function luminancia(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Color de la marca oscurecido lo necesario para que el QR tenga buen contraste sobre blanco.
export function colorLegibleQR(hex: string) {
  let [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let color = hex;
  for (let i = 0; i < 20 && luminancia(color) > 0.12; i++) {
    [r, g, b] = [r, g, b].map((c) => Math.round(c * 0.85));
    color = "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
  }
  return color;
}

function hexARgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Hoja A4 con 6 tarjetas de mesa (2 × 3) listas para recortar o mandar a imprimir como stickers.
export async function generarPdf(
  restaurante: Restaurante,
  mesas: (Mesa | null)[],
  estilo: EstiloQR = ESTILO_BASE,
  sucursal?: Sucursal,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const logo = restaurante.logo_url ? await imagenAPng(restaurante.logo_url) : null;
  const color = hexARgb(restaurante.color_primario);
  const colorQr = hexARgb(estilo.color);

  const [anchoPag, altoPag] = [210, 297];
  const [cols, filas] = [2, 3];
  const margen = 10;
  const ancho = (anchoPag - margen * 2) / cols;
  const alto = (altoPag - margen * 2) / filas;

  for (let i = 0; i < mesas.length; i++) {
    const enPagina = i % (cols * filas);
    if (i > 0 && enPagina === 0) doc.addPage();
    const x = margen + (enPagina % cols) * ancho;
    const y = margen + Math.floor(enPagina / cols) * alto;
    const cx = x + ancho / 2;
    const mesa = mesas[i];

    // Línea de corte
    doc.setDrawColor(210);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.rect(x, y, ancho, alto);
    doc.setLineDashPattern([], 0);

    // Franja de color con el nombre
    doc.setFillColor(...color);
    doc.roundedRect(x + 6, y + 6, ancho - 12, 16, 3, 3, "F");
    let textoX = cx;
    if (logo) {
      doc.addImage(logo, "PNG", x + 9, y + 8, 12, 12);
      textoX = cx + 6;
    }
    const claro = color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114 > 160;
    doc.setTextColor(claro ? 20 : 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(restaurante.nombre, textoX, y + 16, { align: "center", maxWidth: ancho - (logo ? 34 : 18) });

    // QR dibujado como vectores: nítido al imprimir y el PDF pesa poco.
    const lado = 52;
    const m = matriz(urlCarta(restaurante.slug, mesa?.numero, undefined, sucursal?.slug), !!estilo.logo);
    const celda = lado / m.total;
    const qx = cx - lado / 2;
    const qy = y + 25;
    doc.setFillColor(...colorQr);
    for (let f = 0; f < m.size; f++) {
      for (let c = 0; c < m.size; c++) {
        if (m.oscuro(f, c)) doc.rect(qx + (c + MARGEN) * celda, qy + (f + MARGEN) * celda, celda + 0.02, celda + 0.02, "F");
      }
    }
    if (estilo.logo) {
      const pos = m.hueco.inicio * celda;
      doc.addImage(estilo.logo, "PNG", qx + pos, qy + pos, m.hueco.lado * celda, m.hueco.lado * celda, "logo-qr");
    }

    doc.setTextColor(20);
    doc.setFontSize(16);
    doc.text(mesa ? `Mesa ${mesa.numero}` : "Nuestra carta", cx, y + 83, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(
      sucursal ? `${sucursal.nombre} · Escanea para ver la carta` : "Escanea con la cámara para ver la carta",
      cx,
      y + 89,
      {
        align: "center",
      },
    );
  }

  doc.save(`qr-${restaurante.slug}${sucursal ? `-${sucursal.slug}` : ""}.pdf`);
}
