import { getRequiredSession } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, KeyRound, Building2, Globe, Server, User2, Lock } from "lucide-react";

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
      company:   { select: { name: true } },
      site:      { select: { name: true } },
      service:   { select: { name: true } },
      createdBy: { select: { name: true } },
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
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ backgroundColor: "#fd1384", color: "#ffffff" }}
        >
          <Plus className="w-4 h-4" />
          Nueva entrada
        </Link>
      </div>

      {entries.length === 0 ? (
        <div style={{
          backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
          borderRadius: "0.75rem", padding: "3rem", textAlign: "center",
        }}>
          <KeyRound className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--app-icon-color)" }} />
          <p className="font-medium" style={{ color: "var(--app-body-text)" }}>No hay entradas en la bóveda</p>
          <p className="text-sm mt-1" style={{ color: "var(--app-text-muted)" }}>
            Crea tu primera credencial segura.
          </p>
          <Link
            href="/boveda/new"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "#fd1384", color: "#ffffff" }}
          >
            <Plus className="w-4 h-4" />
            Nueva entrada
          </Link>
        </div>
      ) : (
        <div style={{
          backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
          borderRadius: "0.75rem", overflow: "hidden",
        }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--app-border)", backgroundColor: "var(--app-content-bg)" }}>
                {["Título", "Empresa", "Sitio / Servicio", "Creado por", "Acceso", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide"
                    style={{ color: "var(--app-text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--app-border)" }}
                  className="hover:bg-opacity-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: "#fd1384" }} />
                      <Link
                        href={`/boveda/${e.id}`}
                        className="font-medium hover:underline"
                        style={{ color: "var(--app-body-text)" }}
                      >
                        {e.title}
                      </Link>
                    </div>
                    {e.username && (
                      <p className="text-xs mt-0.5 ml-5" style={{ color: "var(--app-text-muted)" }}>{e.username}</p>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--app-text-muted)" }}>
                    {e.company ? (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {e.company.name}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--app-text-muted)" }}>
                    <div className="flex flex-col gap-0.5">
                      {e.site && (
                        <span className="flex items-center gap-1 text-xs">
                          <Globe className="w-3 h-3" />{e.site.name}
                        </span>
                      )}
                      {e.service && (
                        <span className="flex items-center gap-1 text-xs">
                          <Server className="w-3 h-3" />{e.service.name}
                        </span>
                      )}
                      {!e.site && !e.service && "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--app-text-muted)" }}>
                      <User2 className="w-3.5 h-3.5" />
                      {e.createdBy.name}
                      {e.createdById === session.user.id && (
                        <span className="ml-1 px-1 py-0.5 rounded text-xs"
                          style={{ backgroundColor: "rgba(253,19,132,0.15)", color: "#fd1384" }}>
                          tú
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {e.sharedWith.length > 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "rgba(253,19,132,0.12)", color: "#fd1384" }}>
                        +{e.sharedWith.length} usuarios
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--app-text-muted)" }}>Solo tú</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/boveda/${e.id}`}
                      className="text-xs font-medium"
                      style={{ color: "#fd1384" }}
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
