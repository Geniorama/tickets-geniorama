import { requireRole } from "@/lib/auth-helpers";
import { TaskTemplateForm } from "@/components/tasks/task-template-form";
import { BackButton } from "@/components/ui/back-button";

export const metadata = { title: "Nueva plantilla de tarea" };

export default async function NewTaskTemplatePage() {
  await requireRole(["ADMINISTRADOR", "COLABORADOR"]);

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <BackButton fallback="/tareas/plantillas" />
      </div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "1.5rem" }}>
        Nueva plantilla de tarea
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
        <TaskTemplateForm />
      </div>
    </div>
  );
}
