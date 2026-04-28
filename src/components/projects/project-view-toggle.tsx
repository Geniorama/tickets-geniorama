"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid, LayoutList } from "lucide-react";

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

  const base = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors";
  const active = "bg-indigo-600 text-white border-indigo-600";
  const inactive = "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-900";

  return (
    <div className="flex items-center gap-1">
      <Link href={buildHref("grid")} className={`${base} ${current === "grid" ? active : inactive}`}>
        <LayoutGrid className="w-4 h-4" />
        Tarjetas
      </Link>
      <Link href={buildHref("list")} className={`${base} ${current === "list" ? active : inactive}`}>
        <LayoutList className="w-4 h-4" />
        Lista
      </Link>
    </div>
  );
}
