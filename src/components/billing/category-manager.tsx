"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, EyeOff, Eye, Check, X } from "lucide-react";
import {
  createBillingCategory, renameBillingCategory, toggleBillingCategory,
} from "@/actions/billing-categories.actions";

/**
 * El catálogo de categorías.
 *
 * Se pueden crear y renombrar sin desplegar, por lo mismo que las etiquetas: si
 * dar de alta un servicio nuevo dependiera de un despliegue, acabaría metido en
 * el concepto de la línea y contabilidad seguiría sin poder repartir nada.
 *
 * Y no se borran, se retiran: los cobros de años anteriores tienen que seguir
 * catalogados o un informe ya cerrado cambiaría de cifras.
 */

export type CategoriaCatalogo = {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  _count: { lines: number };
};

const COLORES = ["#3b82f6", "#8b5cf6", "#f59e0b", "#22c55e", "#dc2626", "#64748b"];

export function CategoryManager({
  categorias,
  canManage,
}: {
  categorias: CategoriaCatalogo[];
  canManage: boolean;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);
  const [nueva, setNueva] = useState("");
  const [color, setColor] = useState(COLORES[0]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function guardarNombre(id: string) {
    const limpio = nombre.trim();
    if (!limpio) return setEditando(null);
    setError(null);
    startTransition(async () => {
      const r = await renameBillingCategory(id, limpio);
      if (r?.error) return setError(r.error);
      setEditando(null);
    });
  }

  function crear() {
    const limpio = nueva.trim();
    if (!limpio) return;
    setError(null);
    startTransition(async () => {
      const r = await createBillingCategory(limpio, color);
      if (r?.error) return setError(r.error);
      setNueva("");
      setCreando(false);
    });
  }

  function alternar(id: string, activa: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await toggleBillingCategory(id, activa);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div>
      <h2 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
        Categorías
      </h2>

      {error && <p style={{ fontSize: "0.8125rem", color: "#b91c1c", marginBottom: "0.6rem" }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {categorias.map((c) => (
          <div
            key={c.id}
            style={{
              display: "flex", alignItems: "center", gap: "0.6rem",
              padding: "0.55rem 0.75rem", borderRadius: "0.5rem",
              border: "1px solid var(--app-border)",
              opacity: c.isActive ? 1 : 0.55,
            }}
          >
            <span style={{ width: "0.6rem", height: "0.6rem", borderRadius: "9999px", backgroundColor: c.color, flexShrink: 0 }} />

            {editando === c.id ? (
              <>
                <input
                  autoFocus
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); guardarNombre(c.id); }
                    if (e.key === "Escape") setEditando(null);
                  }}
                  maxLength={60}
                  style={{
                    flex: 1, padding: "0.3rem 0.5rem", fontSize: "0.875rem",
                    borderRadius: "0.4rem", border: "1px solid var(--app-border)",
                    backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
                  }}
                />
                <button
                  type="button" onClick={() => guardarNombre(c.id)} disabled={isPending}
                  aria-label="Guardar nombre"
                  style={{ background: "none", border: "none", padding: 0, color: "#22c55e", cursor: "pointer", display: "inline-flex" }}
                >
                  <Check style={{ width: "0.9rem", height: "0.9rem" }} />
                </button>
                <button
                  type="button" onClick={() => setEditando(null)}
                  aria-label="Cancelar"
                  style={{ background: "none", border: "none", padding: 0, color: "var(--app-text-muted)", cursor: "pointer", display: "inline-flex" }}
                >
                  <X style={{ width: "0.9rem", height: "0.9rem" }} />
                </button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: "0.875rem", color: "var(--app-body-text)" }}>
                  {c.name}
                  {!c.isActive && (
                    <span style={{ color: "var(--app-text-muted)", fontSize: "0.75rem" }}> · retirada</span>
                  )}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", whiteSpace: "nowrap" }}>
                  {c._count.lines} {c._count.lines === 1 ? "línea" : "líneas"}
                </span>
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setEditando(c.id); setNombre(c.name); setError(null); }}
                      aria-label={`Renombrar ${c.name}`}
                      style={{ background: "none", border: "none", padding: 0, color: "var(--app-text-muted)", cursor: "pointer", display: "inline-flex" }}
                    >
                      <Pencil style={{ width: "0.85rem", height: "0.85rem" }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => alternar(c.id, !c.isActive)}
                      disabled={isPending}
                      aria-label={c.isActive ? `Retirar ${c.name}` : `Reponer ${c.name}`}
                      title={c.isActive ? "Dejar de ofrecerla en cobros nuevos" : "Volver a ofrecerla"}
                      style={{ background: "none", border: "none", padding: 0, color: "var(--app-text-muted)", cursor: "pointer", display: "inline-flex" }}
                    >
                      {c.isActive
                        ? <EyeOff style={{ width: "0.85rem", height: "0.85rem" }} />
                        : <Eye style={{ width: "0.85rem", height: "0.85rem" }} />}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {canManage && (creando ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.6rem", flexWrap: "wrap" }}>
          <input
            autoFocus
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); crear(); } }}
            placeholder="Nombre de la categoría"
            maxLength={60}
            style={{
              padding: "0.4rem 0.6rem", fontSize: "0.8125rem", width: "14rem",
              borderRadius: "0.45rem", border: "1px solid var(--app-border)",
              backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
            }}
          />
          <div style={{ display: "flex", gap: "0.2rem" }}>
            {COLORES.map((c) => (
              <button
                key={c} type="button" onClick={() => setColor(c)} aria-label={`Color ${c}`}
                style={{
                  width: "1.1rem", height: "1.1rem", borderRadius: "9999px", backgroundColor: c,
                  cursor: "pointer",
                  border: color === c ? "2px solid var(--app-body-text)" : "1px solid var(--app-border)",
                }}
              />
            ))}
          </div>
          <button
            type="button" onClick={crear} disabled={isPending || !nueva.trim()}
            style={{ fontSize: "0.8125rem", padding: "0.4rem 0.8rem", borderRadius: "0.45rem", border: "none", backgroundColor: "#fd1384", color: "#fff", cursor: "pointer" }}
          >
            Crear
          </button>
          <button
            type="button" onClick={() => { setCreando(false); setNueva(""); setError(null); }}
            style={{ fontSize: "0.8125rem", padding: "0.4rem 0.6rem", borderRadius: "0.45rem", border: "1px solid var(--app-border)", background: "none", color: "var(--app-text-muted)", cursor: "pointer" }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setCreando(true); setError(null); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem", marginTop: "0.6rem",
            background: "none", border: "none", padding: 0,
            fontSize: "0.8125rem", fontWeight: 500, color: "#fd1384", cursor: "pointer",
          }}
        >
          <Plus style={{ width: "0.9rem", height: "0.9rem" }} />
          Nueva categoría
        </button>
      ))}
    </div>
  );
}
