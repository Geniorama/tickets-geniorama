import { getRequiredSession } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { VaultList } from "@/components/vault/vault-list";

export const metadata = { title: "Bóveda — Geniorama Tickets" };

export default async function BovedaPage() {
  const session = await getRequiredSession();
  const admin = isAdmin(session.user.role);

  const entries = await prisma.vaultEntry.findMany({
    where: admin
      ? {}
      : {
          OR: [
            { createdById: session.user.id },
            { sharedWith: { some: { userId: session.user.id } } },
          ],
        },
    include: {
      company:    { select: { name: true } },
      site:       { select: { name: true } },
      service:    { select: { name: true } },
      createdBy:  { select: { name: true } },
      sharedWith: { select: { userId: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--app-body-text)" }}>Bóveda</h1>
          <p className="text-sm mt-1" style={{ color: "var(--app-text-muted)" }}>
            Credenciales seguras vinculadas a tus clientes y plataformas.
          </p>
        </div>
        <Link
          href="/boveda/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: "#fd1384", color: "#ffffff" }}
        >
          <Plus className="w-4 h-4" />
          Nueva entrada
        </Link>
      </div>

      <VaultList
        entries={entries.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        }))}
        currentUserId={session.user.id}
      />
    </div>
  );
}
