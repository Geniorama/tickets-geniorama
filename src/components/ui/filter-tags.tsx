"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";

export type FilterTag = {
  key: string;
  value: string;
  label: string;
};

export function FilterTags({ tags }: { tags: FilterTag[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  if (tags.length === 0) return null;

  // Mantiene un sentinel (?clear=1) cuando no queda ningún filtro para que la
  // página no vuelva a aplicar los filtros por defecto.
  function navigate(next: URLSearchParams) {
    next.delete("page");
    if ([...next.keys()].length === 0) next.set("clear", "1");
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  function remove(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    const current = next.get(key);
    if (current === value) {
      next.delete(key);
    } else if (current !== null) {
      const remaining = current.split(",").filter((v) => v && v !== value);
      if (remaining.length) next.set(key, remaining.join(","));
      else next.delete(key);
    }
    navigate(next);
  }

  function clearAll() {
    const next = new URLSearchParams(params.toString());
    tags.forEach((t) => next.delete(t.key));
    navigate(next);
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", alignItems: "center" }}>
      {tags.map((t) => (
        <button
          key={`${t.key}-${t.value}`}
          type="button"
          onClick={() => remove(t.key, t.value)}
          title="Quitar filtro"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.75rem",
            fontWeight: 500,
            padding: "0.25rem 0.625rem",
            borderRadius: "9999px",
            border: "1px solid var(--app-border)",
            backgroundColor: "var(--app-card-bg)",
            color: "var(--app-body-text)",
            cursor: "pointer",
            lineHeight: 1,
          }}
        >
          <span>{t.label}</span>
          <X style={{ width: "0.75rem", height: "0.75rem", opacity: 0.7 }} />
        </button>
      ))}
      {tags.length > 1 && (
        <button
          type="button"
          onClick={clearAll}
          title="Quitar todos los filtros"
          style={{
            fontSize: "0.75rem",
            fontWeight: 500,
            padding: "0.25rem 0.625rem",
            borderRadius: "9999px",
            border: "none",
            backgroundColor: "transparent",
            color: "var(--app-text-muted)",
            cursor: "pointer",
            lineHeight: 1,
            textDecoration: "underline",
          }}
        >
          Limpiar todo
        </button>
      )}
    </div>
  );
}
