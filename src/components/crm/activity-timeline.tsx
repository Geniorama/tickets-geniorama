"use client";

import { useState, useTransition } from "react";
import { Phone, Mail, Users, MessageCircle, StickyNote, Plus, X, Trash2 } from "lucide-react";
import type { ActivityType } from "@/generated/prisma";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS } from "@/lib/crm/deals";
import { logActivity, deleteActivity } from "@/actions/crm.actions";
import { formatDateTimeLong } from "@/lib/format-date";

export type TimelineActivity = {
  id: string;
  type: ActivityType;
  summary: string;
  notes: string | null;
  occurredAt: Date | string;
  contact: { name: string } | null;
  deal: { id: string; title: string } | null;
  createdBy: { name: string };
};

const ICONS: Record<ActivityType, React.ElementType> = {
  NOTA:     StickyNote,
  LLAMADA:  Phone,
  CORREO:   Mail,
  REUNION:  Users,
  WHATSAPP: MessageCircle,
};

const COLORS: Record<ActivityType, string> = {
  NOTA:     "#64748b",
  LLAMADA:  "#3b82f6",
  CORREO:   "#8b5cf6",
  REUNION:  "#f59e0b",
  WHATSAPP: "#22c55e",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.7rem", fontSize: "0.875rem",
  borderRadius: "0.5rem", border: "1px solid var(--app-border)",
  backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
};

/**
 * El historial de la cuenta: llamadas, correos, reuniones y notas.
 *
 * Se apunta en línea porque se escribe justo después de colgar. Si la
 * interacción fue sobre una oportunidad concreta se enlaza, y así aparece
 * también en su ficha sin duplicar el registro.
 */
export function ActivityTimeline({
  accountId,
  activities,
  contacts,
  deals,
  canEdit,
  /** En la ficha de una oportunidad ya se sabe cuál es: no se pregunta. */
  lockedDealId,
}: {
  accountId: string;
  activities: TimelineActivity[];
  contacts: { id: string; name: string }[];
  deals: { id: string; title: string }[];
  canEdit: boolean;
  lockedDealId?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate(formData: FormData) {
    setError(null);
    if (lockedDealId) formData.set("dealId", lockedDealId);
    startTransition(async () => {
      const result = await logActivity(accountId, formData);
      if (result?.error) setError(result.error);
      else setAdding(false);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => { await deleteActivity(id, accountId); });
  }

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
        borderRadius: "0.75rem", padding: "1.25rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)" }}>
          Actividad ({activities.length})
        </h2>
        {canEdit && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.3rem",
              fontSize: "0.8125rem", fontWeight: 500, color: "#fd1384",
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}
          >
            <Plus style={{ width: "0.9rem", height: "0.9rem" }} />
            Apuntar
          </button>
        )}
      </div>

      {adding && (
        <form action={handleCreate} style={{ marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <select name="type" defaultValue="LLAMADA" style={inputStyle} aria-label="Tipo de interacción">
              {ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>)}
            </select>
            <input
              name="occurredAt" type="datetime-local" style={inputStyle}
              aria-label="Cuándo ocurrió"
              title="Si se deja vacío se apunta como ahora mismo"
            />
          </div>

          <input name="summary" placeholder="Qué pasó, en una línea" required style={inputStyle} autoFocus />
          <textarea name="notes" rows={2} placeholder="Detalle (opcional)" style={{ ...inputStyle, resize: "vertical" }} />

          <div style={{ display: "grid", gridTemplateColumns: lockedDealId ? "1fr" : "1fr 1fr", gap: "0.5rem" }}>
            <select name="contactId" defaultValue="" style={inputStyle} aria-label="Con quién">
              <option value="">Sin contacto</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {!lockedDealId && (
              <select name="dealId" defaultValue="" style={inputStyle} aria-label="Sobre qué oportunidad">
                <option value="">Sin oportunidad</option>
                {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
            )}
          </div>

          {error && <p style={{ fontSize: "0.8125rem", color: "#b91c1c" }}>{error}</p>}

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="submit"
              disabled={isPending}
              style={{
                backgroundColor: "#fd1384", color: "#fff", border: "none",
                borderRadius: "0.5rem", padding: "0.45rem 1rem", fontSize: "0.8125rem",
                fontWeight: 500, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? "Guardando..." : "Apuntar"}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setError(null); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.3rem",
                background: "none", border: "1px solid var(--app-border)",
                borderRadius: "0.5rem", padding: "0.45rem 0.8rem",
                fontSize: "0.8125rem", color: "var(--app-text-muted)", cursor: "pointer",
              }}
            >
              <X style={{ width: "0.85rem", height: "0.85rem" }} />
              Cancelar
            </button>
          </div>
        </form>
      )}

      {activities.length === 0 && !adding ? (
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
          Sin actividad registrada. Lo que se apunte aquí es lo que quedará dentro de tres meses.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {activities.map((a, i) => {
            const Icon = ICONS[a.type];
            const color = COLORS[a.type];
            const ultima = i === activities.length - 1;

            return (
              <div key={a.id} style={{ display: "flex", gap: "0.75rem" }}>
                {/* Carril del hilo: el icono y la línea que une un hito con el siguiente */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: "1.75rem", height: "1.75rem", borderRadius: "9999px",
                      backgroundColor: `${color}22`, color,
                    }}
                  >
                    <Icon style={{ width: "0.85rem", height: "0.85rem" }} />
                  </span>
                  {!ultima && <span style={{ flex: 1, width: "1px", backgroundColor: "var(--app-border)", marginTop: "0.15rem" }} />}
                </div>

                <div style={{ flex: 1, minWidth: 0, paddingBottom: ultima ? 0 : "1rem" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                    <p style={{ flex: 1, fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)", lineHeight: 1.35 }}>
                      {a.summary}
                    </p>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        disabled={isPending}
                        aria-label={`Eliminar «${a.summary}»`}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: "0.1rem", flexShrink: 0 }}
                      >
                        <Trash2 style={{ width: "0.85rem", height: "0.85rem" }} />
                      </button>
                    )}
                  </div>

                  <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.15rem" }}>
                    {[
                      ACTIVITY_TYPE_LABELS[a.type],
                      formatDateTimeLong(a.occurredAt),
                      a.contact ? `con ${a.contact.name}` : null,
                      !lockedDealId && a.deal ? `sobre «${a.deal.title}»` : null,
                      `— ${a.createdBy.name}`,
                    ].filter(Boolean).join(" · ")}
                  </p>

                  {a.notes && (
                    <p style={{ fontSize: "0.8125rem", color: "var(--app-nav-text)", marginTop: "0.35rem", whiteSpace: "pre-wrap" }}>
                      {a.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
