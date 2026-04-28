"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";

export function PageSizeSelect({
  value,
  params,
  basePath,
}: {
  value: number;
  params: Record<string, string>;
  basePath: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params);
    next.delete("page");
    next.set("pageSize", e.target.value);
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${basePath}?${qs}` : basePath));
  }

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.375rem",
        fontSize: "0.8125rem",
        color: "var(--app-text-muted)",
      }}
    >
      Filas por página
      <select
        value={value}
        onChange={handleChange}
        style={{
          border: "1px solid var(--app-border)",
          borderRadius: "0.375rem",
          padding: "0.25rem 0.5rem",
          fontSize: "0.8125rem",
          color: "var(--app-body-text)",
          backgroundColor: "var(--app-card-bg)",
        }}
      >
        {PAGE_SIZE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </label>
  );
}
