/*
 * Service worker de las notificaciones push.
 *
 * Es lo único que sigue vivo con la app cerrada, así que aquí no se hace nada
 * más: ni caché de la aplicación ni modo sin conexión. Un service worker que
 * cachea rutas de una app con sesión es una forma conocida de enseñarle a
 * alguien los datos de quien usó el navegador antes.
 *
 * Ojo: este archivo se sirve tal cual desde /sw.js, sin pasar por el compilador.
 * Nada de TypeScript ni de imports.
 */

self.addEventListener("install", () => {
  // Sustituye al service worker anterior sin esperar a que se cierren las
  // pestañas: si no, un cambio aquí tarda días en llegar a todo el mundo.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    // Si el cuerpo no es JSON, al menos se avisa de que pasó algo.
    datos = { title: "Geniorama", body: event.data ? event.data.text() : "" };
  }

  const titulo = datos.title || "Geniorama";
  const opciones = {
    body: datos.body || "",
    icon: "/icon-192.png",
    // Mismo `tag` reemplaza el aviso anterior en vez de apilar diez iguales.
    tag: datos.tag || "geniorama",
    data: { url: datos.url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      // Si la app ya está abierta se reutiliza esa pestaña: abrir una nueva
      // cada vez deja al usuario con quince copias de la aplicación.
      for (const ventana of ventanas) {
        if ("focus" in ventana) {
          ventana.focus();
          if ("navigate" in ventana) return ventana.navigate(destino);
          return;
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
