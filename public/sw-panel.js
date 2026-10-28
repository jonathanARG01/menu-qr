// Service worker del panel: permite instalarlo como app y, sin internet, muestra un aviso en vez del error del navegador.
// No guarda datos: las comandas pendientes las cuida la propia pantalla (borrador y reintentos).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

const SIN_CONEXION = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión · Mesitto</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#172033;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px}
button{margin-top:16px;border:0;border-radius:999px;background:#f2a33a;color:#172033;font-weight:700;padding:12px 20px;font-size:15px}</style></head>
<body><div><h1 style="font-size:20px">Sin conexión a internet</h1><p style="opacity:.75;max-width:320px">Revisa el wifi o los datos del teléfono. Las comandas que no alcanzaron a salir quedan guardadas y se envían al volver.</p>
<button onclick="location.reload()">Reintentar</button></div></body></html>`;

self.addEventListener("fetch", (evento) => {
  if (evento.request.mode !== "navigate") return;
  evento.respondWith(
    fetch(evento.request).catch(
      () => new Response(SIN_CONEXION, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
