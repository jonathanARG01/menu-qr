// Campanita de /admin: lo que hacen los restaurantes y te interesa saber (solo superadmin).
// Los cambios de carta, diseño y altas los registra la base sola (SQL 0035); los clics en botones se avisan desde el
// panel con notificarAdmin().

export type TipoNotificacion = "registro" | "carta" | "marca" | "plan" | "loyalty" | "interes" | "ayuda";
// Lo que el panel puede avisar con un clic (el resto lo registra la base).
export type TipoClic = Extract<TipoNotificacion, "plan" | "loyalty" | "interes" | "ayuda">;

export type NotificacionAdmin = {
  id: string;
  restaurante_id: string | null;
  restaurante: string;
  slug: string;
  tipo: TipoNotificacion;
  detalle: string;
  cambios: string[];
  veces: number;
  usuario_correo: string | null;
  leida: boolean;
  creado: string;
  actualizado: string;
};

export const INFO_TIPO: Record<TipoNotificacion, { titulo: string; icono: string; tono: string; venta: boolean }> = {
  plan: { titulo: "quiere cambiar de plan", icono: "estrella", tono: "bg-emerald-100 text-emerald-700", venta: true },
  loyalty: { titulo: "quiere Platovi Loyalty", icono: "sellos", tono: "bg-amber-100 text-amber-700", venta: true },
  registro: { titulo: "se registró", icono: "restaurantes", tono: "bg-sky-100 text-sky-700", venta: true },
  interes: { titulo: "miró algo de otro plan", icono: "candado", tono: "bg-orange-100 text-orange-700", venta: true },
  ayuda: { titulo: "pidió ayuda por WhatsApp", icono: "whatsapp", tono: "bg-green-100 text-green-700", venta: false },
  carta: { titulo: "editó su carta", icono: "lapiz", tono: "bg-stone-100 text-stone-600", venta: false },
  marca: { titulo: "cambió su diseño", icono: "marca", tono: "bg-violet-100 text-violet-700", venta: false },
};

// Avisa sin esperar respuesta (sirve aunque el botón abra WhatsApp en otra pestaña).
export function notificarAdmin(restaurante: string, tipo: TipoClic, detalle = "") {
  try {
    fetch("/api/notificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurante, tipo, detalle }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Nunca debe romper el botón.
  }
}
