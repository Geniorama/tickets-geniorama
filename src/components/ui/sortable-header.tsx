import Link from "next/link";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export function SortableHeader({
  label,
  column,
  sortBy,
  sortDir,
  basePath,
  paramsStr = "",
  style,
}: {
  label: string;
  column: string;
  sortBy: string;
  sortDir: string;
  basePath: string;
  paramsStr?: string;
  style?: React.CSSProperties;
}) {
  const isActive = sortBy === column;
  const nextDir = isActive && sortDir === "asc" ? "desc" : "asc";

  const params = new URLSearchParams(paramsStr);
  params.set("sortBy", column);
  params.set("sortDir", nextDir);
  params.delete("page");

  const Icon = isActive ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th
      style={{
        textAlign: "left",
        padding: "0.75rem 1rem",
        fontWeight: 500,
        fontSize: "0.8125rem",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <Link
        href={`${basePath}?${params.toString()}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.3rem",
          color: isActive ? "#fd1384" : "var(--app-text-muted)",
          textDecoration: "none",
        }}
      >
        {label}
        <Icon style={{ width: "0.75rem", height: "0.75rem", opacity: isActive ? 1 : 0.35, flexShrink: 0 }} />
      </Link>
    </th>
  );
}
