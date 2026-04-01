import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

function buildUrl(params: Record<string, string>, page: number, basePath: string): string {
  const p = new URLSearchParams(params);
  p.delete("page");
  if (page > 1) p.set("page", String(page));
  const str = p.toString();
  return `${basePath}${str ? `?${str}` : ""}`;
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const near = new Set<number>();
  near.add(1);
  near.add(total);
  for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) near.add(i);
  const sorted = [...near].sort((a, b) => a - b);
  const result: (number | "...")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) result.push("...");
    result.push(p);
    prev = p;
  }
  return result;
}

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "2rem",
  height: "2rem",
  padding: "0 0.375rem",
  borderRadius: "0.375rem",
  fontSize: "0.875rem",
  fontWeight: 500,
  textDecoration: "none",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--app-border)",
  backgroundColor: "var(--app-card-bg)",
  color: "var(--app-body-text)",
};

export function Pagination({
  totalItems,
  currentPage,
  pageSize,
  params,
  basePath,
}: {
  totalItems: number;
  currentPage: number;
  pageSize: number;
  params: Record<string, string>;
  basePath: string;
}) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  return (
    <nav
      aria-label="Paginación"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.25rem",
        padding: "1.25rem 0",
      }}
    >
      {/* Anterior */}
      {currentPage > 1 ? (
        <Link href={buildUrl(params, currentPage - 1, basePath)} style={btnBase}>
          <ChevronLeft style={{ width: "1rem", height: "1rem" }} />
        </Link>
      ) : (
        <span style={{ ...btnBase, opacity: 0.35, cursor: "not-allowed" }}>
          <ChevronLeft style={{ width: "1rem", height: "1rem" }} />
        </span>
      )}

      {/* Números */}
      {pages.map((p, i) =>
        p === "..." ? (
          <span
            key={`e${i}`}
            style={{ ...btnBase, borderWidth: 0, borderStyle: "none", borderColor: "transparent", backgroundColor: "transparent", cursor: "default", color: "var(--app-text-muted)" }}
          >
            …
          </span>
        ) : (
          <Link
            key={p}
            href={buildUrl(params, p, basePath)}
            style={{
              ...btnBase,
              ...(p === currentPage
                ? { backgroundColor: "#fd1384", color: "#fff", borderColor: "#fd1384", fontWeight: 600 }
                : {}),
            }}
          >
            {p}
          </Link>
        )
      )}

      {/* Siguiente */}
      {currentPage < totalPages ? (
        <Link href={buildUrl(params, currentPage + 1, basePath)} style={btnBase}>
          <ChevronRight style={{ width: "1rem", height: "1rem" }} />
        </Link>
      ) : (
        <span style={{ ...btnBase, opacity: 0.35, cursor: "not-allowed" }}>
          <ChevronRight style={{ width: "1rem", height: "1rem" }} />
        </span>
      )}
    </nav>
  );
}
