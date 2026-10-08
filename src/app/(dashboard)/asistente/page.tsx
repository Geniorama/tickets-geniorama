import { redirect } from "next/navigation";
import { isStaff } from "@/lib/auth-helpers";
import { requireModule } from "@/lib/access/can";
import { AssistantChat } from "@/components/assistant/assistant-chat";

export const metadata = { title: "Asistente IA" };

export default async function AsistentePage() {
  // El asistente trabaja sobre tickets y tareas: sin ninguno de los dos
  // módulos no tiene nada que contar.
  const session = await requireModule("TICKETS", "PROYECTOS");
  if (!isStaff(session.user.role)) redirect("/dashboard");

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "1rem" }}>
        Asistente IA
      </h1>
      <AssistantChat userName={session.user.name ?? "colaborador"} />
    </div>
  );
}
