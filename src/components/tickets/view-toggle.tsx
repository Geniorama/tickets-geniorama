"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LayoutList, LayoutGrid } from "lucide-react";

export function ViewToggle({ current }: { current: "list" | "kanban" }) {
  const searchParams = useSearchParams();

  function buildHref(view: "list" | "kanban") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    return `/tickets?${params.toString()}`;
  }

  const base = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors";
  const active = "bg-indigo-600 text-white border-indigo-600";
  const inactive = "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-900";

  return (
    <div className="flex items-center gap-1">
      <Link href={buildHref("list")} className={`${base} ${current === "list" ? active : inactive}`}>
        <LayoutList className="w-4 h-4" />
        Lista
      </Link>
      <Link href={buildHref("kanban")} className={`${base} ${current === "kanban" ? active : inactive}`}>
        <LayoutGrid className="w-4 h-4" />
        Kanban
      </Link>
    </div>
  );
}
