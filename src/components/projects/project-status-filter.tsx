"use client";

import { useRouter } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "PLANIFICACION", label: "Planificación" },
  { value: "EN_DESARROLLO", label: "En desarrollo" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "COMPLETADO", label: "Completado" },
  { value: "PAUSADO", label: "Pausado" },
];

export function ProjectStatusFilter({ current }: { current?: string }) {
  const router = useRouter();

  return (
    <select
      value={current ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        router.push(v ? `/proyectos?status=${v}` : "/proyectos");
      }}
      style={{
        border: "1px solid var(--app-border)",
        borderRadius: "0.5rem",
        padding: "0.375rem 0.75rem",
        fontSize: "0.875rem",
        color: "var(--app-body-text)",
        backgroundColor: "var(--app-card-bg)",
        outline: "none",
      }}
    >
      {STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
