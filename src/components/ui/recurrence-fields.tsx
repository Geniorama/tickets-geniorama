"use client";

/**
 * El patrón de repetición, para lo que sea que se repita.
 *
 * Nació dentro del formulario de tareas recurrentes y salió de ahí al llegar los
 * tickets: son los mismos siete campos y la misma vista previa, y dos copias del
 * control acabarían discrepando justo en lo que nadie vuelve a comprobar —qué
 * pasa el 31 en un mes de 30, o si la fecha de fin sigue aplicando cuando hay
 * plazo de vencimiento—.
 *
 * Lo único que cambia entre uno y otro es el sustantivo: «tareas» o «tickets».
 * Va por prop y no se adivina.
 */

import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import {
  computeNextRunAt,
  describeRecurrence,
  serializeDaysOfWeek,
  type RecurrencePattern,
} from "@/lib/recurrence";

export type RecurrenceValue = {
  frequency: "DIARIA" | "SEMANAL" | "MENSUAL";
  interval: number;
  daysOfWeek: number[];
  dayOfMonth: number | null;
  startDate: string;
  endDate: string | null;
  dueDateOffsetDays: number;
  isActive: boolean;
};

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const PREVIEW_COUNT = 5;

const previewDateFmt = new Intl.DateTimeFormat("es-CO", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: "1px solid var(--app-border)",
  borderRadius: "0.5rem",
  fontSize: "0.875rem",
  backgroundColor: "var(--app-content-bg)",
  color: "var(--app-body-text)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "var(--app-nav-text)",
  marginBottom: "0.375rem",
};

/**
 * Las próximas fechas que va a generar este patrón.
 *
 * Reproduce lo que hace el barrido: la primera ocurrencia es la fecha de inicio
 * —las acciones ponen `nextRunAt = startDate`— y de ahí se encadena. Que la
 * vista previa y el runner usen la misma función es lo que evita que la pantalla
 * prometa un día y el ticket aparezca en otro.
 */
export function useRecurrencePreview(value: RecurrenceValue) {
  return useMemo(() => {
    const interval = Number.isNaN(value.interval) || value.interval < 1 ? 1 : value.interval;
    const offset =
      Number.isNaN(value.dueDateOffsetDays) || value.dueDateOffsetDays < 0
        ? 0
        : value.dueDateOffsetDays;

    const pattern: RecurrencePattern = {
      frequency: value.frequency,
      interval,
      daysOfWeek:
        value.frequency === "SEMANAL" && value.daysOfWeek.length > 0
          ? serializeDaysOfWeek(value.daysOfWeek)
          : null,
      dayOfMonth: value.frequency === "MENSUAL" ? value.dayOfMonth : null,
    };
    const label = describeRecurrence(pattern);

    const start = value.startDate ? new Date(`${value.startDate}T00:00:00`) : null;
    if (!start || Number.isNaN(start.getTime())) return { label, dates: [] as Date[] };

    // La fecha de fin solo aplica cuando no hay plazo de vencimiento, igual que
    // al guardar: con plazo, lo que manda es el offset.
    const end = offset === 0 && value.endDate ? new Date(`${value.endDate}T00:00:00`) : null;

    const dates: Date[] = [];
    let cursor = start;
    for (let i = 0; i < PREVIEW_COUNT; i++) {
      if (end && cursor.getTime() > end.getTime()) break;
      dates.push(cursor);
      cursor = computeNextRunAt(cursor, pattern);
    }
    return { label, dates };
  }, [
    value.frequency,
    value.interval,
    value.daysOfWeek,
    value.dayOfMonth,
    value.startDate,
    value.endDate,
    value.dueDateOffsetDays,
  ]);
}

