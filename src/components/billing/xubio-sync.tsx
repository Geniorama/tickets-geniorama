"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Link2Off, Plus, AlertTriangle } from "lucide-react";
import type { Pareja } from "@/lib/xubio/match";
import { vincularCliente, desvincularCliente, crearEnXubio } from "@/actions/xubio.actions";

/**
 * Empresas de aquí frente a clientes de Xubio.
 *
 * Nada se crea ni se enlaza sin que alguien lo pulse, y antes de crear se
 * enseña exactamente qué se va a mandar. Dar de alta clientes en la
 * contabilidad de golpe es como se acaba con fichas duplicadas que después hay
 * que limpiar a mano, y una ficha duplicada acaba en una factura a nombre
 * equivocado.
 */

const COMO_SE_ENCONTRO: Record<NonNullable<Pareja["por"]>, string> = {
  vinculo: "enlazada",
  nit: "por NIT",
  nombre: "por nombre",
};

export function XubioSync({ parejas, muestra }: { parejas: Pareja[]; muestra: unknown }) {
  const [error, setError] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<Pareja | null>(null);
  const [verCrudo, setVerCrudo] = useState(false);
  const router = useRouter();

  async function correr(
    id: string,
    fn: () => Promise<{ error?: string; detalle?: string; success?: boolean } | undefined>,
  ) {
    setError(null); setDetalle(null); setOcupado(id);
    try {
      const r = await fn();
      if (r?.error) { setError(r.error); setDetalle(r.detalle ?? null); return; }
      router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  const enlazadas = parejas.filter((p) => p.cliente);
  const sueltas = parejas.filter((p) => !p.cliente);

  return (
    <div>
      {error && (
        <div style={{ backgroundColor: "#dc262614", border: "1px solid #dc262655", borderRadius: "0.75rem", padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--app-nav-text)" }}>{error}</p>
          {detalle && (
            <pre style={{ margin: "0.4rem 0 0", fontSize: "0.7rem", color: "var(--app-text-muted)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {detalle}
            </pre>
          )}
        </div>
      )}

      <h2 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.6rem" }}>
        Sin correspondencia ({sueltas.length})
      </h2>

      {sueltas.length === 0 ? (
        <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>
          Todas las empresas a las que se les cobra tienen su cliente en Xubio.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          {sueltas.map((p) => (
            <div
              key={p.empresa.id}
              style={{
                padding: "0.65rem 0.85rem", borderRadius: "0.5rem",
                border: `1px solid ${p.ambiguo ? "#f59e0b55" : "var(--app-border)"}`,
                backgroundColor: p.ambiguo ? "#f59e0b0d" : "transparent",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: "10rem", fontSize: "0.875rem", color: "var(--app-body-text)" }}>
                  {p.empresa.name}
                  <span style={{ color: "var(--app-text-muted)", fontSize: "0.75rem" }}>
                    {p.empresa.taxId ? ` · NIT ${p.empresa.taxId}` : " · sin NIT"}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => { setConfirmando(p); setError(null); }}
                  disabled={ocupado !== null}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "0.3rem",
                    fontSize: "0.75rem", padding: "0.3rem 0.7rem", borderRadius: "0.45rem",
                    border: "none", backgroundColor: "#fd1384", color: "#fff", cursor: "pointer",
                  }}
                >
                  <Plus style={{ width: "0.75rem", height: "0.75rem" }} />
                  Crear en Xubio
                </button>

                <EnlazarAMano
                  companyId={p.empresa.id}
                  ocupado={ocupado !== null}
                  onEnlazar={(xid) => correr(p.empresa.id, () => vincularCliente(p.empresa.id, xid))}
                />
              </div>

              {p.ambiguo && (
                <p style={{ margin: "0.4rem 0 0", fontSize: "0.75rem", color: "#b45309", display: "flex", gap: "0.35rem", alignItems: "flex-start" }}>
                  <AlertTriangle style={{ width: "0.8rem", height: "0.8rem", flexShrink: 0, marginTop: "0.1rem" }} />
                  Hay varios clientes en Xubio que le encajan. No se empareja sola: elige tú cuál,
                  o crea uno nuevo.
                </p>
              )}
              {!p.ambiguo && p.empresa.xubioClientId && (
                <p style={{ margin: "0.4rem 0 0", fontSize: "0.75rem", color: "#b45309" }}>
                  Estaba enlazada con <code>{p.empresa.xubioClientId}</code>, pero ese cliente ya no
                  está en Xubio. Puede que lo borraran allá.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "1.75rem 0 0.6rem" }}>
        Con correspondencia ({enlazadas.length})
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {enlazadas.map((p) => (
          <div
            key={p.empresa.id}
            style={{
              display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap",
              padding: "0.55rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--app-border)",
            }}
          >
            <Link2 style={{ width: "0.85rem", height: "0.85rem", color: "#22c55e", flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: "10rem", fontSize: "0.875rem", color: "var(--app-body-text)" }}>
              {p.empresa.name}
              <span style={{ color: "var(--app-text-muted)", fontSize: "0.75rem" }}>
                {" → "}{p.cliente!.nombre}
                {p.por && ` · ${COMO_SE_ENCONTRO[p.por]}`}
              </span>
            </span>

            {/* Emparejada por NIT o nombre pero sin guardar: hasta que no se
                confirma, la próxima sincronización vuelve a adivinar. */}
            {p.por !== "vinculo" ? (
              <button
                type="button"
                onClick={() => correr(p.empresa.id, () => vincularCliente(p.empresa.id, p.cliente!.id))}
                disabled={ocupado !== null}
                style={{
                  fontSize: "0.75rem", padding: "0.3rem 0.7rem", borderRadius: "0.45rem",
                  border: "1px solid #22c55e", background: "none", color: "#22c55e", cursor: "pointer",
                }}
              >
                Confirmar enlace
              </button>
            ) : (
              <button
                type="button"
                onClick={() => correr(p.empresa.id, () => desvincularCliente(p.empresa.id))}
                disabled={ocupado !== null}
                aria-label={`Desenlazar ${p.empresa.name}`}
                style={{ background: "none", border: "none", padding: 0, color: "var(--app-text-muted)", cursor: "pointer", display: "inline-flex" }}
              >
                <Link2Off style={{ width: "0.85rem", height: "0.85rem" }} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* La respuesta cruda: los nombres de los campos de Xubio cambian entre
          países y no están documentados fuera de su explorador. Verlos aquí es
          lo que permite ajustar la lectura sin adivinar. */}
      {muestra != null && (
        <div style={{ marginTop: "2rem" }}>
          <button
            type="button"
            onClick={() => setVerCrudo((v) => !v)}
            style={{ background: "none", border: "none", padding: 0, fontSize: "0.75rem", color: "var(--app-text-muted)", cursor: "pointer", textDecoration: "underline" }}
          >
            {verCrudo ? "Ocultar" : "Ver"} cómo llega un cliente de Xubio
          </button>
          {verCrudo && (
            <pre style={{ marginTop: "0.5rem", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--app-border)", fontSize: "0.7rem", color: "var(--app-text-muted)", overflowX: "auto" }}>
              {JSON.stringify(muestra, null, 2)}
            </pre>
          )}
        </div>
      )}

      {confirmando && (
        <div
          role="dialog"
          aria-label="Confirmar creación en Xubio"
          style={{
            position: "fixed", inset: 0, zIndex: 9600, backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
          }}
          onClick={() => setConfirmando(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: "26rem", backgroundColor: "var(--app-card-bg)",
              border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "1.25rem",
              display: "flex", flexDirection: "column", gap: "0.85rem",
            }}
          >
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--app-body-text)", margin: 0 }}>
                Crear este cliente en Xubio
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: "0.3rem 0 0" }}>
                Se dará de alta en tu contabilidad. Comprueba el NIT: corregirlo después es más
                trabajo que escribirlo bien ahora.
              </p>
            </div>

            <div style={{ padding: "0.7rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--app-border)", fontSize: "0.8125rem" }}>
              <p style={{ margin: 0, color: "var(--app-body-text)", fontWeight: 600 }}>{confirmando.empresa.name}</p>
              <p style={{ margin: "0.2rem 0 0", color: confirmando.empresa.taxId ? "var(--app-text-muted)" : "#b45309" }}>
                {confirmando.empresa.taxId ? `NIT ${confirmando.empresa.taxId}` : "Sin NIT — se creará sin identificación tributaria"}
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => {
                  const p = confirmando;
                  setConfirmando(null);
                  correr(p.empresa.id, () => crearEnXubio(p.empresa.id));
                }}
                style={{
                  backgroundColor: "#fd1384", color: "#fff", border: "none", borderRadius: "0.5rem",
                  padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
                }}
              >
                Crear en Xubio
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(null)}
                style={{
                  border: "1px solid var(--app-border)", background: "none", borderRadius: "0.5rem",
                  padding: "0.5rem 0.9rem", fontSize: "0.875rem", color: "var(--app-text-muted)", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Pegar el identificador de un cliente que ya existe allá. */
function EnlazarAMano({
  companyId,
  ocupado,
  onEnlazar,
}: {
  companyId: string;
  ocupado: boolean;
  onEnlazar: (xubioClientId: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState("");

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        disabled={ocupado}
        style={{ background: "none", border: "none", padding: 0, fontSize: "0.75rem", color: "var(--app-text-muted)", cursor: "pointer", textDecoration: "underline" }}
      >
        Enlazar con uno existente
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: "0.3rem", alignItems: "center" }}>
      <input
        autoFocus
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && valor.trim()) onEnlazar(valor.trim()); }}
        placeholder="Id del cliente en Xubio"
        aria-label={`Identificador de Xubio para ${companyId}`}
        style={{
          padding: "0.3rem 0.5rem", fontSize: "0.75rem", width: "11rem",
          borderRadius: "0.4rem", border: "1px solid var(--app-border)",
          backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
        }}
      />
      <button
        type="button"
        onClick={() => valor.trim() && onEnlazar(valor.trim())}
        disabled={ocupado || !valor.trim()}
        style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem", borderRadius: "0.4rem", border: "none", backgroundColor: "#22c55e", color: "#fff", cursor: "pointer" }}
      >
        Enlazar
      </button>
      <button
        type="button"
        onClick={() => { setAbierto(false); setValor(""); }}
        style={{ background: "none", border: "none", padding: 0, fontSize: "0.75rem", color: "var(--app-text-muted)", cursor: "pointer" }}
      >
        ×
      </button>
    </span>
  );
}
