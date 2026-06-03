"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { LayoutTemplate } from "lucide-react";

type TemplateOption = { id: string; name: string };

export function TemplatePicker({
  templates,
  selected,
}: {
  templates: TemplateOption[];
  selected?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  if (templates.length === 0) return null;

  function onChange(id: string) {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("template", id);
    else next.delete("template");
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
        marginBottom: "1.25rem",
        padding: "0.75rem 1rem",
        backgroundColor: "var(--app-content-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.5rem",
      }}
    >
      <LayoutTemplate style={{ width: "1rem", height: "1rem", color: "#fd1384", flexShrink: 0 }} />
      <label htmlFor="template-picker" style={{ fontSize: "0.875rem", color: "var(--app-body-text)", fontWeight: 500 }}>
        Usar plantilla
      </label>
      <select
        id="template-picker"
        value={selected ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          minWidth: "12rem",
          border: "1px solid var(--app-border)",
          borderRadius: "0.5rem",
          padding: "0.375rem 0.75rem",
          fontSize: "0.875rem",
          color: "var(--app-body-text)",
          backgroundColor: "var(--app-card-bg)",
        }}
      >
        <option value="">Sin plantilla (en blanco)</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </div>
  );
}
