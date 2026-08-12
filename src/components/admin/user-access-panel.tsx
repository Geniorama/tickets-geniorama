"use client";

import { useMemo, useState, useTransition } from "react";
import type { AccessLevel, AppKey, Role } from "@/generated/prisma";
import { APPS, ACCESS_LEVEL_LABELS } from "@/lib/access/apps";
import { updateUserAccess } from "@/actions/access.actions";

type ProfileOption = {
  id: string;
  name: string;
  description: string | null;
  grants: unknown;
  isSystem: boolean;
};

const LEVELS: AccessLevel[] = ["SIN_ACCESO", "LECTURA", "MIEMBRO", "GESTOR"];

function parseGrants(raw: unknown): Partial<Record<AppKey, AccessLevel>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Partial<Record<AppKey, AccessLevel>>;
}

export function UserAccessPanel({
  userId,
  role,
  profiles,
  currentProfileId,
  currentLevels,
}: {
  userId: string;
  role: Role;
  profiles: ProfileOption[];
  currentProfileId: string | null;
  currentLevels: Partial<Record<AppKey, AccessLevel>>;
}) {
  const [profileId, setProfileId] = useState<string | null>(currentProfileId);
  const [levels, setLevels] = useState(currentLevels);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Solo los módulos que el rol admite: no tiene sentido ofrecer la
  // administración a un cliente.
  const visibleApps = useMemo(
    () => APPS.filter((a) => a.allowedRoles.includes(role)),
    [role],
  );

  /** Al elegir perfil, precargamos sus niveles para que se vea el efecto. */
  function applyProfile(id: string) {
    setProfileId(id || null);
    const profile = profiles.find((p) => p.id === id);
    if (!profile) return;
    const grants = parseGrants(profile.grants);
    const next: Partial<Record<AppKey, AccessLevel>> = {};
    for (const app of visibleApps) next[app.key] = grants[app.key] ?? "SIN_ACCESO";
    setLevels(next);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateUserAccess(userId, profileId, levels);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "0.8125rem",
    fontWeight: 600,
    color: "var(--app-body-text)",
  };

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        padding: "1.5rem",
      }}
    >
      <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)" }}>
        Acceso a módulos
      </h2>
      <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: "0.25rem 0 1.25rem" }}>
        El perfil reparte los niveles de una vez. Puedes ajustar módulos sueltos
        después: lo que definas aquí manda sobre el perfil.
      </p>

      <label style={{ ...labelStyle, display: "block", marginBottom: "0.375rem" }}>Perfil</label>
      <select
        value={profileId ?? ""}
        onChange={(e) => applyProfile(e.target.value)}
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "0.5rem 0.75rem",
          borderRadius: "0.5rem",
          border: "1px solid var(--app-border)",
          backgroundColor: "var(--app-bg)",
          color: "var(--app-body-text)",
          fontSize: "0.875rem",
        }}
      >
        <option value="">Sin perfil (solo ajustes manuales)</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {profileId && (
        <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.5rem" }}>
          {profiles.find((p) => p.id === profileId)?.description}
        </p>
      )}

      <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {visibleApps.map((app) => (
          <div
            key={app.key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
              paddingBottom: "0.75rem",
              borderBottom: "1px solid var(--app-border)",
            }}
          >
            <div style={{ minWidth: "200px" }}>
              <div style={{ ...labelStyle, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {app.name}
                {!app.built && (
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      padding: "0.1rem 0.4rem",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(245,158,11,0.15)",
                      color: "#b45309",
                    }}
                  >
                    Aún no disponible
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
                {app.description}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
              {LEVELS.map((level) => {
                const active = (levels[app.key] ?? "SIN_ACCESO") === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setLevels((prev) => ({ ...prev, [app.key]: level }))}
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      padding: "0.3rem 0.7rem",
                      borderRadius: "0.4rem",
                      cursor: "pointer",
                      border: `1px solid ${active ? "#fd1384" : "var(--app-border)"}`,
                      backgroundColor: active ? "#fd1384" : "transparent",
                      color: active ? "#ffffff" : "var(--app-text-muted)",
                    }}
                  >
                    {ACCESS_LEVEL_LABELS[level]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p style={{ fontSize: "0.8125rem", color: "#b91c1c", marginTop: "0.75rem" }}>{error}</p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1.25rem" }}>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          style={{
            backgroundColor: "#fd1384",
            color: "#ffffff",
            border: "none",
            borderRadius: "0.5rem",
            padding: "0.55rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Guardando..." : "Guardar acceso"}
        </button>
        {saved && (
          <span style={{ fontSize: "0.8125rem", color: "#16a34a" }}>Acceso actualizado</span>
        )}
      </div>
    </div>
  );
}
