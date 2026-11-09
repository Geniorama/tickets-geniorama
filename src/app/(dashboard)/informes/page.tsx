import Link from "next/link";
import { FileText, Download, Clock, CheckCircle2 } from "lucide-react";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { monthsToShow, reportMonthLabel } from "@/lib/monthly-reports";

export const metadata = { title: "Informes" };

/**
 * Informes mensuales del cliente (AG·P-5): qué mes está publicado y cuál sigue
 * pendiente, con el enlace directo para descargarlo.
 */
export default async function InformesPage() {
  const session = await getRequiredSession();
  const { id, role } = session.user;

  // El equipo marca y sube los informes desde la ficha del ticket.
  if (isStaff(role)) redirect("/tickets");

  // Mismo alcance que la lista de tickets: los que creó o los de su empresa.
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      companies: { select: { users: { where: { role: "CLIENTE" }, select: { id: true } } } },
    },
  });
  const clientIds = [
    ...new Set([id, ...(user?.companies.flatMap((c) => c.users.map((u) => u.id)) ?? [])]),
  ];

  const tickets = await prisma.ticket.findMany({
    where: {
      isDraft: false,
      OR: [{ createdById: id }, { clientId: { in: clientIds } }],
    },
    select: { id: true, title: true },
  });
  const ticketById = new Map(tickets.map((t) => [t.id, t.title]));

  // El informe puede estar adjunto al ticket o en un comentario del equipo (que
  // es por donde suele llegar al cliente). Las notas internas nunca cuentan.
  const ticketIds = tickets.map((t) => t.id);
  const [fromTicket, fromComments] = ticketIds.length
    ? await Promise.all([
        prisma.attachment.findMany({
          where: { entityType: "TICKET", entityId: { in: ticketIds }, reportMonth: { not: null } },
          select: { id: true, entityId: true, fileName: true, fileUrl: true, reportMonth: true, createdAt: true },
        }),
        prisma.commentAttachment.findMany({
          where: {
            reportMonth: { not: null },
            comment: { entityType: "TICKET", entityId: { in: ticketIds }, isInternal: false },
          },
          select: {
            id: true, name: true, url: true, reportMonth: true, createdAt: true,
            comment: { select: { entityId: true } },
          },
        }),
      ])
    : [[], []];

  const reports = [
    ...fromTicket,
    ...fromComments.map((c) => ({
      id: c.id,
      entityId: c.comment.entityId,
      fileName: c.name ?? "Informe",
      fileUrl: c.url,
      reportMonth: c.reportMonth,
      createdAt: c.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const byMonth = new Map<string, typeof reports>();
  for (const r of reports) {
    const key = r.reportMonth!;
    byMonth.set(key, [...(byMonth.get(key) ?? []), r]);
  }
  const months = monthsToShow([...byMonth.keys()]);

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "0.25rem" }}>
        Informes
      </h1>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1.5rem" }}>
        Tus informes mensuales, del más reciente al más antiguo.
      </p>

      {months.length === 0 ? (
        <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "3rem", textAlign: "center" }}>
          <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--app-text-muted)" }} />
          <p style={{ color: "var(--app-text-muted)", margin: 0 }}>
            Aún no hay informes publicados. Te avisaremos por correo cuando haya uno.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {months.map((month) => {
            const files = byMonth.get(month) ?? [];
            const published = files.length > 0;
            return (
              <section
                key={month}
                style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "1rem 1.25rem" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                  <h2 style={{ fontSize: "1rem", fontWeight: 650, color: "var(--app-body-text)", margin: 0, textTransform: "capitalize" }}>
                    {reportMonthLabel(month)}
                  </h2>
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "0.3rem",
                      fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "999px",
                      backgroundColor: published ? "var(--tone-green-bg)" : "var(--tone-amber-bg)",
                      color: published ? "var(--tone-green-fg)" : "var(--tone-amber-fg)",
                      border: `1px solid ${published ? "var(--tone-green-bd)" : "var(--tone-amber-bd)"}`,
                    }}
                  >
                    {published ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    {published ? "Publicado" : "Pendiente"}
                  </span>
                </div>

                {published && (
                  <ul style={{ listStyle: "none", margin: "0.75rem 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {files.map((f) => (
                      <li key={f.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.875rem" }}>
                        <FileText className="w-4 h-4 shrink-0" style={{ color: "var(--app-text-muted)" }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", color: "var(--app-body-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {f.fileName}
                          </span>
                          <Link
                            href={`/tickets/${f.entityId}`}
                            style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", textDecoration: "none" }}
                          >
                            {ticketById.get(f.entityId)}
                          </Link>
                        </span>
                        <a
                          href={f.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontWeight: 600, color: "var(--color-accent)", textDecoration: "none", flexShrink: 0 }}
                        >
                          <Download className="w-4 h-4" /> Descargar
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
