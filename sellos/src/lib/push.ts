// Avisos al celular del cliente con la tarjeta cerrada (notificaciones push del navegador).
// Sin las claves VAPID en Vercel, todo esto queda apagado sin romper nada.
export const CLAVE_PUBLICA = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").replace(/[^A-Za-z0-9_-]/g, "");

export function soportaPush() {
  return (
    !!CLAVE_PUBLICA &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// En iPhone los avisos solo funcionan si la tarjeta se agregó a la pantalla de inicio y se abre desde ahí.
export function iphoneSinInstalar() {
  if (typeof window === "undefined") return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const instalada =
    (navigator as Navigator & { standalone?: boolean }).standalone || matchMedia("(display-mode: standalone)").matches;
  return ios && !instalada;
}

export function aBytes(base64: string) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const crudo = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0));
}
