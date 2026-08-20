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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|api/logout|api/cron|api/integrations|api/v1).*)",
  ],
};
