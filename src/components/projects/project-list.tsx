"use client";

import Link from "next/link";
import type { Project, ProjectStatus } from "@/generated/prisma";
import { ProjectStatusBadge } from "./project-status-badge";
import { ProjectFavoriteToggle } from "./project-favorite-toggle";
import { formatDate } from "@/lib/format-date";
import { FolderOpen, Calendar, User2, Building2, Lock } from "lucide-react";

type ProjectWithRelations = Project & {
  company: { name: string } | null;
  manager: { name: string } | null;
  createdBy: { name: string };
  _count: { tasks: number };
};

export function ProjectList({
  projects,
  view = "list",
  favoriteIds = new Set<string>(),
}: {
  projects: ProjectWithRelations[];
  view?: "grid" | "list";
  favoriteIds?: Set<string>;
}) {
  if (projects.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.75rem",
          padding: "3rem",
          textAlign: "center",
        }}
      >
        <FolderOpen
          style={{
            width: "2.5rem",
            height: "2.5rem",
            color: "var(--app-text-muted)",
            margin: "0 auto 0.75rem",
          }}
        />
        <p style={{ color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
          No hay proyectos aún.
        </p>
      </div>
    );
  }

  if (view === "list") {
    return (
      <div
        style={{
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}
      >
        {/* ── Vista mobile: cards compactas ── */}
        <ul className="md:hidden" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {projects.map((project) => (
            <li key={project.id} style={{ borderBottom: "1px solid var(--app-border)", position: "relative" }}>
              <div style={{ position: "absolute", top: "0.5rem", right: "0.5rem", zIndex: 2 }}>
                <ProjectFavoriteToggle projectId={project.id} initial={favoriteIds.has(project.id)} size="sm" />
              </div>
              <Link
                href={`/proyectos/${project.id}`}
                style={{ display: "block", padding: "0.875rem 2.5rem 0.875rem 1rem", textDecoration: "none" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.375rem" }}>
                  <span style={{ fontWeight: 600, color: "var(--app-body-text)", fontSize: "0.875rem", lineHeight: 1.4, display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
                    {project.isPrivate && <Lock style={{ width: "0.75rem", height: "0.75rem", color: "#7c3aed" }} />}
                    {project.name}
                  </span>
                  <ProjectStatusBadge status={project.status as ProjectStatus} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 0.875rem", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
                  {project.company && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      <Building2 style={{ width: "0.75rem", height: "0.75rem" }} />
                      {project.company.name}
                    </span>
                  )}
                  {project.manager && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      <User2 style={{ width: "0.75rem", height: "0.75rem" }} />
                      {project.manager.name}
                    </span>
                  )}
                  {project.dueDate && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      <Calendar style={{ width: "0.75rem", height: "0.75rem" }} />
                      {formatDate(project.dueDate)}
                    </span>
                  )}
                  <span>{project._count.tasks} tareas</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {/* ── Vista desktop: tabla ── */}
        <div className="hidden md:block" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--app-content-bg)", borderBottom: "1px solid var(--app-border)" }}>
                <th style={{ width: "2.25rem" }} />
                {["Nombre", "Empresa", "Encargado", "Estado", "Tareas", "Fecha límite"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "0.75rem 1rem",
                      fontWeight: 500,
                      fontSize: "0.8125rem",
                      color: "var(--app-text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} style={{ borderBottom: "1px solid var(--app-border)" }}>
                  <td style={{ padding: "0.5rem 0 0.5rem 0.75rem" }}>
                    <ProjectFavoriteToggle projectId={project.id} initial={favoriteIds.has(project.id)} size="sm" />
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <Link
                      href={`/proyectos/${project.id}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontWeight: 500, color: "var(--app-body-text)", textDecoration: "none" }}
                    >
                      {project.isPrivate && <Lock style={{ width: "0.75rem", height: "0.75rem", color: "#7c3aed" }} />}
                      {project.name}
                    </Link>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontSize: "0.8125rem" }}>
                    {project.company?.name ?? "—"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontSize: "0.8125rem" }}>
                    {project.manager?.name ?? "—"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <ProjectStatusBadge status={project.status as ProjectStatus} />
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)" }}>
                    {project._count.tasks}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontSize: "0.8125rem", whiteSpace: "nowrap" }}>
                    {project.dueDate ? formatDate(project.dueDate) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "1rem",
      }}
    >
      {projects.map((project) => (
        <div key={project.id} style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: "0.5rem", right: "0.5rem", zIndex: 2 }}>
            <ProjectFavoriteToggle projectId={project.id} initial={favoriteIds.has(project.id)} />
          </div>
          <Link
            href={`/proyectos/${project.id}`}
            style={{ textDecoration: "none" }}
          >
          <div
            style={{
              backgroundColor: "var(--app-card-bg)",
              border: "1px solid var(--app-border)",
              borderRadius: "0.75rem",
              padding: "1.25rem",
              transition: "box-shadow 0.15s",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow =
                "0 4px 12px rgba(0,0,0,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "0.75rem",
                paddingRight: "2rem",
              }}
            >
              <h3
                style={{
                  fontWeight: 600,
                  fontSize: "0.9375rem",
                  color: "var(--app-body-text)",
                  lineHeight: 1.3,
                  flex: 1,
                  marginRight: "0.5rem",
                }}
              >
                {project.name}
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {project.isPrivate && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.6875rem", fontWeight: 600, color: "#7c3aed", backgroundColor: "#ede9fe", borderRadius: "0.25rem", padding: "0.15rem 0.4rem" }}>
                    <Lock style={{ width: "0.625rem", height: "0.625rem" }} />
                    Privado
                  </span>
                )}
                <ProjectStatusBadge status={project.status as ProjectStatus} />
              </div>
            </div>

            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--app-text-muted)",
                marginBottom: "0.75rem",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {project.description}
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem 1rem",
                fontSize: "0.75rem",
                color: "var(--app-text-muted)",
              }}
            >
              {project.company && (
                <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <Building2 style={{ width: "0.75rem", height: "0.75rem" }} />
                  {project.company.name}
                </span>
              )}
              {project.manager && (
                <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <User2 style={{ width: "0.75rem", height: "0.75rem" }} />
                  {project.manager.name}
                </span>
              )}
              {project.dueDate && (
                <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <Calendar style={{ width: "0.75rem", height: "0.75rem" }} />
                  {formatDate(project.dueDate)}
                </span>
              )}
              <span
                style={{
                  marginLeft: "auto",
                  backgroundColor: "var(--app-content-bg)",
                  padding: "0.125rem 0.5rem",
                  borderRadius: "9999px",
                  fontWeight: 500,
                }}
              >
                {project._count.tasks} tareas
              </span>
            </div>
          </div>
          </Link>
        </div>
      ))}
    </div>
  );
}
