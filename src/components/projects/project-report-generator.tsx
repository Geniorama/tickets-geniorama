"use client";

import { useState } from "react";
import { ReportGenerator } from "@/components/ui/report-generator";
import { generateProjectReport } from "@/actions/report.actions";

/** "YYYY-MM-DD" en la zona del navegador, que es la del equipo. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Lunes a domingo de la semana actual desplazada `offset` semanas. */
function weekRange(offset: number): [string, string] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [ymd(monday), ymd(sunday)];
}

function monthRange(): [string, string] {
  const now = new Date();
  return [
    ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
    ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  ];
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "var(--app-text-muted)",
  marginBottom: "0.375rem",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const fieldStyle: React.CSSProperties = {
  padding: "0.4rem 0.6rem",
  fontSize: "0.8125rem",
  color: "var(--app-body-text)",
  backgroundColor: "var(--app-card-bg)",
  border: "1px solid var(--app-border)",
  borderRadius: "0.375rem",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const chipStyle: React.CSSProperties = {
  padding: "0.25rem 0.6rem",
  fontSize: "0.75rem",
  fontWeight: 500,
  border: "1px solid var(--app-border)",
  borderRadius: "999px",
  backgroundColor: "var(--app-card-bg)",
  color: "var(--app-body-text)",
  cursor: "pointer",
};

const checkboxStyle: React.CSSProperties = {
  width: "0.9375rem",
  height: "0.9375rem",
  accentColor: "#6366f1",
  cursor: "pointer",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  fontSize: "0.8125rem",
  color: "var(--app-body-text)",
  cursor: "pointer",
  userSelect: "none",
};

export function ProjectReportGenerator({ projectId }: { projectId: string }) {
  const [includeAssignees, setIncludeAssignees] = useState(true);
  const [includeComments, setIncludeComments] = useState(true);
  const [extraInstructions, setExtraInstructions] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function setRange([a, b]: [string, string]) {
    setFrom(a);
    setTo(b);
  }

  return (
    <ReportGenerator
      label="Informe IA del proyecto"
      generateFn={(provider) =>
        generateProjectReport(
          projectId,
          { includeAssignees, includeComments, extraInstructions, from, to },
          provider,
        )
      }
      options={
        <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {/* Periodo */}
          <div>
            <span style={labelStyle}>Periodo del informe (opcional)</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <input
                type="date"
                aria-label="Desde"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                style={fieldStyle}
              />
              <span style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>al</span>
              <input
                type="date"
                aria-label="Hasta"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                style={fieldStyle}
              />
              <button type="button" onClick={() => setRange(weekRange(0))} style={chipStyle}>
                Esta semana
              </button>
              <button type="button" onClick={() => setRange(weekRange(-1))} style={chipStyle}>
                Semana pasada
              </button>
              <button type="button" onClick={() => setRange(monthRange())} style={chipStyle}>
                Este mes
              </button>
              {(from || to) && (
                <button type="button" onClick={() => setRange(["", ""])} style={chipStyle}>
                  Todo el proyecto
                </button>
              )}
            </div>
            <p style={{ margin: "0.375rem 0 0", fontSize: "0.75rem", color: "var(--app-text-muted)", lineHeight: 1.5 }}>
              {from || to
                ? "El informe solo verá las tareas con actividad en estas fechas y las finalizadas dentro de ellas. El resto del proyecto no llega a la IA."
                : "Sin fechas, el informe cubre el proyecto completo."}
            </p>
          </div>

          {/* Opciones */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={includeAssignees}
                onChange={(e) => setIncludeAssignees(e.target.checked)}
                style={checkboxStyle}
              />
              Incluir nombres de encargados en el informe
            </label>

            <label style={checkboxLabelStyle}>
              <input
                type="checkbox"
                checked={includeComments}
                onChange={(e) => setIncludeComments(e.target.checked)}
                style={checkboxStyle}
              />
              Usar los comentarios y entregables de las tareas como contexto
            </label>
          </div>

          {/* Instrucciones extra */}
          <div>
            <label htmlFor="project-report-instructions" style={labelStyle}>
              Instrucciones adicionales para la IA (opcional)
            </label>
            <textarea
              id="project-report-instructions"
              value={extraInstructions}
              onChange={(e) => setExtraInstructions(e.target.value)}
              placeholder="Ej: Enfócate en los riesgos del cronograma. Destaca las tareas vencidas. Redacta en tono ejecutivo…"
              rows={3}
              style={{ ...fieldStyle, width: "100%", padding: "0.5rem 0.75rem", resize: "vertical", lineHeight: 1.5 }}
            />
          </div>
        </div>
      }
    />
  );
}
