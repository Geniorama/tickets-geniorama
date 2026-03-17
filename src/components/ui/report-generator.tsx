"use client";

import { useState, useTransition } from "react";
import { FileText, Download, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import type { GeneratedReport, ReportHeader } from "@/actions/report.actions";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

// ─── Export helpers ────────────────────────────────────────────────────────────

function headerLines(header: ReportHeader): string[] {
  const lines: string[] = [];
  if (header.projectName) lines.push(`Proyecto: ${header.projectName}`);
  lines.push(`${header.itemCode ? `${header.itemCode} — ` : ""}${header.itemName}`);
  lines.push(`Fecha del informe: ${header.reportDate}`);
  if (header.projectManager) lines.push(`Responsable del proyecto: ${header.projectManager}`);
  if (header.responsible)    lines.push(`Responsable: ${header.responsible}`);
  if (header.client)         lines.push(`Cliente: ${header.client}`);
  lines.push(`Estado: ${header.status}`);
  lines.push(`Prioridad: ${header.priority}`);
  return lines;
}

/** Strip markdown markers to produce plain text */
function mdToPlain(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

async function exportPDF(report: GeneratedReport) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = margin;

  function checkPage(needed = 8) {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  }

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const title = report.header.itemCode
    ? `${report.header.itemCode} — ${report.header.itemName}`
    : report.header.itemName;
  const titleLines = doc.splitTextToSize(title, contentW) as string[];
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 4;

  // Header table
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  for (const line of headerLines(report.header)) {
    checkPage(5);
    doc.text(line, margin, y);
    y += 5;
  }
  y += 4;

  // Separator
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // Body
  doc.setTextColor(30, 30, 30);
  const plainBody = mdToPlain(report.body);
  const bodyLines = plainBody.split("\n");

  for (const rawLine of bodyLines) {
    const line = rawLine.trimEnd();
    if (!line) { y += 3; continue; }

    const isBullet = line.startsWith("• ");
    const isHeading = /^[A-ZÁÉÍÓÚ\d].*:$/.test(line) || line.toUpperCase() === line.trim();

    if (isHeading) {
      checkPage(8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const wrapped = doc.splitTextToSize(line, contentW) as string[];
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5.5 + 2;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
    } else if (isBullet) {
      checkPage(6);
      doc.setFontSize(10);
      const bulletText = line.slice(2);
      const wrapped = doc.splitTextToSize(`• ${bulletText}`, contentW - 4) as string[];
      doc.text(wrapped, margin + 4, y);
      y += wrapped.length * 5 + 1;
    } else {
      checkPage(6);
      doc.setFontSize(10);
      const wrapped = doc.splitTextToSize(line, contentW) as string[];
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5 + 1;
    }
  }

  const filename = `informe-${(report.header.itemCode ?? report.header.itemName).toLowerCase().replace(/\s+/g, "-")}.pdf`;
  doc.save(filename);
}

async function exportDOCX(report: GeneratedReport) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = await import("docx");

  const paragraphs: InstanceType<typeof Paragraph>[] = [];

  // Title
  paragraphs.push(
    new Paragraph({
      text: report.header.itemCode
        ? `${report.header.itemCode} — ${report.header.itemName}`
        : report.header.itemName,
      heading: HeadingLevel.TITLE,
    })
  );

  // Header metadata
  for (const line of headerLines(report.header)) {
    const [label, ...rest] = line.split(": ");
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: 20 }),
          new TextRun({ text: rest.join(": "), size: 20 }),
        ],
        spacing: { after: 60 },
      })
    );
  }

  // Separator
  paragraphs.push(
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC" } },
      spacing: { after: 200 },
    })
  );

  // Body — parse markdown lines
  const bodyLines = report.body.split("\n");
  for (const rawLine of bodyLines) {
    const line = rawLine.trimEnd();
    if (!line) {
      paragraphs.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }

    if (/^# /.test(line)) {
      paragraphs.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (/^## /.test(line)) {
      paragraphs.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (/^### /.test(line)) {
      paragraphs.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
    } else if (/^[*-] /.test(line)) {
      paragraphs.push(
        new Paragraph({
          text: line.slice(2),
          bullet: { level: 0 },
          spacing: { after: 80 },
        })
      );
    } else {
      // Handle inline bold **text**
      const runs: InstanceType<typeof TextRun>[] = [];
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      for (const part of parts) {
        if (/^\*\*/.test(part)) {
          runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: 22 }));
        } else {
          runs.push(new TextRun({ text: part, size: 22 }));
        }
      }
      paragraphs.push(new Paragraph({ children: runs, spacing: { after: 100 }, alignment: AlignmentType.JUSTIFIED }));
    }
  }

  const doc = new Document({
    sections: [{ children: paragraphs }],
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `informe-${(report.header.itemCode ?? report.header.itemName).toLowerCase().replace(/\s+/g, "-")}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReportGenerator({
  generateFn,
  label = "Informe IA",
}: {
  generateFn: () => Promise<{ error?: string; report?: GeneratedReport }>;
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);

  function generate() {
    setError(null);
    setOpen(true);
    startTransition(async () => {
      const res = await generateFn();
      if (res.error) { setError(res.error); return; }
      setReport(res.report ?? null);
    });
  }

  async function handleExport(type: "pdf" | "docx") {
    if (!report) return;
    setExporting(type);
    try {
      if (type === "pdf") await exportPDF(report);
      else await exportDOCX(report);
    } finally {
      setExporting(null);
    }
  }

  const cardStyle: React.CSSProperties = {
    border: "1px solid var(--app-border)",
    borderRadius: "0.75rem",
    overflow: "hidden",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "0.875rem 1rem",
    backgroundColor: "var(--app-card-bg)",
    flexWrap: "wrap",
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "0.9375rem", color: "var(--app-body-text)" }}>
          <FileText style={{ width: "1rem", height: "1rem", color: "#6366f1" }} />
          {label}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          {report && (
            <>
              <button
                type="button"
                disabled={!!exporting}
                onClick={() => handleExport("pdf")}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem", fontSize: "0.8125rem", fontWeight: 500, border: "1px solid var(--app-border)", borderRadius: "0.375rem", backgroundColor: "var(--app-card-bg)", color: "var(--app-body-text)", cursor: exporting ? "not-allowed" : "pointer", opacity: exporting ? 0.6 : 1 }}
              >
                {exporting === "pdf" ? <Loader2 style={{ width: "0.875rem", height: "0.875rem", animation: "spin 1s linear infinite" }} /> : <Download style={{ width: "0.875rem", height: "0.875rem" }} />}
                PDF
              </button>
              <button
                type="button"
                disabled={!!exporting}
                onClick={() => handleExport("docx")}
                style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem", fontSize: "0.8125rem", fontWeight: 500, border: "1px solid var(--app-border)", borderRadius: "0.375rem", backgroundColor: "var(--app-card-bg)", color: "var(--app-body-text)", cursor: exporting ? "not-allowed" : "pointer", opacity: exporting ? 0.6 : 1 }}
              >
                {exporting === "docx" ? <Loader2 style={{ width: "0.875rem", height: "0.875rem", animation: "spin 1s linear infinite" }} /> : <Download style={{ width: "0.875rem", height: "0.875rem" }} />}
                DOCX
              </button>
            </>
          )}

          <button
            type="button"
            disabled={isPending}
            onClick={generate}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.875rem", fontSize: "0.8125rem", fontWeight: 500, border: "none", borderRadius: "0.375rem", backgroundColor: "#6366f1", color: "#fff", cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}
          >
            {isPending ? (
              <><Loader2 style={{ width: "0.875rem", height: "0.875rem", animation: "spin 1s linear infinite" }} /> Generando...</>
            ) : (
              <><RefreshCw style={{ width: "0.875rem", height: "0.875rem" }} /> {report ? "Regenerar" : "Generar informe"}</>
            )}
          </button>

          {report && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--app-text-muted)", display: "flex" }}
            >
              {open ? <ChevronUp style={{ width: "1rem", height: "1rem" }} /> : <ChevronDown style={{ width: "1rem", height: "1rem" }} />}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#b91c1c", backgroundColor: "#fef2f2", borderTop: "1px solid #fecaca" }}>
          {error}
        </p>
      )}

      {isPending && !report && (
        <div style={{ padding: "2rem", textAlign: "center", borderTop: "1px solid var(--app-border)" }}>
          <Loader2 style={{ width: "1.5rem", height: "1.5rem", margin: "0 auto", animation: "spin 1s linear infinite", color: "#6366f1" }} />
          <p style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
            Generando informe con IA...
          </p>
        </div>
      )}

      {report && open && (
        <div style={{ borderTop: "1px solid var(--app-border)", padding: "1rem", backgroundColor: "var(--app-content-bg)", maxHeight: "32rem", overflowY: "auto" }}>
          {/* Header metadata */}
          <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.5rem", padding: "0.75rem", marginBottom: "1rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.375rem 1.25rem" }}>
            {headerLines(report.header).map((line, i) => {
              const [label, ...rest] = line.split(": ");
              return (
                <div key={i}>
                  <p style={{ margin: 0, fontSize: "0.625rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--app-body-text)", fontWeight: 500, opacity: 0.85 }}>{rest.join(": ")}</p>
                </div>
              );
            })}
          </div>

          {/* Body */}
          <div style={{ fontSize: "0.8125rem", lineHeight: 1.65, opacity: 0.9 }}>
            <MarkdownRenderer content={report.body} />
          </div>
        </div>
      )}
    </div>
  );
}
