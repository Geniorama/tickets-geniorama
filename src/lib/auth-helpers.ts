import { auth } from "@/auth";
import type { Role } from "@/generated/prisma";
import { redirect } from "next/navigation";

export { isAdmin, isStaff } from "@/lib/roles";

export async function getRequiredSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(allowedRoles: Role[]) {
  const session = await getRequiredSession();
  if (!allowedRoles.includes(session.user.role)) {
    redirect("/dashboard");
  }
  return session;
}
