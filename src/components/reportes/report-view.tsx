"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileDown, Printer, Filter, Clock, Ticket,
  CheckCircle2, AlertCircle, BarChart3,
} from "lucide-react";
import { formatDate } from "@/lib/format-date";
import { formatHours } from "@/lib/plans";

// ── Types ────────────────────────────────────────────────────
export type TicketRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  category: string | null;
  createdAt: string;
  client:     { name: string } | null;
  assignedTo: { name: string } | null;
  plan:       { name: string; type: string } | null;
  totalMs: number;
};

export type PlanRow = {
  id: string;
  name: string;
  type: string;
  company: { name: string };
  totalHours: number | null;
  usedHours: number;
  effectiveExpiresAt: string | null;
  isActive: boolean;
  ticketCount: number;
};

// ── Helpers ──────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  ABIERTO:    "Abierto",
  EN_PROGRESO:"En progreso",
  EN_REVISION:"En revisión",
  CERRADO:    "Cerrado",
};

const PRIORITY_LABELS: Record<string, string> = {
  BAJA: "Baja", MEDIA: "Media", ALTA: "Alta", CRITICA: "Crítica",
};

function msToHHMM(ms: number): string {
  if (ms <= 0) return "—";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function csvEscape(val: string | null | undefined): string {
  return `"${String(val ?? "").replace(/"/g, '""')}"`;
}

// ── CSV export ───────────────────────────────────────────────
function buildCSV(tickets: TicketRow[], plans: PlanRow[], isClient: boolean): string {
  const lines: string[] = [];

  lines.push("REPORTE GENIORAMA TICKETS");
  lines.push(`Generado:,${new Date().toLocaleDateString("es-CO")}`);
  lines.push("");

  // Plans section
  if (plans.length > 0) {
    lines.push("PLANES");
    const planHeaders = isClient
      ? ["Plan", "Tipo", "Horas usadas", "Horas totales", "% Consumido", "Caducidad", "Estado", "Tickets"]
      : ["Plan", "Empresa", "Tipo", "Horas usadas", "Horas totales", "% Consumido", "Caducidad", "Estado", "Tickets"];
    lines.push(planHeaders.join(","));

    for (const p of plans) {
      const pct = p.type === "BOLSA_HORAS" && p.totalHours
        ? Math.round((p.usedHours / p.totalHours) * 100)
        : null;
      const estado = !p.isActive
        ? "Inactivo"
        : p.effectiveExpiresAt && new Date(p.effectiveExpiresAt) < new Date()
          ? "Expirado"
          : p.type === "BOLSA_HORAS" && p.totalHours && p.usedHours >= p.totalHours
            ? "Agotado"
            : "Activo";

      const row = isClient
        ? [
            csvEscape(p.name),
            csvEscape(p.type === "BOLSA_HORAS" ? "Bolsa de horas" : "Soporte mensual"),
            csvEscape(p.type === "BOLSA_HORAS" ? formatHours(p.usedHours) : "—"),
            csvEscape(p.totalHours ? formatHours(p.totalHours) : "—"),
            csvEscape(pct !== null ? `${pct}%` : "—"),
            csvEscape(p.effectiveExpiresAt ? formatDate(p.effectiveExpiresAt) : "Sin caducidad"),
            csvEscape(estado),
            String(p.ticketCount),
          ]
        : [
            csvEscape(p.name),
            csvEscape(p.company.name),
            csvEscape(p.type === "BOLSA_HORAS" ? "Bolsa de horas" : "Soporte mensual"),
            csvEscape(p.type === "BOLSA_HORAS" ? formatHours(p.usedHours) : "—"),
            csvEscape(p.totalHours ? formatHours(p.totalHours) : "—"),
            csvEscape(pct !== null ? `${pct}%` : "—"),
            csvEscape(p.effectiveExpiresAt ? formatDate(p.effectiveExpiresAt) : "Sin caducidad"),
            csvEscape(estado),
            String(p.ticketCount),
          ];
      lines.push(row.join(","));
    }
    lines.push("");
  }

  // Tickets section
  lines.push("TICKETS");
  const ticketHeaders = isClient
    ? ["#", "Título", "Estado", "Prioridad", "Categoría", "Plan", "Tiempo total", "Fecha creación"]
    : ["#", "Título", "Estado", "Prioridad", "Categoría", "Cliente", "Asignado a", "Plan", "Tiempo total", "Fecha creación"];
  lines.push(ticketHeaders.join(","));

  tickets.forEach((t, i) => {
    const row = isClient
      ? [
          String(i + 1),
          csvEscape(t.title),
          csvEscape(STATUS_LABELS[t.status] ?? t.status),
          csvEscape(PRIORITY_LABELS[t.priority] ?? t.priority),
          csvEscape(t.category),
          csvEscape(t.plan?.name),
          csvEscape(msToHHMM(t.totalMs)),
          csvEscape(formatDate(t.createdAt)),
        ]
      : [
          String(i + 1),
          csvEscape(t.title),
          csvEscape(STATUS_LABELS[t.status] ?? t.status),
          csvEscape(PRIORITY_LABELS[t.priority] ?? t.priority),
          csvEscape(t.category),
          csvEscape(t.client?.name),
          csvEscape(t.assignedTo?.name),
          csvEscape(t.plan?.name),
          csvEscape(msToHHMM(t.totalMs)),
          csvEscape(formatDate(t.createdAt)),
        ];
    lines.push(row.join(","));
  });

  return lines.join("\n");
}

function downloadCSV(content: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `reporte-geniorama-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ────────────────────────────────────────────────
export function ReportView({
  tickets,
  plans,
  isClient,
  initialFrom,
  initialTo,
}: {
  tickets:     TicketRow[];
  plans:       PlanRow[];
  isClient:    boolean;
  initialFrom: string;
  initialTo:   string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [from, setFrom] = useState(initialFrom);
  const [to,   setTo]   = useState(initialTo);

  const totalMs     = tickets.reduce((s, t) => s + t.totalMs, 0);
  const openCount   = tickets.filter((t) => t.status !== "CERRADO").length;
  const closedCount = tickets.filter((t) => t.status === "CERRADO").length;

  function applyFilter() {
    startTransition(() => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to)   params.set("to", to);
      router.push(`/reportes?${params.toString()}`);
    });
  }

  function clearFilter() {
    setFrom(""); setTo("");
    startTransition(() => router.push("/reportes"));
  }

  const inputCls =
    "border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 no-print">
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCSV(buildCSV(tickets, plans, isClient))}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Exportar CSV
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 no-print">
        <div className="flex items-end gap-3 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400 mb-2 shrink-0" />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </div>
          <button
            onClick={applyFilter}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Aplicar
          </button>
          {(initialFrom || initialTo) && (
            <button onClick={clearFilter} className="text-sm text-gray-400 hover:text-gray-600">
              Limpiar filtros
            </button>
          )}
          {(initialFrom || initialTo) && (
            <span className="text-xs text-gray-500 ml-auto">
              Período: {initialFrom ? formatDate(initialFrom) : "—"} → {initialTo ? formatDate(initialTo) : "—"}
            </span>
          )}
        </div>
      </div>

      {/* ── Print header (only visible on print) ── */}
      <div className="hidden print-block mb-6">
        <h1 className="text-2xl font-bold">Reporte Geniorama Tickets</h1>
        <p className="text-sm text-gray-500">
          Generado el {formatDate(new Date().toISOString())}
          {(initialFrom || initialTo) && ` · Período: ${initialFrom ? formatDate(initialFrom) : "inicio"} — ${initialTo ? formatDate(initialTo) : "hoy"}`}
        </p>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon={<Ticket className="w-5 h-5" />} label="Total tickets" value={String(tickets.length)} color="indigo" />
        <SummaryCard icon={<Clock className="w-5 h-5" />} label="Tiempo total" value={msToHHMM(totalMs)} color="purple" />
        <SummaryCard icon={<AlertCircle className="w-5 h-5" />} label="Abiertos" value={String(openCount)} color="amber" />
        <SummaryCard icon={<CheckCircle2 className="w-5 h-5" />} label="Cerrados" value={String(closedCount)} color="green" />
      </div>

      {/* ── Plans ── */}
      {plans.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-800">Consumo de planes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Plan</th>
                  {!isClient && <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Empresa</th>}
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Uso de horas</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Caducidad</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Tickets</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {plans.map((p) => {
                  const pct = p.type === "BOLSA_HORAS" && p.totalHours
                    ? Math.min(100, Math.round((p.usedHours / p.totalHours) * 100))
                    : null;
                  const expired = p.effectiveExpiresAt && new Date(p.effectiveExpiresAt) < new Date();
                  const exhausted = p.type === "BOLSA_HORAS" && p.totalHours && p.usedHours >= p.totalHours;
                  const estado = !p.isActive ? "Inactivo" : expired ? "Expirado" : exhausted ? "Agotado" : "Activo";
                  const estadoColor: Record<string, string> = {
                    Activo:   "bg-green-50 text-green-700",
                    Expirado: "bg-red-50 text-red-700",
                    Agotado:  "bg-orange-50 text-orange-700",
                    Inactivo: "bg-gray-100 text-gray-500",
                  };
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{p.name}</td>
                      {!isClient && <td className="px-5 py-3 text-gray-600">{p.company.name}</td>}
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.type === "BOLSA_HORAS" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                          {p.type === "BOLSA_HORAS" ? "Bolsa de horas" : "Soporte mensual"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {p.type === "BOLSA_HORAS" && p.totalHours !== null ? (
                          <div className="min-w-[140px]">
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>{formatHours(p.usedHours)} / {formatHours(p.totalHours)}</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${pct! >= 100 ? "bg-red-500" : pct! >= 80 ? "bg-orange-400" : "bg-indigo-500"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">
                        {p.effectiveExpiresAt ? formatDate(p.effectiveExpiresAt) : <span className="text-gray-400">Sin caducidad</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-700 text-center">{p.ticketCount}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${estadoColor[estado]}`}>{estado}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Tickets ── */}
      <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
          <Ticket className="w-4 h-4 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-800">
            Detalle de tickets <span className="text-gray-400 font-normal text-sm">({tickets.length})</span>
          </h2>
        </div>
        {tickets.length === 0 ? (
          <p className="px-5 py-10 text-center text-gray-500 text-sm">
            No hay tickets en el período seleccionado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Título</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Prioridad</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Categoría</th>
                  {!isClient && <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Cliente</th>}
                  {!isClient && <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Asignado a</th>}
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Tiempo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.map((t, i) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[220px]">
                      <span className="line-clamp-2">{t.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.category ?? <span className="text-gray-400">—</span>}</td>
                    {!isClient && <td className="px-4 py-3 text-gray-600">{t.client?.name ?? <span className="text-gray-400">—</span>}</td>}
                    {!isClient && <td className="px-4 py-3 text-gray-600">{t.assignedTo?.name ?? <span className="text-gray-400">—</span>}</td>}
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {t.plan ? (
                        <span>
                          {t.plan.name}
                          <span className={`ml-1 px-1 py-0.5 rounded text-[10px] ${t.plan.type === "BOLSA_HORAS" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                            {t.plan.type === "BOLSA_HORAS" ? "BH" : "SM"}
                          </span>
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700 text-xs">{msToHHMM(t.totalMs)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────
function SummaryCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "indigo" | "purple" | "amber" | "green";
}) {
  const colors = {
    indigo: "text-indigo-500 bg-indigo-50",
    purple: "text-purple-500 bg-purple-50",
    amber:  "text-amber-500 bg-amber-50",
    green:  "text-green-500 bg-green-50",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ABIERTO:     "bg-blue-50 text-blue-700",
    EN_PROGRESO: "bg-amber-50 text-amber-700",
    EN_REVISION: "bg-purple-50 text-purple-700",
    CERRADO:     "bg-green-50 text-green-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    BAJA:    "bg-gray-100 text-gray-600",
    MEDIA:   "bg-blue-50 text-blue-700",
    ALTA:    "bg-orange-50 text-orange-700",
    CRITICA: "bg-red-50 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[priority] ?? "bg-gray-100 text-gray-600"}`}>
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}
