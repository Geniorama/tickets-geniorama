"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { MessageSquarePlus, X } from "lucide-react";
import { submitFeedback } from "@/actions/feedback.actions";
import { runAction } from "@/lib/run-action";
import {
  FEEDBACK_MAX_MESSAGE,
  FEEDBACK_MAX_SCREENSHOT_BYTES,
  FEEDBACK_SCREENSHOT_TYPES,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABELS,
  type FeedbackTypeKey,
} from "@/lib/feedback";

/**
 * Botón flotante «Feedback» (AG·P-1): disponible en todas las pantallas del
 * dashboard para cualquier rol. Captura sin preguntar la pantalla, el navegador
 * y el tamaño de la ventana; quién es y de qué empresa lo pone el servidor.
 */
export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackTypeKey>("IDEA");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function reset() {
    setType("IDEA");
    setMessage("");
    setFile(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function close() {
    setOpen(false);
    setSent(null);
    setError(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    if (!picked) return setFile(null);
    if (!FEEDBACK_SCREENSHOT_TYPES.includes(picked.type)) {
      setError("La captura debe ser una imagen (PNG, JPG, WebP o GIF)");
      e.target.value = "";
      return setFile(null);
    }
    if (picked.size > FEEDBACK_MAX_SCREENSHOT_BYTES) {
      setError("La captura no puede pasar de 5 MB");
      e.target.value = "";
      return setFile(null);
    }
    setError(null);
    setFile(picked);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("type", type);
    fd.set("message", message);
    // La pantalla desde la que se escribe, no la del formulario.
    fd.set("pageUrl", window.location.href);
    fd.set("userAgent", navigator.userAgent);
    fd.set("viewport", `${window.innerWidth}x${window.innerHeight}`);
    if (file) fd.set("screenshot", file);

    setError(null);
    startTransition(async () => {
      const r = await runAction(() => submitFeedback(fd), { timeoutMs: file ? 60_000 : 30_000 });
      if (!r.ok) return setError(r.error);
      if ("error" in r.data && r.data.error) return setError(r.data.error);
      setSent(
        r.data && "screenshotFailed" in r.data && r.data.screenshotFailed
          ? "Recibimos tu mensaje, pero no pudimos subir la captura. Gracias por escribirnos."
          : "¡Gracias! Recibimos tu mensaje.",
      );
      reset();
    });
  }

  // Sin sesión no hay dashboard, y esto solo se monta dentro de él.
  if (!pathname) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 print:hidden"
        aria-label="Enviar feedback"
      >
        <MessageSquarePlus className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-4 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Enviar feedback"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Enviar feedback</h2>
                <p className="text-xs text-gray-500">
                  Cuéntanos qué viste. Adjuntamos la pantalla en la que estás para ubicarlo mejor.
                </p>
              </div>
              <button type="button" onClick={close} className="rounded p-1 text-gray-400 hover:text-gray-600" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>

            {sent ? (
              <div className="space-y-4">
                <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{sent}</p>
                <button
                  type="button"
                  onClick={close}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de feedback">
                  {FEEDBACK_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={type === t}
                      onClick={() => setType(t)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        type === t
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                          : "border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {FEEDBACK_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>

                <div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={FEEDBACK_MAX_MESSAGE}
                    rows={5}
                    required
                    placeholder="¿Qué pasó o qué se te ocurre?"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Captura de pantalla <span className="font-normal text-gray-400">(opcional)</span>
                  </label>
                  <input
                    ref={fileInput}
                    type="file"
                    accept={FEEDBACK_SCREENSHOT_TYPES.join(",")}
                    onChange={onFile}
                    className="block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
                  />
                </div>

                {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || message.trim().length < 5}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isPending ? "Enviando…" : "Enviar"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
