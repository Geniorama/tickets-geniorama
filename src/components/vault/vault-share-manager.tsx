"use client";

import { useState, useTransition } from "react";
import { UserPlus, X } from "lucide-react";
import { addVaultShare, removeVaultShare } from "@/actions/vault.actions";

interface SharedUser { id: string; name: string; email: string; }
interface AvailableUser { id: string; name: string; email: string; }

interface VaultShareManagerProps {
  entryId: string;
  sharedWith: SharedUser[];
  availableUsers: AvailableUser[];
  canManage: boolean;
}

export function VaultShareManager({ entryId, sharedWith, availableUsers, canManage }: VaultShareManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sharedIds = new Set(sharedWith.map((u) => u.id));
  const addableUsers = availableUsers.filter((u) => !sharedIds.has(u.id));

  function handleAdd() {
    if (!selectedUserId) return;
    setError(null);
    startTransition(async () => {
      const result = await addVaultShare(entryId, selectedUserId);
      if (result?.error) setError(result.error);
      else setSelectedUserId("");
    });
  }

  function handleRemove(userId: string) {
    startTransition(async () => {
      await removeVaultShare(entryId, userId);
    });
  }

  return (
    <div>
      <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "0.75rem" }}>
        Compartido con ({sharedWith.length})
      </h3>

      {sharedWith.length === 0 ? (
        <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>
          Solo tú puedes ver esta entrada.
        </p>
      ) : (
        <ul style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginBottom: "0.75rem" }}>
          {sharedWith.map((u) => (
            <li key={u.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              fontSize: "0.875rem", color: "var(--app-body-text)",
              backgroundColor: "var(--app-content-bg)", borderRadius: "0.375rem",
              padding: "0.375rem 0.625rem",
            }}>
              <span>
                <strong>{u.name}</strong>
                <span style={{ color: "var(--app-text-muted)", marginLeft: "0.375rem" }}>{u.email}</span>
              </span>
              {canManage && (
                <button
                  onClick={() => handleRemove(u.id)}
                  disabled={isPending}
                  title="Quitar acceso"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--app-text-muted)", display: "flex", alignItems: "center",
                    padding: "0.125rem",
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && addableUsers.length > 0 && (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            style={{
              flex: 1, border: "1px solid var(--app-border)", borderRadius: "0.375rem",
              padding: "0.375rem 0.625rem", fontSize: "0.8125rem",
              color: "var(--app-body-text)", backgroundColor: "var(--app-input-bg)", outline: "none",
            }}
          >
            <option value="">Seleccionar usuario...</option>
            {addableUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!selectedUserId || isPending}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.25rem",
              backgroundColor: selectedUserId ? "#fd1384" : "var(--app-border)",
              color: selectedUserId ? "#fff" : "var(--app-text-muted)",
              padding: "0.375rem 0.75rem", borderRadius: "0.375rem",
              fontSize: "0.8125rem", fontWeight: 500, border: "none",
              cursor: selectedUserId && !isPending ? "pointer" : "not-allowed",
            }}
          >
            <UserPlus size={14} />
            Compartir
          </button>
        </div>
      )}

      {error && (
        <p style={{ fontSize: "0.8125rem", color: "#b91c1c", marginTop: "0.5rem" }}>{error}</p>
      )}
    </div>
  );
}
