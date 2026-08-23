import { prisma } from "@/lib/prisma";
import type { FormAccount } from "@/components/crm/deal-form";
import { fullName } from "@/lib/crm/contact-name";

/**
 * Lo que necesita el formulario de una oportunidad: las cuentas con sus
 * contactos y quién puede llevarla.
 *
 * Las cuentas se traen todas, no solo las CLIENTE: una oportunidad sobre un
 * lead es justo el caso normal. Los contactos viajan con la cuenta para poder
 * filtrarlos al vuelo al cambiar de empresa, sin una segunda petición.
 */
export async function getDealFormData(): Promise<{
  accounts: FormAccount[];
  owners: { id: string; name: string }[];
}> {
  const [accounts, owners] = await Promise.all([
    prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        contacts: {
          where: { isActive: true },
          orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
          select: { id: true, firstName: true, lastName: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // El selector solo quiere una etiqueta por persona: se compone aquí.
  return {
    accounts: accounts.map((a) => ({
      ...a,
      contacts: a.contacts.map((c) => ({ id: c.id, name: fullName(c) })),
    })),
    owners,
  };
}
