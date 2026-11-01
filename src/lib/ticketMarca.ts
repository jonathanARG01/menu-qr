import type { LineaTicket } from "./imprimir";
import type { Ajustes } from "./salon";

// Encabezado y pie de la precuenta con la marca del local (Personalizar → Precuenta con tu marca).

export function encabezadoMarca(ajustes: Ajustes, logo: string | null | undefined): LineaTicket[] {
  return ajustes.ticket.logo && logo ? [{ tipo: "imagen", src: logo }] : [];
}

export function pieMarca(ajustes: Ajustes): LineaTicket[] {
  const t = ajustes.ticket;
  const lineas: LineaTicket[] = [{ tipo: "separador" }];
  if (t.mensaje.trim()) lineas.push({ tipo: "texto", texto: t.mensaje.trim(), fuerte: true, centro: true });
  if (t.qr_resena && ajustes.resenas.google_url)
    lineas.push({ tipo: "qr", url: ajustes.resenas.google_url, texto: "¿Te gustó? Déjanos tu reseña en Google" });
  for (const renglon of t.pie
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean))
    lineas.push({ tipo: "texto", texto: renglon, chico: true, centro: true });
  lineas.push({ tipo: "texto", texto: "No válido como boleta", chico: true, centro: true });
  return lineas;
}
