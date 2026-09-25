"use client";

import { useSearchParams } from "next/navigation";
import { LayoutList, LayoutGrid } from "lucide-react";
import { ViewSegmented } from "@/components/ui/view-segmented";

export function ViewToggle({ current }: { current: "list" | "kanban" }) {
  const searchParams = useSearchParams();

  function buildHref(view: "list" | "kanban") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    return `/tickets?${params.toString()}`;
  }

  return (
    <ViewSegmented
      current={current}
      options={[
        { id: "list", label: "Lista", href: buildHref("list"), Icon: LayoutList },
        { id: "kanban", label: "Kanban", href: buildHref("kanban"), Icon: LayoutGrid },
      ]}
    />
  );
}
