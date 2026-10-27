// Service worker de la carta: muestra los avisos del pedido aunque la carta esté cerrada.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (evento) => {
  let d = {};
  try {
    d = evento.data ? evento.data.json() : {};
  } catch (_) {
    d = { titulo: evento.data ? evento.data.text() : "" };
  }
  evento.waitUntil(
    (async () => {
      // Si la carta está abierta y a la vista, ya muestra su propio aviso: no se repite.
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (ventanas.some((v) => v.visibilityState === "visible" && v.focused)) return;
      await self.registration.showNotification(d.titulo || "Tu pedido", {
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
