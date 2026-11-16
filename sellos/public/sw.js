// Service worker de la plataforma: muestra los avisos de la tarjeta aunque esté cerrada.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Panel instalado como app: si no hay internet, muestra un aviso en vez de la página de error del navegador.
const SIN_CONEXION = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#060a17;color:#e8ecf8;text-align:center;padding:24px}
button{margin-top:16px;border:0;border-radius:12px;padding:10px 18px;font-weight:600;color:#fff;background:linear-gradient(135deg,#6a85ff,#8b5cf6);cursor:pointer}</style></head>
<body><div><p style="font-size:40px;margin:0">📡</p><h1 style="font-size:20px">Sin conexión a internet</h1><p style="color:#8c97b5">Revisa tu conexión y vuelve a intentarlo.</p><button onclick="location.reload()">Reintentar</button></div></body></html>`;

self.addEventListener("fetch", (evento) => {
  if (evento.request.mode !== "navigate") return;
  evento.respondWith(
    fetch(evento.request).catch(() => new Response(SIN_CONEXION, { headers: { "content-type": "text/html; charset=utf-8" } })),
  );
});

self.addEventListener("push", (evento) => {
  let d = {};
  try {
    d = evento.data ? evento.data.json() : {};
  } catch (_) {
    d = { titulo: evento.data ? evento.data.text() : "" };
  }
  evento.waitUntil(
    (async () => {
      // Si la tarjeta está abierta y a la vista, ya muestra su propio aviso: no se repite.
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (ventanas.some((v) => v.visibilityState === "visible" && v.focused)) return;
      await self.registration.showNotification(d.titulo || "Tu tarjeta", {
        body: d.cuerpo || "",
        icon: d.icono || "/favicon.ico",
        badge: d.icono || "/favicon.ico",
        tag: d.etiqueta,
        renotify: true,
        vibrate: [200, 100, 200],
        data: { url: d.url || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const url = new URL(evento.notification.data?.url || "/", self.location.origin).href;
  evento.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const abierta = ventanas.find((v) => v.url.split("?")[0] === url.split("?")[0]);
      if (abierta) return abierta.focus();
      return self.clients.openWindow(url);
    })(),
  );
});
