import QRCode from "qrcode";
import type { Mesa, Restaurante } from "@/lib/types";
import { urlCarta } from "@/lib/utils";

const OPCIONES = { errorCorrectionLevel: "M" as const, margin: 2, color: { dark: "#111111", light: "#ffffff" } };

export function qrPng(texto: string, ancho = 600) {
  return QRCode.toDataURL(texto, { ...OPCIONES, width: ancho });
}

export function qrSvg(texto: string) {
  return QRCode.toString(texto, { ...OPCIONES, type: "svg" });
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

function hexARgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Hoja A4 con 6 tarjetas de mesa (2 × 3) listas para recortar o mandar a imprimir como stickers.
export async function generarPdf(restaurante: Restaurante, mesas: (Mesa | null)[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const logo = restaurante.logo_url ? await imagenAPng(restaurante.logo_url) : null;
  const color = hexARgb(restaurante.color_primario);

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
    const { modules } = QRCode.create(urlCarta(restaurante.slug, mesa?.numero), { errorCorrectionLevel: "M" });
    const celda = lado / (modules.size + 4);
    const qx = cx - lado / 2 + celda * 2;
    const qy = y + 25 + celda * 2;
    doc.setFillColor(17, 17, 17);
    for (let fila = 0; fila < modules.size; fila++) {
      for (let col = 0; col < modules.size; col++) {
        if (modules.get(fila, col)) doc.rect(qx + col * celda, qy + fila * celda, celda + 0.02, celda + 0.02, "F");
      }
    }

    doc.setTextColor(20);
    doc.setFontSize(16);
    doc.text(mesa ? `Mesa ${mesa.numero}` : "Nuestra carta", cx, y + 83, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text("Escanea con la cámara para ver la carta", cx, y + 89, { align: "center" });
  }

  doc.save(`qr-${restaurante.slug}.pdf`);
}
