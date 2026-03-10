"use server";

import { signOut } from "@/auth";
import { cookies } from "next/headers";

export async function logout() {
  // Borrar explícitamente las cookies de NextAuth antes del redirect,
  // porque signOut() usa redirect() internamente (NEXT_REDIRECT error) y
  // en algunos entornos el Set-Cookie de borrado no llega al response.
  const store = await cookies();
  store
    .getAll()
    .filter((c) => c.name.startsWith("authjs.") || c.name.startsWith("__Secure-authjs."))
    .forEach((c) => store.delete(c.name));

  await signOut({ redirectTo: "/login" });
}
