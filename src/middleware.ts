import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // api/logout se excluye para que el middleware de NextAuth no interfiera
  // con los Set-Cookie de borrado de sesión que envía ese route handler.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|api/logout|api/cron).*)"],
};
