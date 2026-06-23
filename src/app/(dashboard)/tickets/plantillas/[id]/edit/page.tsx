import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { TicketTemplateForm } from "@/components/tickets/ticket-template-form";
import { BackButton } from "@/components/ui/back-button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tpl = await prisma.ticketTemplate.findUnique({ where: { id }, select: { name: true } });
  return { title: tpl ? `Editar: ${tpl.name}` : "Editar plantilla" };
}

export default async function EditTicketTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMINISTRADOR", "COLABORADOR"]);
  const { id } = await params;

  const template = await prisma.ticketTemplate.findUnique({ where: { id } });
  if (!template) notFound();

  const data = {
    id: template.id,
    name: template.name,
    title: template.title,
    description: template.description,
    priority: template.priority as string,
    category: template.category,
    checklist: template.checklist,
  };

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <BackButton fallback="/tickets/plantillas" />
      </div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "1.5rem" }}>
        Editar plantilla de ticket
      </h1>
      <div
        style={{
          maxWidth: "48rem",
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <TicketTemplateForm template={data} />
      </div>
    </div>
  );
}
