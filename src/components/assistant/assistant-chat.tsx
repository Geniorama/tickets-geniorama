"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Sparkles, Send, AlertCircle, Check, CircleSlash, ListChecks, FilePlus2, ArrowRightCircle, RotateCcw } from "lucide-react";
import {
  chatWithAssistant,
  executeAssistantAction,
  type ChatMessage,
  type ProposedAction,
} from "@/actions/assistant.actions";
import { MarkdownText } from "@/components/ui/markdown-text";
import { ProviderToggle } from "@/components/assistant/provider-toggle";
import type { AiProvider } from "@/lib/ai";

type ActionState = "idle" | "running" | "done" | "error";

type AssistantMessage = {
  role: "user" | "assistant";
  text: string;
  actions?: ProposedAction[];
};

const SUGGESTIONS = [
  "¿En qué tarea debería enfocarme hoy?",
  "¿Qué tareas y tickets tengo pendientes por revisar?",
  "Ayúdame a priorizar mis tareas pendientes",
  "Divide mi tarea más urgente en pasos de checklist",
  "¿Tengo tareas vencidas o en riesgo?",
  "Resume el estado de mis tickets activos",
  "¿Qué comentarios recientes requieren mi atención?",
  "Dame un plan para hoy con mis tareas y revisiones",
];

export function AssistantChat({ userName }: { userName: string }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Estado por acción: key = `${msgIndex}:${actionIndex}`
  const [actionStates, setActionStates] = useState<Record<string, { state: ActionState; message?: string }>>({});
  const [provider, setProvider] = useState<AiProvider>("gemini");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isPending]);

  function runChat(history: ChatMessage[], useProvider: AiProvider) {
    setError(null);
    startTransition(async () => {
      const res = await chatWithAssistant(history, useProvider);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", text: res.reply, actions: res.actions }]);
    });
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;

    const nextMessages: AssistantMessage[] = [...messages, { role: "user", text: trimmed }];
    setMessages(nextMessages);
    setInput("");

    runChat(nextMessages.map((m) => ({ role: m.role, text: m.text })), provider);
  }

  // Reenvía el último mensaje con el proveedor alternativo (Gemini ↔ OpenAI).
  function retryWithAlternative() {
    if (isPending || messages.length === 0) return;
    const alt: AiProvider = provider === "gemini" ? "openai" : "gemini";
    setProvider(alt);
    runChat(messages.map((m) => ({ role: m.role, text: m.text })), alt);
  }

  function runAction(msgIndex: number, actionIndex: number, action: ProposedAction) {
    const key = `${msgIndex}:${actionIndex}`;
    setActionStates((prev) => ({ ...prev, [key]: { state: "running" } }));
    startTransition(async () => {
      const res = await executeAssistantAction(action);
      if ("error" in res) {
        setActionStates((prev) => ({ ...prev, [key]: { state: "error", message: res.error } }));
      } else {
        setActionStates((prev) => ({ ...prev, [key]: { state: "done", message: res.message } }));
      }
    });
  }

  function dismissAction(msgIndex: number, actionIndex: number) {
    const key = `${msgIndex}:${actionIndex}`;
    setActionStates((prev) => ({ ...prev, [key]: { state: "done", message: "Descartada" } }));
  }

  const empty = messages.length === 0;

  return (
    <div
      className="flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden"
      style={{ height: "calc(100vh - 11rem)", minHeight: "32rem" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 shrink-0">
        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100">
          <Sparkles className="w-4 h-4 text-indigo-600" />
        </span>
        <div>
          <p className="font-semibold text-gray-900 leading-tight">Asistente IA</p>
          <p className="text-xs text-gray-400 leading-tight">Diagnostica, planea y avanza tus tareas</p>
        </div>
        <div className="ml-auto">
          <ProviderToggle value={provider} onChange={setProvider} disabled={isPending} />
        </div>
      </div>

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        {empty && (
          <div className="max-w-lg mx-auto text-center mt-6">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-100 mb-3">
              <Sparkles className="w-6 h-6 text-indigo-600" />
            </span>
            <p className="text-gray-800 font-medium">Hola {userName.split(" ")[0]} 👋</p>
            <p className="text-sm text-gray-500 mt-1 mb-5">
              Puedo ayudarte a diagnosticar, priorizar y avanzar tus tareas. Pregúntame algo o prueba:
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="text-left text-sm text-gray-700 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200 rounded-lg px-3.5 py-2.5 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] bg-indigo-600 text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 whitespace-pre-wrap">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-[88%] w-full bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <MarkdownText text={m.text} />
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {m.actions.map((a, ai) => (
                      <ActionCard
                        key={ai}
                        action={a}
                        status={actionStates[`${i}:${ai}`]}
                        onConfirm={() => runAction(i, ai, a)}
                        onDismiss={() => dismissAction(i, ai)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {isPending && (
          <div className="flex justify-start">
            <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2 text-gray-400 text-sm">
              <span className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              Pensando...
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-2">
            <p className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </p>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={retryWithAlternative}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reintentar con {provider === "gemini" ? "OpenAI" : "Gemini"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-end gap-2 px-4 py-3 border-t border-gray-100 shrink-0"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Escribe tu mensaje..."
          className="flex-1 resize-none text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 max-h-32"
        />
        <button
          type="submit"
          disabled={isPending || !input.trim()}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors shrink-0"
          aria-label="Enviar"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

function ActionCard({
  action,
  status,
  onConfirm,
  onDismiss,
}: {
  action: ProposedAction;
  status?: { state: ActionState; message?: string };
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const state = status?.state ?? "idle";
  const { icon: Icon, label, detail } = describeAction(action);

  return (
    <div className="bg-white border border-indigo-200 rounded-xl px-3.5 py-2.5">
      <div className="flex items-start gap-2.5">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 shrink-0 mt-0.5">
          <Icon className="w-3.5 h-3.5 text-indigo-600" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{detail}</p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        {state === "idle" && (
          <>
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Confirmar
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center gap-1.5 text-gray-400 text-xs font-medium px-2.5 py-1.5 rounded-lg hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <CircleSlash className="w-3.5 h-3.5" />
              Descartar
            </button>
          </>
        )}
        {state === "running" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
            Aplicando...
          </span>
        )}
        {state === "done" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <Check className="w-3.5 h-3.5" />
            {status?.message ?? "Hecho"}
          </span>
        )}
        {state === "error" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-red-600 font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            {status?.message ?? "Error"}
          </span>
        )}
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PROGRESO: "En progreso",
  EN_REVISION: "En revisión",
  COMPLETADO: "Completado",
};
const PRIORITY_LABELS: Record<string, string> = {
  BAJA: "Baja", MEDIA: "Media", ALTA: "Alta", CRITICA: "Crítica",
};

function describeAction(action: ProposedAction): {
  icon: React.ElementType;
  label: string;
  detail: string;
} {
  switch (action.kind) {
    case "status":
      return {
        icon: ArrowRightCircle,
        label: `Cambiar estado a «${STATUS_LABELS[action.estado] ?? action.estado}»`,
        detail: action.taskLabel,
      };
    case "checklist":
      return {
        icon: ListChecks,
        label: `Agregar ${action.items.length} ${action.items.length === 1 ? "ítem" : "ítems"} al checklist`,
        detail: `${action.taskLabel} — ${action.items.join(", ")}`,
      };
    case "create":
      return {
        icon: FilePlus2,
        label: `Crear tarea: «${action.titulo}»`,
        detail: `En ${action.projectLabel} · Prioridad ${PRIORITY_LABELS[action.prioridad] ?? action.prioridad}`,
      };
  }
}
