"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Send, Trash2 } from "lucide-react";

const ACCENT = "#fd1384";
/** Lo mismo que acepta el servidor (unos 10 MB): se corta solo al llegar aquí. */
const MAX_SECONDS = 120;

/** El formato que mejor graba cada navegador: Chrome y Firefox webm/ogg, Safari mp4. */
function pickMimeType(): string | undefined {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return options.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
}

export function voiceRecordingSupported(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * El botón del micrófono y la barra de grabación. Graba con MediaRecorder y
 * entrega el audio a `onRecorded`; se descarta con la papelera. Al llegar a
 * los 2 minutos se envía solo.
 */
export function VoiceRecorder({
  disabled, onRecorded, onRecordingChange, onError,
}: {
  disabled?: boolean;
  onRecorded: (audio: Blob) => void;
  onRecordingChange: (recording: boolean) => void;
  onError: (message: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sendOnStopRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Si el componente desaparece grabando, se suelta el micrófono.
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  function setRec(value: boolean) {
    setRecording(value);
    onRecordingChange(value);
  }

  async function start() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError("No pudimos usar el micrófono. Revisa que el navegador tenga permiso para usarlo.");
      return;
    }
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    sendOnStopRef.current = false;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      setRec(false);
      if (sendOnStopRef.current && chunksRef.current.length > 0) {
        onRecorded(new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" }));
      }
      chunksRef.current = [];
    };
    recorderRef.current = recorder;
    recorder.start();
    setSeconds(0);
    setRec(true);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stop(send: boolean) {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    sendOnStopRef.current = send;
    recorder.stop();
  }

  // Al llegar al máximo se envía sola.
  useEffect(() => {
    if (recording && seconds >= MAX_SECONDS) stop(true);
  });

  const round: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: "2.5rem", height: "2.5rem", borderRadius: "0.75rem", flexShrink: 0, cursor: "pointer",
  };

  if (!recording) {
    return (
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        aria-label="Grabar nota de voz"
        title="Grabar nota de voz"
        style={{ ...round, border: "none", backgroundColor: ACCENT, color: "#ffffff", opacity: disabled ? 0.4 : 1 }}
      >
        <Mic style={{ width: "1.125rem", height: "1.125rem" }} />
      </button>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <button
        type="button"
        onClick={() => stop(false)}
        aria-label="Descartar nota de voz"
        title="Descartar"
        style={{ ...round, border: "1px solid var(--app-border)", background: "none", color: "var(--app-text-muted)" }}
      >
        <Trash2 style={{ width: "1rem", height: "1rem" }} />
      </button>
      <div
        role="status"
        style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem", height: "2.5rem", padding: "0 0.875rem", borderRadius: "0.75rem", border: "1px solid var(--app-border)", backgroundColor: "var(--app-content-bg)", fontSize: "0.875rem", color: "var(--app-body-text)" }}
      >
        <span aria-hidden style={{ width: "0.5rem", height: "0.5rem", borderRadius: "9999px", backgroundColor: "#dc2626", animation: "pulse 1.2s ease-in-out infinite" }} />
        Grabando {fmt(seconds)}
        <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>máx. {fmt(MAX_SECONDS)}</span>
      </div>
      <button
        type="button"
        onClick={() => stop(true)}
        aria-label="Enviar nota de voz"
        title="Enviar"
        style={{ ...round, border: "none", backgroundColor: ACCENT, color: "#ffffff" }}
      >
        <Send style={{ width: "1rem", height: "1rem" }} />
      </button>
    </div>
  );
}
