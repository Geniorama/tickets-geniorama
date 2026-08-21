"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Loader2 } from "lucide-react";
import type { AppKey } from "@/generated/prisma";
import { APP_ICONS } from "@/components/layout/nav-config";
import { APP_BY_KEY } from "@/lib/access/apps";

type SearchHit = {
  id: string;
  app: AppKey;
  kind: string;
  title: string;
  subtitle: string | null;
  href: string;
};

const MIN_LENGTH = 3;
/** Lo justo para que escribir no dispare una consulta por tecla. */
const DEBOUNCE_MS = 220;

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Descarta respuestas que llegan tarde y pisarían a una búsqueda más nueva. */
  const seq = useRef(0);

  useEffect(() => setMounted(true), []);

  // ⌘K / Ctrl+K desde cualquier sitio; Esc cierra.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      // El foco tiene que esperar a que el diálogo exista en el DOM.
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
    setQuery("");
    setResults([]);
    setActive(0);
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const id = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (id !== seq.current) return;
        setResults(Array.isArray(data.results) ? data.results : []);
        setActive(0);
      } catch {
        if (id === seq.current) setResults([]);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [query]);

  const ir = useCallback(
    (hit: SearchHit) => {
      setOpen(false);
      router.push(hit.href);
    },
    [router],
  );

  // Agrupado por módulo, conservando el orden en que llegó cada grupo.
  const grupos = useMemo(() => {
    const mapa = new Map<AppKey, SearchHit[]>();
    for (const hit of results) {
      const lista = mapa.get(hit.app);
      if (lista) lista.push(hit);
      else mapa.set(hit.app, [hit]);
    }
    return [...mapa.entries()];
  }, [results]);

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = results[active];
      if (hit) ir(hit);
    }
  }

  // Que la fila elegida con el teclado siga a la vista al bajar por la lista.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const q = query.trim();
  let indice = -1;

  const dialogo = (
    <div
      role="presentation"
      onClick={() => setOpen(false)}
      style={{
        position: "fixed", inset: 0, zIndex: 9600,
        backgroundColor: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "10vh 1rem 1rem",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar en toda la plataforma"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "40rem",
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.85rem",
          boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          maxHeight: "70vh",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.85rem 1rem", borderBottom: "1px solid var(--app-border)" }}>
          {loading
            ? <Loader2 style={{ width: "1.05rem", height: "1.05rem", color: "var(--app-text-muted)", animation: "spin 1s linear infinite" }} />
            : <Search style={{ width: "1.05rem", height: "1.05rem", color: "var(--app-text-muted)", flexShrink: 0 }} />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Buscar tickets, tareas, proyectos, cuentas…"
            aria-label="Qué buscas"
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontSize: "0.95rem", color: "var(--app-body-text)",
            }}
          />
          <kbd style={kbdStyle}>Esc</kbd>
        </div>

        <div ref={listRef} style={{ overflowY: "auto", padding: grupos.length > 0 ? "0.5rem" : 0 }}>
          {q.length < MIN_LENGTH ? (
            <p style={vacioStyle}>
              Escribe al menos {MIN_LENGTH} letras. Busca en todos los módulos a los que tienes acceso.
            </p>
          ) : loading && results.length === 0 ? (
            <p style={vacioStyle}>Buscando…</p>
          ) : results.length === 0 ? (
            <p style={vacioStyle}>Nada coincide con «{q}».</p>
          ) : (
            grupos.map(([app, hits]) => {
              const Icon = APP_ICONS[app];
              const nombre = APP_BY_KEY.get(app)?.name ?? app;
              return (
                <div key={app} style={{ marginBottom: "0.35rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.45rem 0.6rem 0.3rem" }}>
                    {Icon && <Icon style={{ width: "0.8rem", height: "0.8rem", color: "var(--app-icon-color)" }} />}
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--app-text-muted)" }}>
                      {nombre}
                    </span>
                  </div>

                  {hits.map((hit) => {
                    indice++;
                    const i = indice;
                    const seleccionado = i === active;
                    return (
                      <button
                        key={`${hit.app}-${hit.kind}-${hit.id}`}
                        type="button"
                        data-index={i}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => ir(hit)}
                        style={{
                          width: "100%", textAlign: "left", cursor: "pointer",
                          display: "flex", alignItems: "center", gap: "0.7rem",
                          padding: "0.55rem 0.6rem", borderRadius: "0.5rem",
                          border: "none",
                          backgroundColor: seleccionado ? "rgba(253,19,132,0.12)" : "transparent",
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--app-body-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {hit.title}
                          </span>
                          <span style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {[hit.kind, hit.subtitle].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        {seleccionado && (
                          <CornerDownLeft style={{ width: "0.85rem", height: "0.85rem", color: "#fd1384", flexShrink: 0 }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {results.length > 0 && (
          <div style={{ display: "flex", gap: "1rem", padding: "0.5rem 1rem", borderTop: "1px solid var(--app-border)", fontSize: "0.6875rem", color: "var(--app-text-muted)" }}>
            <span><kbd style={kbdStyle}>↑</kbd> <kbd style={kbdStyle}>↓</kbd> moverse</span>
            <span><kbd style={kbdStyle}>↵</kbd> abrir</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/*
        Parece un campo de búsqueda porque tiene que parecerlo. Como botón
        pequeño se perdía en una barra casi vacía: nadie busca un botón, se
        busca la caja donde escribir. Al pulsarla se abre la paleta, que es
        donde se escribe de verdad.
      */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar en toda la plataforma"
        title="Buscar (⌘K)"
        className="w-9 h-9 md:w-full md:h-auto justify-center md:justify-start"
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.55rem",
          maxWidth: "26rem",
          padding: "0.5rem 0.75rem", borderRadius: "0.6rem",
          border: "1px solid var(--app-border)",
          backgroundColor: "var(--app-content-bg)",
          color: "var(--app-text-muted)", cursor: "pointer", fontSize: "0.875rem",
          transition: "border-color 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#fd1384";
          e.currentTarget.style.color = "var(--app-body-text)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--app-border)";
          e.currentTarget.style.color = "var(--app-text-muted)";
        }}
      >
        <Search style={{ width: "1rem", height: "1rem", flexShrink: 0 }} />
        <span className="hidden md:inline" style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          Buscar tickets, tareas, proyectos…
        </span>
        <kbd className="hidden md:inline" style={{ ...kbdStyle, flexShrink: 0 }}>⌘K</kbd>
      </button>

      {mounted && open && createPortal(dialogo, document.body)}
    </>
  );
}

const kbdStyle: React.CSSProperties = {
  fontFamily: "inherit", fontSize: "0.6875rem",
  padding: "0.1rem 0.35rem", borderRadius: "0.25rem",
  border: "1px solid var(--app-border)", color: "var(--app-text-muted)",
};

const vacioStyle: React.CSSProperties = {
  fontSize: "0.8125rem", color: "var(--app-text-muted)",
  padding: "1.5rem 1rem", textAlign: "center",
};