export function RecurrenceFields({
  value,
  onChange,
  /** «tareas» o «tickets»: lo que esta programación va a abrir. */
  noun,
}: {
  value: RecurrenceValue;
  /**
   * Recibe solo lo que cambió.
   *
   * Un `(clave, valor)` genérico obligaría a que el estado del formulario fuese
   * exactamente `RecurrenceValue`, y no lo es: cada formulario tiene además sus
   * propios campos. Con un parche parcial, cualquiera de los dos lo aplica sobre
   * su estado sin que los tipos peleen.
   */
  onChange: (patch: Partial<RecurrenceValue>) => void;
  noun: string;
}) {
  const preview = useRecurrencePreview(value);

  function toggleDay(d: number) {
    onChange({
      daysOfWeek: value.daysOfWeek.includes(d)
        ? value.daysOfWeek.filter((x) => x !== d)
        : [...value.daysOfWeek, d],
    });
  }

  const hasOffset =
    typeof value.dueDateOffsetDays === "number" &&
    !Number.isNaN(value.dueDateOffsetDays) &&
    value.dueDateOffsetDays > 0;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.875rem" }}>
        <div>
          <label style={labelStyle}>Frecuencia</label>
          <select
            value={value.frequency}
            onChange={(e) => onChange({ frequency: e.target.value as RecurrenceValue["frequency"] })}
            style={inputStyle}
          >
            <option value="DIARIA">Días</option>
            <option value="SEMANAL">Semanas</option>
            <option value="MENSUAL">Meses</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Cada</label>
          <input
            type="number"
            min={1}
            max={365}
            value={Number.isNaN(value.interval) ? "" : value.interval}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ interval: v === "" ? NaN : parseInt(v, 10) });
            }}
            onBlur={(e) => {
              const n = parseInt(e.target.value, 10);
              if (Number.isNaN(n) || n < 1) onChange({ interval: 1 });
            }}
            style={inputStyle}
          />
        </div>
      </div>

      {value.frequency === "SEMANAL" && (
        <div style={{ marginBottom: "0.875rem" }}>
          <label style={labelStyle}>Días de la semana (opcional)</label>
          <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
            {DAY_LABELS.map((lbl, i) => {
              const active = value.daysOfWeek.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  style={{
                    padding: "0.375rem 0.75rem",
                    borderRadius: "9999px",
                    border: `1px solid ${active ? "#fd1384" : "var(--app-border)"}`,
                    backgroundColor: active ? "rgba(253,19,132,0.15)" : "var(--app-content-bg)",
                    color: active ? "#fd1384" : "var(--app-body-text)",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: "0.6875rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
            Si no seleccionas días, se generará el mismo día de la semana del inicio.
          </p>
        </div>
      )}

      {value.frequency === "MENSUAL" && (
        <div style={{ marginBottom: "0.875rem" }}>
          <label style={labelStyle}>Día del mes</label>
          <select
            value={value.dayOfMonth === null ? "" : String(value.dayOfMonth)}
            onChange={(e) =>
              onChange({ dayOfMonth: e.target.value === "" ? null : parseInt(e.target.value, 10) })
            }
            style={inputStyle}
          >
            <option value="">Mismo día del inicio</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Día {d}
              </option>
            ))}
            <option value="-1">Último día del mes</option>
          </select>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: hasOffset ? "1fr" : "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label style={labelStyle}>Fecha de inicio</label>
          <input
            type="date"
            value={value.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
            required
            style={inputStyle}
          />
        </div>
        {!hasOffset && (
          <div>
            <label style={labelStyle}>Fecha de fin (opcional)</label>
            <input
              type="date"
              value={value.endDate ?? ""}
              onChange={(e) => onChange({ endDate: e.target.value || null })}
              style={inputStyle}
            />
          </div>
        )}
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginTop: "0.875rem",
          fontSize: "0.875rem",
          color: "var(--app-body-text)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={value.isActive}
          onChange={(e) => onChange({ isActive: e.target.checked })}
        />
        Activa (genera {noun} automáticamente)
      </label>

      <div
        style={{
          marginTop: "1.25rem",
          border: "1px dashed var(--app-border)",
          borderRadius: "0.5rem",
          padding: "0.875rem 1rem",
          backgroundColor: "var(--app-content-bg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
          <CalendarClock style={{ width: "1rem", height: "1rem", color: "#fd1384" }} />
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-body-text)" }}>
            Próximos {noun} a crear
          </span>
        </div>
        {preview.label && (
          <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", margin: "0 0 0.625rem" }}>
            {preview.label}
          </p>
        )}
        {preview.dates.length === 0 ? (
          <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: 0 }}>
            Define una fecha de inicio válida para ver la programación.
          </p>
        ) : (
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {preview.dates.map((d, i) => (
              <li
                key={i}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: "var(--app-body-text)" }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "1.25rem",
                    height: "1.25rem",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(253,19,132,0.12)",
                    color: "#fd1384",
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ textTransform: "capitalize" }}>{previewDateFmt.format(d)}</span>
              </li>
            ))}
          </ol>
        )}
        <p style={{ fontSize: "0.6875rem", color: "var(--app-text-muted)", margin: "0.625rem 0 0" }}>
          Se muestran las próximas {PREVIEW_COUNT}. La generación automática requiere que esté activa.
        </p>
      </div>
    </>
  );
}
