"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";

export function ViewToggle({ current }: { current: "grid" | "list" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setView(view: "grid" | "list") {
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", view);
    router.push(`${pathname}?${next.toString()}`);
  }

  const btn = (view: "grid" | "list", Icon: React.ElementType, title: string) => {
    const active = current === view;
    return (
      <button
        onClick={() => setView(view)}
        title={title}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "2rem",
          height: "2rem",
          borderRadius: "0.4rem",
          border: "1px solid var(--app-border)",
          background: active ? "var(--app-content-bg)" : "none",
          color: active ? "var(--app-body-text)" : "var(--app-text-muted)",
          cursor: "pointer",
        }}
      >
        <Icon style={{ width: "0.9375rem", height: "0.9375rem" }} />
      </button>
    );
  };

  return (
    <div style={{ display: "flex", gap: "0.25rem" }}>
      {btn("grid", LayoutGrid, "Vista tarjetas")}
      {btn("list", List, "Vista lista")}
    </div>
  );
}
