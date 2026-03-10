"use client";

import Link from "next/link";
import type { Project, ProjectStatus } from "@/generated/prisma";
import { ProjectStatusBadge } from "./project-status-badge";
import { formatDate } from "@/lib/format-date";
import { FolderOpen, Calendar, User2, Building2 } from "lucide-react";

type ProjectWithRelations = Project & {
  company: { name: string } | null;
  manager: { name: string } | null;
  createdBy: { name: string };
  _count: { tasks: number };
};

export function ProjectList({ projects }: { projects: ProjectWithRelations[] }) {
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

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "1rem",
      }}
    >
      {projects.map((project) => (
        <Link
          key={project.id}
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
              <ProjectStatusBadge status={project.status as ProjectStatus} />
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
      ))}
    </div>
  );
}
