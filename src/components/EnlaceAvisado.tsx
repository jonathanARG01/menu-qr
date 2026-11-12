"use client";

import { notificarAdmin, type TipoClic } from "@/lib/notificacionesAdmin";

// Un enlace normal (por ejemplo a WhatsApp) que además deja una notificación en la campanita de /admin.
export function EnlaceAvisado({
  restaurante,
  tipo,
  detalle,
  children,
  ...resto
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { restaurante: string; tipo: TipoClic; detalle?: string }) {
  return (
    <a
      {...resto}
      onClick={(e) => {
        notificarAdmin(restaurante, tipo, detalle);
        resto.onClick?.(e);
      }}
    >
      {children}
    </a>
  );
}
