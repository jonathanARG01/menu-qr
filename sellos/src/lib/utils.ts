// Formato local de cada moneda ($2.800 en Chile, $2,800 en México); el resto usa español de Latinoamérica.
const LOCALES: Record<string, string> = {
  CLP: "es-CL",
  EUR: "es-ES",
  ARS: "es-AR",
  BRL: "pt-BR",
  COP: "es-CO",
  UYU: "es-UY",
  PYG: "es-PY",
  BOB: "es-BO",
  CRC: "es-CR",
};

export const MONEDAS = ["CLP", "USD", "EUR", "MXN", "ARS", "BRL", "COP", "PEN", "UYU", "BOB", "PYG", "GTQ", "CRC", "DOP"];

export function decimalesMoneda(moneda: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: moneda }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function formatoPrecio(valor: number, moneda = "CLP") {
  const decimales = decimalesMoneda(moneda);
  try {
    return new Intl.NumberFormat(LOCALES[moneda] ?? "es-419", {
      style: "currency",
      currency: moneda,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: Number.isInteger(Number(valor)) ? 0 : decimales,
      maximumFractionDigits: decimales,
    }).format(Number(valor));
  } catch {
    return `${moneda} ${Number(valor).toFixed(decimales)}`;
  }
}

export function formatoFecha(iso: string, opciones: Intl.DateTimeFormatOptions, zona = "America/Santiago") {
  try {
    return new Date(iso).toLocaleString("es-CL", { timeZone: zona, ...opciones });
  } catch {
    return new Date(iso).toLocaleString("es-CL", opciones);
  }
}

export function slugify(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

// Dirección pública para enlaces y QR que se comparten o imprimen (la oficial, aunque se abra desde otra).
export function urlSitio() {
  const oficial = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (oficial) return oficial;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

// Teléfono para wa.me: solo dígitos; si es un celular chileno sin código de país, se le agrega el 56.
export function numeroWhatsapp(telefono: string, pais = "CL") {
  const d = telefono.replace(/\D/g, "");
  if (pais === "CL" && d.length === 9 && d.startsWith("9")) return `56${d}`;
  return d;
}

// Achica la imagen (y si se pide, la difumina un poco) y la deja en WebP. "difuminado" va de 0 (nada) a 20.
export async function comprimirImagen(archivo: Blob, ladoMax = 800, calidad = 0.85, difuminado = 0): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  if (difuminado > 0) {
    // Difuminado que funciona en todos los navegadores: se achica y se vuelve a agrandar suavizando (dos pasadas).
    const factor = Math.max(1.5, 1 + difuminado * 0.9);
    const chico = document.createElement("canvas");
    chico.width = Math.max(8, Math.round(canvas.width / factor));
    chico.height = Math.max(8, Math.round(canvas.height / factor));
    const c2 = chico.getContext("2d")!;
    c2.imageSmoothingQuality = "high";
    c2.drawImage(bitmap, 0, 0, chico.width, chico.height);
    ctx.imageSmoothingQuality = "high";
    // Un margen para que los bordes no queden transparentes.
    ctx.drawImage(chico, -4, -4, canvas.width + 8, canvas.height + 8);
    c2.drawImage(canvas, 0, 0, chico.width, chico.height);
    ctx.drawImage(chico, -2, -2, canvas.width + 4, canvas.height + 4);
  } else {
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  }
  bitmap.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", calidad));
  if (!blob) throw new Error("No se pudo comprimir la imagen");
  return blob;
}

export const blobADataUrl = (b: Blob) =>
  new Promise<string>((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => mal(new Error("No se pudo leer la imagen"));
    r.readAsDataURL(b);
  });

export function mensajeError(error: unknown) {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  if (msg.includes("negocios_slug_key")) return "Esa dirección ya está en uso. Prueba con otra.";
  if (msg.includes("negocios_slug_check")) return "La dirección solo puede tener letras minúsculas, números y guiones (3 a 50).";
  if (msg.includes("slug_reservado")) return "Esa dirección está reservada. Prueba con otra.";
  if (msg.includes("Invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (msg.includes("Email not confirmed")) return "Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.";
  if (msg.includes("User already registered")) return "Ya existe una cuenta con ese correo. Entra con tu contraseña.";
  if (msg.includes("Password should be")) return "La contraseña debe tener al menos 6 caracteres.";
  if (msg.includes("Failed to fetch")) return "Sin conexión. Revisa tu internet e intenta de nuevo.";
  return msg;
}

// Color de texto legible sobre un fondo dado.
export function textoSobre(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#1c1917" : "#ffffff";
}
