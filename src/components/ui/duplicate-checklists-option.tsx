"use client";

/**
 * Casilla «copiar checklists» para los diálogos de duplicar. La comparten
 * tickets y tareas; no se muestra si la entidad no tiene ítems que copiar.
 */
export function DuplicateChecklistsOption({
  itemCount,
  checked,
  disabled = false,
  onChange,
}: {
  itemCount: number;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  if (itemCount <= 0) return null;

  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.5rem",
        fontSize: "0.8125rem",
        color: "var(--app-body-text)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        border: "1px solid var(--app-border)",
        borderRadius: "0.5rem",
        padding: "0.625rem 0.75rem",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: "0.125rem", accentColor: "#fd1384", cursor: "inherit" }}
      />
      <span>
        Copiar los checklists
        <span style={{ display: "block", color: "var(--app-text-muted)", fontSize: "0.75rem" }}>
          {itemCount} ítem{itemCount !== 1 ? "s" : ""} · la copia los recibe sin marcar
        </span>
      </span>
    </label>
  );
}
