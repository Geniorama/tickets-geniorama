import { prisma } from "@/lib/prisma";

/**
 * Normaliza el `briefType` que manda n8n.
 *
 * Vive aquí y no en las Server Actions porque el webhook
 * (`/api/integrations/brief`) también la usa, y un módulo `"use server"` solo
 * puede exportar funciones async. Al aplicarla en ambos lados, "Sitio Web" en
 * la pantalla de administración y "sitio web" en el payload son la misma regla.
 */
export function normalizeBriefType(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Lectores de la pantalla de administración.
 *
 * Viven aquí y no en las Server Actions porque la página los invoca **durante
 * el render**, y ese fue justo el fallo de la v1.50.2: un `"use server"` usado
 * como cargador de datos redirigía al dashboard. Los Server Actions quedan solo
 * para las mutaciones que llama el cliente. La página ya se guarda con
 * `requireCan("ADMIN")`.
 */
export async function listBriefRoutings() {
  return prisma.briefRouting.findMany({
    orderBy: { label: "asc" },
    include: {
      assignedTo: { select: { id: true, name: true, email: true, isActive: true } },
    },
  });
}

/** Staff disponible para asignar (alimenta el <select> de la pantalla). */
export async function listAssignableStaff() {
  return prisma.user.findMany({
    where: { isActive: true, role: { in: ["ADMINISTRADOR", "COLABORADOR"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
}
