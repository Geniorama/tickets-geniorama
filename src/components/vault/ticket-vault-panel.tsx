"use client";

import { useState, useTransition } from "react";
import { KeyRound, ExternalLink, X, Plus } from "lucide-react";
import { linkVaultToTicket, unlinkVaultFromTicket } from "@/actions/vault.actions";
import Link from "next/link";

interface VaultEntry {
  id: string;
  title: string;
  username: string | null;
  url: string | null;
}

export function TicketVaultPanel({
  ticketId,
  linkedEntries,
  availableEntries,
  canManage,
}: {
  ticketId: string;
  linkedEntries: VaultEntry[];
  availableEntries: VaultEntry[];
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleLink() {
    if (!selectedId) return;
    setError(null);
    startTransition(async () => {
      const result = await linkVaultToTicket(ticketId, selectedId);
      if (result?.error) setError(result.error);
      else setSelectedId("");
    });
  }

  function handleUnlink(vaultEntryId: string) {
    startTransition(async () => {
      const result = await unlinkVaultFromTicket(ticketId, vaultEntryId);
      if (result?.error) setError(result.error);
    });
  }

  if (linkedEntries.length === 0 && !canManage) return null;

  return (
    <div style={{
      backgroundColor: "var(--app-card-bg)",
      border: "1px solid var(--app-border)",
      borderRadius: "0.75rem",
      padding: "1.25rem 1.5rem",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
        <KeyRound style={{ width: "1rem", height: "1rem", color: "#fd1384" }} />
        <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)" }}>
          Accesos de Bóveda
        </h2>
        {linkedEntries.length > 0 && (
          <span style={{
            fontSize: "0.75rem", fontWeight: 500,
            backgroundColor: "rgba(253,19,132,0.12)", color: "#fd1384",
            padding: "0.1rem 0.5rem", borderRadius: "9999px",
          }}>
            {linkedEntries.length}
          </span>
        )}
      </div>

      {linkedEntries.length === 0 ? (
        <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginBottom: canManage ? "0.875rem" : 0 }}>
          No hay accesos vinculados a este ticket.
        </p>
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: canManage ? "0.875rem" : 0 }}>
          {linkedEntries.map((entry) => (
            <li
              key={entry.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: "0.75rem", padding: "0.5rem 0.75rem",
                backgroundColor: "var(--app-content-bg)",
                borderRadius: "0.5rem", border: "1px solid var(--app-border)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <Link
                    href={`/boveda/${entry.id}`}
                    style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--app-body-text)", textDecoration: "none" }}
                  >
                    {entry.title}
                  </Link>
                  {entry.url && (
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={entry.url}
                      style={{ color: "var(--app-text-muted)", display: "flex", alignItems: "center" }}
                    >
                      <ExternalLink style={{ width: "0.75rem", height: "0.75rem" }} />
                    </a>
                  )}
                </div>
                {entry.username && (
                  <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.1rem" }}>
                    {entry.username}
                  </p>
                )}
              </div>
              {canManage && (
                <button
                  onClick={() => handleUnlink(entry.id)}
                  disabled={isPending}
                  title="Desvincular"
                  style={{
                    background: "none", border: "none", cursor: isPending ? "not-allowed" : "pointer",
                    color: "var(--app-text-muted)", display: "flex", alignItems: "center",
                    padding: "0.125rem", flexShrink: 0,
                  }}
                >
                  <X style={{ width: "0.875rem", height: "0.875rem" }} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && availableEntries.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              flex: 1, border: "1px solid var(--app-border)", borderRadius: "0.375rem",
              padding: "0.375rem 0.625rem", fontSize: "0.8125rem",
              color: "var(--app-body-text)", backgroundColor: "var(--app-input-bg)", outline: "none",
            }}
          >
            <option value="">Vincular acceso de Bóveda...</option>
            {availableEntries.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}{e.username ? ` — ${e.username}` : ""}
              </option>
            ))}
          </select>
          <button
            onClick={handleLink}
            disabled={!selectedId || isPending}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.25rem",
              backgroundColor: selectedId ? "#fd1384" : "var(--app-border)",
              color: selectedId ? "#fff" : "var(--app-text-muted)",
              padding: "0.375rem 0.75rem", borderRadius: "0.375rem",
              fontSize: "0.8125rem", fontWeight: 500, border: "none",
              cursor: selectedId && !isPending ? "pointer" : "not-allowed",
            }}
          >
            <Plus style={{ width: "0.875rem", height: "0.875rem" }} />
            Vincular
          </button>
        </div>
      )}

      {error && (
        <p style={{ fontSize: "0.8125rem", color: "#b91c1c", marginTop: "0.5rem" }}>{error}</p>
      )}
    </div>
  );
}
