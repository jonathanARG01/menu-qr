export const ETIQUETAS = ["vegetariano", "vegano", "sin gluten", "picante", "nuevo", "recomendado"];

export const MONEDAS = ["USD", "EUR", "MXN", "ARS", "COP", "CLP", "PEN", "UYU", "BOB", "PYG", "GTQ", "CRC", "DOP"];

// Formato local de cada moneda ($ 2.800 en Argentina, $2,800 en México); el resto usa español de Latinoamérica.
const LOCALES: Record<string, string> = {
  EUR: "es-ES",
  ARS: "es-AR",
  CLP: "es-CL",
  COP: "es-CO",
  UYU: "es-UY",
  PYG: "es-PY",
  BOB: "es-BO",
  CRC: "es-CR",
};

export function formatoPrecio(valor: number, moneda: string) {
  try {
    return new Intl.NumberFormat(LOCALES[moneda] ?? "es-419", {
      style: "currency",
      currency: moneda,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: Number.isInteger(Number(valor)) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(Number(valor));
  } catch {
    return `${moneda} ${Number(valor).toFixed(2)}`;
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

// En el navegador manda la dirección desde la que se abrió la app; NEXT_PUBLIC_SITE_URL solo cubre el servidor.
export function urlSitio() {
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function urlCarta(slug: string, mesa?: string, base = urlSitio()) {
  const url = `${base}/${slug}`;
  return mesa ? `${url}?mesa=${encodeURIComponent(mesa)}` : url;
}

// Reduce la foto en el navegador a WebP de hasta 1200 px antes de subirla.
export async function comprimirImagen(archivo: File, ladoMax = 1200, calidad = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", calidad));
  if (!blob) throw new Error("No se pudo comprimir la imagen");
  return blob;
}

export function mensajeError(error: unknown) {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  if (msg.includes("restaurantes_slug_key")) return "Esa dirección ya está en uso. Prueba con otra.";
  if (msg.includes("slug_formato"))
    return "La dirección solo puede tener letras minúsculas, números y guiones (3 a 50 caracteres).";
  if (msg.includes("slug_reservado")) return "Esa dirección está reservada. Prueba con otra.";
  if (msg.includes("mesas_restaurante_id_numero_key") || msg.includes("mesas_numero_unico")) return "Esa mesa ya existe.";
  if (msg.includes("sucursales_restaurante_id_slug_key")) return "Ya tienes una sucursal con ese nombre corto.";
  if (msg.includes("Invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (msg.includes("Email not confirmed")) return "Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.";
  if (msg.includes("User already registered")) return "Ya existe una cuenta con ese correo.";
  if (msg.includes("Password should be")) return "La contraseña debe tener al menos 6 caracteres.";
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
