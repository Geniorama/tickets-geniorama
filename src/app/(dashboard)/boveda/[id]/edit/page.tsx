import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/vault-crypto";
import { VaultForm } from "@/components/vault/vault-form";
import { BackButton } from "@/components/ui/back-button";

export const metadata = { title: "Editar entrada — Bóveda" };

export default async function EditVaultEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getRequiredSession();
  const admin = isAdmin(session.user.role);

  const entry = await prisma.vaultEntry.findUnique({ where: { id } });
  if (!entry) notFound();
  if (!admin && entry.createdById !== session.user.id) notFound();

  const [companies, sites, services] = await Promise.all([
    prisma.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.site.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, domain: true, companyId: true } }),
    prisma.service.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true, companyId: true } }),
  ]);

  const decryptedPassword = decrypt(entry.password);

  return (
    <div className="max-w-2xl">
      <div className="mb-4"><BackButton /></div>
      <h1 className="text-2xl font-bold mb-6" style={{ color: "var(--app-body-text)" }}>Editar entrada</h1>
      <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "1.5rem" }}>
        <VaultForm
          companies={companies}
          sites={sites}
          services={services}
          entry={{
            id: entry.id,
            title: entry.title,
            username: entry.username,
            password: entry.password,
            url: entry.url,
            notes: entry.notes,
            companyId: entry.companyId,
            siteId: entry.siteId,
            serviceId: entry.serviceId,
          }}
          decryptedPassword={decryptedPassword}
        />
      </div>
    </div>
  );
}
