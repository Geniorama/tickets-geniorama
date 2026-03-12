import { getRequiredSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { VaultForm } from "@/components/vault/vault-form";
import { BackButton } from "@/components/ui/back-button";

export const metadata = { title: "Nueva entrada — Bóveda" };

export default async function NewVaultEntryPage() {
  await getRequiredSession();

  const [companies, sites, services] = await Promise.all([
    prisma.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.site.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, domain: true, companyId: true } }),
    prisma.service.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true, companyId: true } }),
  ]);

  return (
    <div className="max-w-2xl">
      <div className="mb-4"><BackButton /></div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--app-body-text)" }}>
        Nueva entrada en Bóveda
      </h1>
      <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "1.5rem" }}>
        <VaultForm companies={companies} sites={sites} services={services} />
      </div>
    </div>
  );
}
