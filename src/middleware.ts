import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // api/logout se excluye para que el middleware de NextAuth no interfiera
  // con los Set-Cookie de borrado de sesión que envía ese route handler.
  // api/integrations y api/v1 se excluyen porque autentican con Bearer token, no
  // con sesión: si pasaran por aquí, una llamada sin cookie acabaría en un
  // redirect a /login en vez de en el 401 que espera quien integra.
  //
  // swagger-ui son los archivos estáticos del visor de la referencia, que viven
  // en `public/`. Sin excluirlos, el navegador recibe un redirect a /login en
  // vez del script y la pantalla se queda vacía.
  matcher: [
    // `sw.js` va fuera a propósito: un service worker se descarga sin cookies
    // de sesión, así que si el middleware lo redirige al login el navegador no
    // llega a registrarlo y las notificaciones push no se activan nunca.
    // No expone nada: solo escucha avisos, no lee datos.
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.png$|api/logout|api/cron|api/integrations|api/v1|swagger-ui).*)",
  ],
};
