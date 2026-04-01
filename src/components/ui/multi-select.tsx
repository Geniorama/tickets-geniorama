"use client";

import { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  /** Tailwind classes for the trigger button (ticket-filters context) */
  triggerClassName?: string;
  /** Inline styles for the trigger button (task/project-filters context) */
  triggerStyle?: React.CSSProperties;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Todos",
  triggerClassName,
  triggerStyle,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function toggle(optionValue: string) {
    onChange(
      value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue]
    );
  }

  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
      ? (options.find((o) => o.value === value[0])?.label ?? value[0])
      : `${value.length} seleccionados`;

  const hasValue = value.length > 0;

  const defaultTriggerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    border: "1px solid var(--app-border, #d1d5db)",
    borderRadius: "0.5rem",
    padding: "0.375rem 0.75rem",
    fontSize: "0.875rem",
    color: hasValue ? "var(--app-body-text, #111827)" : "var(--app-text-muted, #6b7280)",
    backgroundColor: "var(--app-card-bg, #ffffff)",
    cursor: "pointer",
    textAlign: "left",
    gap: "0.5rem",
    background: "none",
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName}
        style={triggerClassName ? undefined : { ...defaultTriggerStyle, ...triggerStyle }}
      >
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: hasValue ? 500 : undefined,
          }}
        >
          {label}
        </span>
        <svg
          style={{
            width: "0.875rem",
            height: "0.875rem",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
            opacity: 0.5,
          }}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 0.25rem)",
            left: 0,
            right: 0,
            zIndex: 50,
            backgroundColor: "var(--dropdown-bg, #ffffff)",
            border: "1px solid var(--dropdown-border, #d1d5db)",
            borderRadius: "0.5rem",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            maxHeight: "15rem",
            overflowY: "auto",
            padding: "0.25rem 0",
          }}
        >
          {options.map((opt) => {
            const checked = value.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggle(opt.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.625rem",
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.8125rem",
                  color: checked
                    ? "var(--app-body-text, #111827)"
                    : "var(--dropdown-text, #374151)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontWeight: checked ? 500 : 400,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "var(--dropdown-hover-bg, #f3f4f6)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                {/* Checkbox */}
                <span
                  style={{
                    width: "1rem",
                    height: "1rem",
                    flexShrink: 0,
                    border: `2px solid ${checked ? "#4f46e5" : "var(--app-border, #d1d5db)"}`,
                    borderRadius: "0.25rem",
                    backgroundColor: checked ? "#4f46e5" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.1s, border-color 0.1s",
                  }}
                >
                  {checked && (
                    <svg
                      style={{ width: "0.6rem", height: "0.6rem", color: "#fff" }}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
