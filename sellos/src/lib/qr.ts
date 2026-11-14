import QRCode from "qrcode";

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
