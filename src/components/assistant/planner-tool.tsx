"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles, X, Upload, FileText, AlertCircle, Check, Trash2, ChevronDown, ChevronRight, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import {
  getPlannerOptions, generatePlan, applyPlan,
  type PlannerOptions, type GeneratedPlan, type PlannerFile,
} from "@/actions/planner.actions";
import { ProviderToggle } from "@/components/assistant/provider-toggle";
import type { AiProvider } from "@/lib/ai";
import type { Priority } from "@/generated/prisma";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "BAJA", label: "Baja" },
  { value: "MEDIA", label: "Media" },
  { value: "ALTA", label: "Alta" },
  { value: "CRITICA", label: "Crítica" },
];

type EditableTask = {
  include: boolean;
  titulo: string;
  descripcion: string;
  prioridad: Priority;
  assignedToId: string | null;
  estimacionHoras: number | null;
  fechaInicio: string;
  fechaFin: string;
  subtareas: string[];
  expanded: boolean;
};

type NewProjectFields = {
  name: string;
  description: string;
  companyId: string;
  managerId: string;
  startDate: string;
  dueDate: string;
  isPrivate: boolean;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function PlannerLauncher({
  isAdmin,
  presetProjectId,
  label = "Planificar con IA",
}: {
  isAdmin: boolean;
  presetProjectId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          backgroundColor: "#4f46e5",
          color: "#ffffff",
          padding: "0.5rem 1rem",
          borderRadius: "0.5rem",
          fontSize: "0.875rem",
          fontWeight: 500,
          border: "none",
          cursor: "pointer",
        }}
      >
        <Sparkles style={{ width: "1rem", height: "1rem" }} />
        {label}
      </button>
      {open && (
        <PlannerModal isAdmin={isAdmin} presetProjectId={presetProjectId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function PlannerModal({
  isAdmin,
  presetProjectId,
  onClose,
}: {
  isAdmin: boolean;
  presetProjectId?: string;
  onClose: () => void;
}) {
  const [options, setOptions] = useState<PlannerOptions | null>(null);
  const [mode, setMode] = useState<"new" | "existing">(isAdmin && !presetProjectId ? "new" : "existing");
  const [projectId, setProjectId] = useState(presetProjectId ?? "");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [project, setProject] = useState<NewProjectFields | null>(null);
  const [result, setResult] = useState<{ projectId: string; message: string } | null>(null);

  useEffect(() => {
    getPlannerOptions().then((res) => {
      if ("error" in res) setError(res.error);
      else setOptions(res);
    });
  }, []);

  function handleGenerate() {
    setError(null);
    if (mode === "existing" && !projectId) {
      setError("Selecciona un proyecto.");
      return;
    }
    if (!text.trim() && !file) {
      setError("Pega el texto o sube un archivo.");
      return;
    }

    startTransition(async () => {
      let plannerFile: PlannerFile | undefined;
      if (file) {
        if (file.size > 7 * 1024 * 1024) {
          setError("El archivo supera 7 MB.");
          return;
        }
        const dataBase64 = await fileToBase64(file);
        plannerFile = { name: file.name, mimeType: file.type || "application/octet-stream", dataBase64 };
      }

      const res = await generatePlan({ text: text.trim() || undefined, file: plannerFile, mode, projectId: projectId || undefined, provider });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setPlan(res);
      setTasks(
        res.tareas.map((t) => ({
          include: true,
          titulo: t.titulo,
          descripcion: t.descripcion,
          prioridad: t.prioridad,
          assignedToId: t.assignedToId,
          estimacionHoras: t.estimacionHoras,
          fechaInicio: t.fechaInicio ?? "",
          fechaFin: t.fechaFin ?? "",
          subtareas: t.subtareas,
          expanded: false,
        }))
      );
      if (res.proyecto) {
        setProject({
          name: res.proyecto.nombre,
          description: res.proyecto.descripcion,
          companyId: res.proyecto.empresaId ?? "",
          managerId: "",
          startDate: res.proyecto.fechaInicio ?? "",
          dueDate: res.proyecto.fechaFin ?? "",
          isPrivate: false,
        });
      } else {
        setProject(null);
      }
    });
  }

  function handleApply() {
    setError(null);
    const included = tasks.filter((t) => t.include && t.titulo.trim());
    if (included.length === 0) {
      setError("Selecciona al menos una tarea.");
      return;
    }
    if (mode === "new" && (!project || !project.name.trim())) {
      setError("El nombre del proyecto es requerido.");
      return;
    }

    startTransition(async () => {
      const res = await applyPlan({
        mode,
        projectId: mode === "existing" ? projectId : undefined,
        newProject:
          mode === "new" && project
            ? {
                name: project.name.trim(),
                description: project.description.trim(),
                companyId: project.companyId || null,
                managerId: project.managerId || null,
                startDate: project.startDate || null,
                dueDate: project.dueDate || null,
                isPrivate: project.isPrivate,
              }
            : undefined,
        tasks: included.map((t) => ({
          titulo: t.titulo.trim(),
          descripcion: t.descripcion,
          prioridad: t.prioridad,
          assignedToId: t.assignedToId,
          estimacionHoras: t.estimacionHoras,
          startDate: t.fechaInicio || null,
          dueDate: t.fechaFin || null,
          subtareas: t.subtareas,
        })),
      });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setResult({ projectId: res.projectId, message: res.message });
    });
  }

  function updateTask(i: number, patch: Partial<EditableTask>) {
    setTasks((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  const staff = options?.staff ?? [];
  const includedCount = tasks.filter((t) => t.include).length;

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
            Planificar con IA
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
                href={`/proyectos/${result.projectId}`}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Ver proyecto <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : !plan ? (
            /* ── Paso 1: entrada ── */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">Modelo de IA</span>
                <ProviderToggle value={provider} onChange={setProvider} disabled={isPending} />
              </div>

              {isAdmin && !presetProjectId && (
                <div className="flex gap-2">
                  <ModeButton active={mode === "new"} onClick={() => setMode("new")} label="Nuevo proyecto" />
                  <ModeButton active={mode === "existing"} onClick={() => setMode("existing")} label="Proyecto existente" />
                </div>
              )}

              {mode === "existing" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Proyecto destino</label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    disabled={!!presetProjectId}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white disabled:bg-gray-50"
                  >
                    <option value="">Selecciona un proyecto…</option>
                    {(options?.projects ?? []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Documento (notas de reunión, brief…)</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={8}
                  placeholder="Pega aquí el texto del documento…"
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
                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando plan…</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Generar plan</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ── Paso 2: revisión ── */
            <div className="space-y-5">
              <p className="text-sm text-gray-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3.5 py-2.5">{plan.resumen}</p>

              {/* Proyecto nuevo */}
              {project && (
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nuevo proyecto</p>
                  <input
                    value={project.name}
                    onChange={(e) => setProject({ ...project, name: e.target.value })}
                    placeholder="Nombre del proyecto"
                    className="w-full text-sm font-medium border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <textarea
                    value={project.description}
                    onChange={(e) => setProject({ ...project, description: e.target.value })}
                    rows={2}
                    placeholder="Descripción"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-y"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Empresa</label>
                      <select
                        value={project.companyId}
                        onChange={(e) => setProject({ ...project, companyId: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2 bg-white"
                      >
                        <option value="">Sin empresa</option>
                        {(options?.companies ?? []).map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Encargado</label>
                      <select
                        value={project.managerId}
                        onChange={(e) => setProject({ ...project, managerId: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2 bg-white"
                      >
                        <option value="">Sin encargado</option>
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Inicio</label>
                      <input type="date" value={project.startDate} onChange={(e) => setProject({ ...project, startDate: e.target.value })} className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Límite</label>
                      <input type="date" value={project.dueDate} onChange={(e) => setProject({ ...project, dueDate: e.target.value })} className="w-full text-sm border border-gray-300 rounded-lg px-2.5 py-2" />
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" checked={project.isPrivate} onChange={(e) => setProject({ ...project, isPrivate: e.target.checked })} />
                    Proyecto privado
                  </label>
                </div>
              )}

              {/* Tareas */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Tareas ({includedCount}/{tasks.length})
                </p>
                <div className="space-y-2">
                  {tasks.map((t, i) => (
                    <div key={i} className={`border rounded-xl p-3 ${t.include ? "border-indigo-200 bg-white" : "border-gray-200 bg-gray-50 opacity-60"}`}>
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={t.include}
                          onChange={(e) => updateTask(i, { include: e.target.checked })}
                          className="mt-1.5"
                        />
                        <div className="flex-1 min-w-0 space-y-2">
                          <input
                            value={t.titulo}
                            onChange={(e) => updateTask(i, { titulo: e.target.value })}
                            className="w-full text-sm font-medium border border-gray-200 rounded-lg px-2.5 py-1.5"
                          />
                          <textarea
                            value={t.descripcion}
                            onChange={(e) => updateTask(i, { descripcion: e.target.value })}
                            rows={2}
                            placeholder="Descripción de la tarea"
                            className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 resize-y"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={t.prioridad}
                              onChange={(e) => updateTask(i, { prioridad: e.target.value as Priority })}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                            >
                              {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                            <select
                              value={t.assignedToId ?? ""}
                              onChange={(e) => updateTask(i, { assignedToId: e.target.value || null })}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white max-w-[12rem]"
                            >
                              <option value="">Sin asignar</option>
                              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            {t.subtareas.length > 0 && (
                              <button
                                type="button"
                                onClick={() => updateTask(i, { expanded: !t.expanded })}
                                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600"
                              >
                                {t.expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                {t.subtareas.length} subtareas
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                              Inicio
                              <input
                                type="date"
                                value={t.fechaInicio}
                                onChange={(e) => updateTask(i, { fechaInicio: e.target.value })}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                              />
                            </label>
                            <label className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                              Límite
                              <input
                                type="date"
                                value={t.fechaFin}
                                onChange={(e) => updateTask(i, { fechaFin: e.target.value })}
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
                                    onClick={() => updateTask(i, { subtareas: t.subtareas.filter((_, idx) => idx !== si) })}
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
                <><Check className="w-4 h-4" /> {mode === "new" ? "Crear proyecto y tareas" : "Crear tareas"}</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function ModeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${
        active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
      }`}
    >
      {label}
    </button>
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
