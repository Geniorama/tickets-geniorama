"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { BarChart3 } from "lucide-react";

type ProjectOption = { id: string; name: string };

export function ProjectReportPicker({
  projects,
  selected,
}: {
  projects: ProjectOption[];
  selected?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  if (projects.length === 0) return null;

  function onChange(id: string) {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("project", id);
    else next.delete("project");
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        flexWrap: "wrap",
        marginBottom: "1.5rem",
        padding: "0.75rem 1rem",
        backgroundColor: "var(--app-content-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.5rem",
      }}
    >
      <BarChart3 style={{ width: "1rem", height: "1rem", color: "#fd1384", flexShrink: 0 }} />
      <label htmlFor="project-report-picker" style={{ fontSize: "0.875rem", color: "var(--app-body-text)", fontWeight: 500 }}>
        Ver proyecto individual
      </label>
      <select
        id="project-report-picker"
        value={selected ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          minWidth: "14rem",
          border: "1px solid var(--app-border)",
          borderRadius: "0.5rem",
          padding: "0.375rem 0.75rem",
          fontSize: "0.875rem",
          color: "var(--app-body-text)",
          backgroundColor: "var(--app-card-bg)",
        }}
      >
        <option value="">Todos (vista global)</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
