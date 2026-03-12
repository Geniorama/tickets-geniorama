import { notFound } from "next/navigation";
import { getRequiredSession } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/vault-crypto";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";
import { VaultPasswordReveal } from "@/components/vault/vault-password-reveal";
import { VaultShareManager } from "@/components/vault/vault-share-manager";
import { DeleteVaultButton } from "@/components/vault/delete-vault-button";
import { Pencil, Building2, Globe, Server, ExternalLink } from "lucide-react";

export const metadata = { title: "Entrada — Bóveda" };

export default async function VaultEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getRequiredSession();
  const admin = isAdmin(session.user.role);

  const entry = await prisma.vaultEntry.findFirst({
    where: admin
      ? { id }
      : {
          id,
          OR: [
            { createdById: session.user.id },
            { sharedWith: { some: { userId: session.user.id } } },
          ],
        },
    include: {
      company:    { select: { id: true, name: true } },
      site:       { select: { id: true, name: true, domain: true } },
      service:    { select: { id: true, name: true, type: true } },
      createdBy:  { select: { id: true, name: true } },
      sharedWith: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  if (!entry) notFound();

  const decryptedPassword = decrypt(entry.password);
  const isOwner = entry.createdById === session.user.id;
  const canManage = admin || isOwner;

  const allUsers = await prisma.user.findMany({
    where: { isActive: true, id: { not: entry.createdById } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  const sharedUsers = entry.sharedWith.map((s) => s.user);

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "flex-start", gap: "0.75rem",
    padding: "0.75rem 0", borderBottom: "1px solid var(--app-border)",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "0.75rem", fontWeight: 500, color: "var(--app-text-muted)",
    width: "7rem", flexShrink: 0, paddingTop: "0.1rem",
  };
  const valueStyle: React.CSSProperties = {
    fontSize: "0.875rem", color: "var(--app-body-text)", flex: 1,
  };

  return (
    <div style={{ maxWidth: "42rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div><BackButton /></div>

      {/* Main card */}
      <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--app-body-text)", lineHeight: 1.3 }}>
            {entry.title}
          </h1>
          {canManage && (
            <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
              <Link
                href={`/boveda/${entry.id}/edit`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.25rem",
                  fontSize: "0.8125rem", color: "#fd1384", border: "1px solid rgba(253,19,132,0.3)",
                  borderRadius: "0.375rem", padding: "0.25rem 0.625rem", textDecoration: "none", fontWeight: 500,
                }}
              >
                <Pencil style={{ width: "0.875rem", height: "0.875rem" }} />
                Editar
              </Link>
              <DeleteVaultButton entryId={entry.id} entryTitle={entry.title} />
            </div>
          )}
        </div>

        {/* Fields */}
        <div>
          {entry.username && (
            <div style={rowStyle}>
              <span style={labelStyle}>Usuario</span>
              <span style={{ ...valueStyle, fontFamily: "var(--font-mono, monospace)" }}>{entry.username}</span>
            </div>
          )}
          <div style={rowStyle}>
            <span style={labelStyle}>Contraseña</span>
            <div style={{ flex: 1 }}>
              <VaultPasswordReveal password={decryptedPassword} />
            </div>
          </div>
          {entry.url && (
            <div style={rowStyle}>
              <span style={labelStyle}>URL</span>
              <a
                href={entry.url} target="_blank" rel="noopener noreferrer"
                style={{ ...valueStyle, color: "#fd1384", display: "flex", alignItems: "center", gap: "0.25rem" }}
              >
                {entry.url}
                <ExternalLink style={{ width: "0.75rem", height: "0.75rem", flexShrink: 0 }} />
              </a>
            </div>
          )}
          {entry.company && (
            <div style={rowStyle}>
              <span style={labelStyle}>Empresa</span>
              <span style={{ ...valueStyle, display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <Building2 style={{ width: "0.875rem", height: "0.875rem", color: "var(--app-text-muted)" }} />
                {entry.company.name}
              </span>
            </div>
          )}
          {entry.site && (
            <div style={rowStyle}>
              <span style={labelStyle}>Sitio / App</span>
              <span style={{ ...valueStyle, display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <Globe style={{ width: "0.875rem", height: "0.875rem", color: "var(--app-text-muted)" }} />
                {entry.site.name} — {entry.site.domain}
              </span>
            </div>
          )}
          {entry.service && (
            <div style={rowStyle}>
              <span style={labelStyle}>Servicio</span>
              <span style={{ ...valueStyle, display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <Server style={{ width: "0.875rem", height: "0.875rem", color: "var(--app-text-muted)" }} />
                {entry.service.name}
              </span>
            </div>
          )}
          {entry.notes && (
            <div style={{ ...rowStyle, borderBottom: "none" }}>
              <span style={labelStyle}>Notas</span>
              <span style={{ ...valueStyle, whiteSpace: "pre-wrap" }}>{entry.notes}</span>
            </div>
          )}
        </div>

        <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
          Creado por <strong style={{ color: "var(--app-body-text)" }}>{entry.createdBy.name}</strong>
        </p>
      </div>

      {/* Share manager */}
      <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "1.5rem" }}>
        <VaultShareManager
          entryId={entry.id}
          sharedWith={sharedUsers}
          availableUsers={allUsers}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
