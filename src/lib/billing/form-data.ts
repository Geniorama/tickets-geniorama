import { prisma } from "@/lib/prisma";

/**
 * Lo que necesita el formulario de un cobro.
 *
 * Solo empresas activas: no tiene sentido preparar una factura para una que ya
 * no opera. A diferencia del CRM, aquí no se filtra por etapa —a un prospecto
 * también se le puede cobrar un anticipo.
 */
export async function getBillingFormData() {
  const [companies, owners, categories] = await Promise.all([
    prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Solo las activas: retirar una categoría la quita del desplegable sin
    // descatalogar los cobros que ya la tienen.
    prisma.billingCategory.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return { companies, owners, categories };
}
