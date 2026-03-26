"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X, Clock, FileText, CheckSquare, ExternalLink, Hourglass } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/format-date";

export type OverdueItem = {
  id: string;
  title: string;
  dueDate: string; // ISO string
  type: "ticket" | "tarea";
  inReview: boolean;
  href: string;
};

interface OverdueAlertProps {
  items: OverdueItem[];
  userId: string;
}

function getSessionKey(userId: string) {
  return `overdue-alert-${userId}`;
}

export function OverdueAlert({ items, userId }: OverdueAlertProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (items.length === 0) return;
    if (!sessionStorage.getItem(getSessionKey(userId))) {
      setOpen(true);
    }
  }, [items.length, userId]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        sessionStorage.setItem(getSessionKey(userId), "1");
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, userId]);

  if (!open) return null;

  const dismiss = () => {
    sessionStorage.setItem(getSessionKey(userId), "1");
    setOpen(false);
  };

  const urgent = items.filter((i) => !i.inReview);
  const inReview = items.filter((i) => i.inReview);

  const urgentTickets = urgent.filter((i) => i.type === "ticket");
  const urgentTareas = urgent.filter((i) => i.type === "tarea");
  const reviewTickets = inReview.filter((i) => i.type === "ticket");
  const reviewTareas = inReview.filter((i) => i.type === "tarea");

  // Subtitle del header
  const headerSubtitle =
    urgent.length > 0 && inReview.length > 0
      ? `${urgent.length} requieren acción · ${inReview.length} en espera de revisión`
      : urgent.length > 0
        ? "Requieren tu atención inmediata"
        : "Vencidos pero pendientes de revisión por otra persona";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        padding: "1rem",
      }}
    >
      <div
        style={{
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "1rem",
          width: "100%",
          maxWidth: "520px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #dc2626, #b91c1c)",
            padding: "1.25rem 1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              width: "2.5rem",
              height: "2.5rem",
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertTriangle style={{ width: "1.25rem", height: "1.25rem", color: "#ffffff" }} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#ffffff" }}>
              {items.length === 1
                ? "Tienes 1 elemento vencido"
                : `Tienes ${items.length} elementos vencidos`}
            </h2>
            <p
              style={{
                margin: "0.125rem 0 0",
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.8)",
              }}
            >
              {headerSubtitle}
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Cerrar"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.375rem",
              borderRadius: "0.375rem",
              color: "rgba(255,255,255,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.15s, background-color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#ffffff";
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,255,255,0.15)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.7)";
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
            }}
          >
            <X style={{ width: "1.125rem", height: "1.125rem" }} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            overflowY: "auto",
            padding: "1.25rem 1.5rem",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* Urgentes (no en revisión) */}
          {urgent.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {urgentTickets.length > 0 && (
                <ItemGroup label={`Tickets (${urgentTickets.length})`} items={urgentTickets} onNavigate={dismiss} />
              )}
              {urgentTareas.length > 0 && (
                <ItemGroup label={`Tareas (${urgentTareas.length})`} items={urgentTareas} onNavigate={dismiss} />
              )}
            </div>
          )}

          {/* Separador si hay ambos grupos */}
          {urgent.length > 0 && inReview.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                color: "var(--app-text-muted)",
              }}
            >
              <div style={{ flex: 1, height: "1px", backgroundColor: "var(--app-border)" }} />
              <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                En revisión — vencidos sin depender de ti
              </span>
              <div style={{ flex: 1, height: "1px", backgroundColor: "var(--app-border)" }} />
            </div>
          )}

          {/* En revisión */}
          {inReview.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {reviewTickets.length > 0 && (
                <ItemGroup label={`Tickets (${reviewTickets.length})`} items={reviewTickets} onNavigate={dismiss} />
              )}
              {reviewTareas.length > 0 && (
                <ItemGroup label={`Tareas (${reviewTareas.length})`} items={reviewTareas} onNavigate={dismiss} />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid var(--app-border)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={dismiss}
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              padding: "0.5rem 1.75rem",
              borderRadius: "0.5rem",
              border: "none",
              backgroundColor: "#dc2626",
              color: "#ffffff",
              cursor: "pointer",
              transition: "background-color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#b91c1c";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#dc2626";
            }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemGroup({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: OverdueItem[];
  onNavigate: () => void;
}) {
  return (
    <div>
      <p
        style={{
          margin: "0 0 0.5rem",
          fontSize: "0.7rem",
          fontWeight: 700,
          color: "var(--app-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {items.map((item) => (
          <OverdueItemRow key={item.id} item={item} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

function OverdueItemRow({
  item,
  onNavigate,
}: {
  item: OverdueItem;
  onNavigate: () => void;
}) {
  const Icon = item.type === "ticket" ? FileText : CheckSquare;
  const color = item.inReview ? "#d97706" : "#dc2626";
  const bgBase = item.inReview ? "rgba(217,119,6,0.07)" : "rgba(220,38,38,0.07)";
  const bgHover = item.inReview ? "rgba(217,119,6,0.13)" : "rgba(220,38,38,0.13)";
  const borderColor = item.inReview ? "rgba(217,119,6,0.2)" : "rgba(220,38,38,0.18)";

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.625rem 0.875rem",
        borderRadius: "0.625rem",
        backgroundColor: bgBase,
        border: `1px solid ${borderColor}`,
        textDecoration: "none",
        transition: "background-color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = bgHover;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = bgBase;
      }}
    >
      <Icon style={{ width: "1rem", height: "1rem", color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "var(--app-body-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.title}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.75rem",
            color,
            marginTop: "0.125rem",
          }}
        >
          {item.inReview ? (
            <Hourglass style={{ width: "0.625rem", height: "0.625rem" }} />
          ) : (
            <Clock style={{ width: "0.625rem", height: "0.625rem" }} />
          )}
          Venció el {formatDate(item.dueDate)}
          {item.inReview && (
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 600,
                padding: "0.0625rem 0.375rem",
                borderRadius: "999px",
                backgroundColor: "rgba(217,119,6,0.15)",
                color: "#d97706",
                border: "1px solid rgba(217,119,6,0.3)",
                lineHeight: 1.6,
              }}
            >
              En revisión
            </span>
          )}
        </span>
      </div>
      <ExternalLink
        style={{
          width: "0.875rem",
          height: "0.875rem",
          color: "var(--app-text-muted)",
          flexShrink: 0,
        }}
      />
    </Link>
  );
}
