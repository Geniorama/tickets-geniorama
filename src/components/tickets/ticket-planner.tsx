"use client";

/**
 * «Planificar tickets con IA» — el mismo flujo de dos pasos que el
 * planificador de proyectos: se pega un texto o se sube un documento, la IA
 * propone los tickets, y **nada se crea hasta revisarlos aquí**. Cada tarjeta
 * es editable y se puede desmarcar; lo que sale del modal es lo que quedó en
 * pantalla, no lo que devolvió el modelo.
 */

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles, X, Upload, FileText, AlertCircle, Check, Trash2, ChevronDown, ChevronRight, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import {
  getTicketPlannerOptions, generateTicketPlan, applyTicketPlan,
  type TicketPlannerOptions, type GeneratedTicketPlan, type TicketPlannerFile,
} from "@/actions/ticket-planner.actions";
import { ProviderToggle } from "@/components/assistant/provider-toggle";
import type { AiProvider } from "@/lib/ai";
import type { Priority } from "@/generated/prisma";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "BAJA", label: "Baja" },
  { value: "MEDIA", label: "Media" },
  { value: "ALTA", label: "Alta" },
  { value: "CRITICA", label: "Crítica" },
];

type EditableTicket = {
  include: boolean;
  titulo: string;
  descripcion: string;
  prioridad: Priority;
  categoria: string;
  assignedToId: string | null;
  siteId: string | null;
  fechaLimite: string;
  subtareas: string[];
  expanded: boolean;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function TicketPlannerLauncher({ label = "Planificar con IA" }: { label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-white text-indigo-600 border border-indigo-200 px-3 py-2 sm:px-4 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">IA</span>
      </button>
      {open && <TicketPlannerModal onClose={() => setOpen(false)} />}
    </>
  );
}

function TicketPlannerModal({ onClose }: { onClose: () => void }) {
  const [options, setOptions] = useState<TicketPlannerOptions | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [clientId, setClientId] = useState("");
  const [planId, setPlanId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [plan, setPlan] = useState<GeneratedTicketPlan | null>(null);
  const [tickets, setTickets] = useState<EditableTicket[]>([]);
  const [result, setResult] = useState<{ message: string } | null>(null);

  useEffect(() => {
    getTicketPlannerOptions().then((res) => {
      if ("error" in res) setError(res.error);
      else setOptions(res);
    });
  }, []);

  const selectedClient = options?.clients.find((c) => c.id === clientId) ?? null;
  // Plan y sitio se acotan a la empresa del cliente, igual que en «Nuevo ticket».
  const visiblePlans = selectedClient
    ? (options?.plans ?? []).filter((p) => selectedClient.companyIds.includes(p.companyId))
    : (options?.plans ?? []);
  const visibleSites = selectedClient
    ? (options?.sites ?? []).filter((s) => selectedClient.companyIds.includes(s.companyId))
    : (options?.sites ?? []);

  function handleGenerate() {
    setError(null);
    if (!text.trim() && !file) {
      setError("Pega el texto o sube un archivo.");
      return;
    }

    startTransition(async () => {
      let plannerFile: TicketPlannerFile | undefined;
      if (file) {
        if (file.size > 7 * 1024 * 1024) {
          setError("El archivo supera 7 MB.");
          return;
        }
        const dataBase64 = await fileToBase64(file);
        plannerFile = { name: file.name, mimeType: file.type || "application/octet-stream", dataBase64 };
      }

      const res = await generateTicketPlan({
        text: text.trim() || undefined,
        file: plannerFile,
        clientId: clientId || undefined,
        provider,
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setPlan(res);
      // Si la IA reconoció al cliente y nadie lo había fijado, se propone: es
      // una sugerencia más del plan y se puede cambiar antes de crear.
      if (!clientId && res.clienteId) setClientId(res.clienteId);
      setTickets(
        res.tickets.map((t) => ({
          include: true,
          titulo: t.titulo,
          descripcion: t.descripcion,
          prioridad: t.prioridad,
          categoria: t.categoria ?? "",
          assignedToId: t.assignedToId,
          siteId: t.siteId,
          fechaLimite: t.fechaLimite ?? "",
          subtareas: t.subtareas,
          expanded: false,
        }))
      );
    });
  }

  function handleApply() {
    setError(null);
    const included = tickets.filter((t) => t.include && t.titulo.trim());
    if (included.length === 0) {
      setError("Selecciona al menos un ticket.");
      return;
    }

    startTransition(async () => {
      const res = await applyTicketPlan({
        clientId: clientId || null,
        planId: planId || null,
        tickets: included.map((t) => ({
          titulo: t.titulo.trim(),
          descripcion: t.descripcion,
          prioridad: t.prioridad,
          categoria: t.categoria || null,
          assignedToId: t.assignedToId,
          siteId: t.siteId,
          fechaLimite: t.fechaLimite || null,
          subtareas: t.subtareas,
        })),
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult({ message: res.message });
    });
  }

  function updateTicket(i: number, patch: Partial<EditableTicket>) {
    setTickets((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  const staff = options?.staff ?? [];
  const canAssign = options?.canAssign ?? false;
  const includedCount = tickets.filter((t) => t.include).length;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl" style={{ maxHeight: "88vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100 shrink-0">
          <span className="flex items-center gap-2 font-semibold text-gray-900">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Planificar tickets con IA
          </span>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 flex-1">
          {/* ── Resultado final ── */}
          {result ? (
            <div className="text-center py-10">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-green-100 mb-3">
                <Check className="w-6 h-6 text-green-600" />
              </span>
              <p className="font-medium text-gray-900">{result.message}</p>
              <Link
                href="/tickets"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Ver tickets <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : !plan ? (
            /* ── Paso 1: entrada ── */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">Modelo de IA</span>
                <ProviderToggle value={provider} onChange={setProvider} disabled={isPending} />
              </div>

              {canAssign && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cliente (opcional)</label>
                  <select
                    value={clientId}
                    onChange={(e) => { setClientId(e.target.value); setPlanId(""); }}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="">Que lo deduzca la IA del documento…</option>
                    {(options?.clients ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Documento (correo del cliente, acta de reunión, listado de fallos…)
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={8}
                  placeholder="Pega aquí el texto…"
                  className="w-full resize-y text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-indigo-600">
                  <Upload className="w-4 h-4" />
                  {file ? "Cambiar archivo" : "Subir archivo (PDF, Word, TXT · máx 7 MB)"}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.md,application/pdf"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {file && (
                  <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-gray-500">
                    <FileText className="w-3.5 h-3.5" /> {file.name}
                    <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}
              </div>

              {error && <ErrorBox message={error} />}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isPending || !options}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isPending ? (
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Leyendo el documento…</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Proponer tickets</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ── Paso 2: revisión ── */
            <div className="space-y-5">
              <p className="text-sm text-gray-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3.5 py-2.5">{plan.resumen}</p>

              {canAssign && (
                <div className="border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cliente</label>
                    <select
                      value={clientId}
                      onChange={(e) => { setClientId(e.target.value); setPlanId(""); }}
                      className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2 bg-white"
                    >
                      <option value="">Sin cliente</option>
                      {(options?.clients ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {plan.clienteNombre && (
                      <p className="mt-1 text-xs text-indigo-600">La IA reconoció: {plan.clienteNombre}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Plan</label>
                    <select
                      value={planId}
                      onChange={(e) => setPlanId(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2 bg-white"
                    >
                      <option value="">Sin plan</option>
                      {visiblePlans.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Tickets ({includedCount}/{tickets.length})
                </p>
                <div className="space-y-2">
                  {tickets.map((t, i) => (
                    <div key={i} className={`border rounded-xl p-3 ${t.include ? "border-indigo-200 bg-white" : "border-gray-200 bg-gray-50 opacity-60"}`}>
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={t.include}
                          onChange={(e) => updateTicket(i, { include: e.target.checked })}
                          className="mt-1.5"
                        />
                        <div className="flex-1 min-w-0 space-y-2">
                          <input
                            value={t.titulo}
                            onChange={(e) => updateTicket(i, { titulo: e.target.value })}
                            className="w-full text-sm font-medium border border-gray-200 rounded-lg px-2.5 py-1.5"
                          />
                          <textarea
                            value={t.descripcion}
                            onChange={(e) => updateTicket(i, { descripcion: e.target.value })}
                            rows={3}
                            placeholder="Descripción del ticket"
                            className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 resize-y"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={t.prioridad}
                              onChange={(e) => updateTicket(i, { prioridad: e.target.value as Priority })}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                            >
                              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                            <select
                              value={t.categoria}
                              onChange={(e) => updateTicket(i, { categoria: e.target.value })}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                            >
                              <option value="">Sin categoría</option>
                              {(options?.categories ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                            {canAssign && (
                              <select
                                value={t.assignedToId ?? ""}
                                onChange={(e) => updateTicket(i, { assignedToId: e.target.value || null })}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white max-w-[12rem]"
                              >
                                <option value="">Sin asignar</option>
                                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            )}
                            {t.subtareas.length > 0 && (
                              <button
                                type="button"
                                onClick={() => updateTicket(i, { expanded: !t.expanded })}
                                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600"
                              >
                                {t.expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                {t.subtareas.length} subtareas
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={t.siteId ?? ""}
                              onChange={(e) => updateTicket(i, { siteId: e.target.value || null })}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white max-w-[14rem]"
                            >
                              <option value="">Sin sitio</option>
                              {visibleSites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <label className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                              Límite
                              <input
                                type="date"
                                value={t.fechaLimite}
                                onChange={(e) => updateTicket(i, { fechaLimite: e.target.value })}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                              />
                            </label>
                          </div>
                          {t.expanded && (
                            <ul className="mt-1 ml-1 space-y-1">
                              {t.subtareas.map((s, si) => (
                                <li key={si} className="flex items-center gap-2 text-xs text-gray-600">
                                  <span className="text-indigo-400">•</span>
                                  <span className="flex-1">{s}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateTicket(i, { subtareas: t.subtareas.filter((_, idx) => idx !== si) })}
                                    className="text-gray-300 hover:text-red-500"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {error && <ErrorBox message={error} />}
            </div>
          )}
        </div>

        {/* Footer (solo en revisión) */}
        {plan && !result && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => { setPlan(null); setError(null); }} className="text-sm text-gray-500 hover:text-gray-700">
                ← Volver
              </button>
              <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
                Cancelar
              </button>
            </div>
            <button
              type="button"
              onClick={handleApply}
              disabled={isPending}
              className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creando…</>
              ) : (
                <><Check className="w-4 h-4" /> Crear {includedCount} {includedCount === 1 ? "ticket" : "tickets"}</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {message}
    </p>
  );
}
