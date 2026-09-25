"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid, LayoutList } from "lucide-react";
import { ViewSegmented } from "@/components/ui/view-segmented";

export function ProjectViewToggle({ current }: { current: "grid" | "list" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function buildHref(view: "grid" | "list") {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "list") params.delete("view");
    else params.set("view", view);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <ViewSegmented
      current={current}
      options={[
        { id: "grid", label: "Tarjetas", href: buildHref("grid"), Icon: LayoutGrid },
        { id: "list", label: "Lista", href: buildHref("list"), Icon: LayoutList },
      ]}
    />
  );
}
