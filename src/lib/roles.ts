import type { Role } from "@/generated/prisma";

export function isAdmin(role: Role) {
  return role === "ADMINISTRADOR";
}

export function isStaff(role: Role) {
  return role === "ADMINISTRADOR" || role === "COLABORADOR";
}
