import { requireRole } from "@/lib/auth-helpers";
import { TicketTemplateForm } from "@/components/tickets/ticket-template-form";
import { BackButton } from "@/components/ui/back-button";

export const metadata = { title: "Nueva plantilla de ticket" };

export default async function NewTicketTemplatePage() {
  await requireRole(["ADMINISTRADOR", "COLABORADOR"]);

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <BackButton fallback="/tickets/plantillas" />
      </div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "1.5rem" }}>
        Nueva plantilla de ticket
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
        <TicketTemplateForm />
      </div>
    </div>
  );
}
