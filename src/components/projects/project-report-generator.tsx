"use client";

import { useState } from "react";
import { ReportGenerator } from "@/components/ui/report-generator";
import { generateProjectReport } from "@/actions/report.actions";

export function ProjectReportGenerator({ projectId }: { projectId: string }) {
  const [includeAssignees, setIncludeAssignees] = useState(true);
  const [extraInstructions, setExtraInstructions] = useState("");

  return (
    <ReportGenerator
      label="Informe IA del proyecto"
      generateFn={() =>
        generateProjectReport(projectId, { includeAssignees, extraInstructions })
      }
      options={
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* Checkbox encargados */}
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.8125rem",
              color: "var(--app-body-text)",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={includeAssignees}
              onChange={(e) => setIncludeAssignees(e.target.checked)}
              style={{ width: "0.9375rem", height: "0.9375rem", accentColor: "#6366f1", cursor: "pointer" }}
            />
            Incluir nombres de encargados en el informe
          </label>

          {/* Instrucciones extra */}
          <div>
            <label
              htmlFor="project-report-instructions"
              style={{
                display: "block",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--app-text-muted)",
                marginBottom: "0.375rem",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Instrucciones adicionales para la IA (opcional)
            </label>
            <textarea
              id="project-report-instructions"
              value={extraInstructions}
              onChange={(e) => setExtraInstructions(e.target.value)}
              placeholder="Ej: Enfócate en los riesgos del cronograma. Destaca las tareas vencidas. Redacta en tono ejecutivo…"
              rows={3}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                fontSize: "0.8125rem",
                color: "var(--app-body-text)",
                backgroundColor: "var(--app-card-bg)",
                border: "1px solid var(--app-border)",
                borderRadius: "0.375rem",
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
                lineHeight: 1.5,
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      }
    />
  );
}
