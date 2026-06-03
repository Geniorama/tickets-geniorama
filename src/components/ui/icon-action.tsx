"use client";

import Link from "next/link";
import { Loader2, Pencil, Trash2, Zap, FormInput, Copy, Power, PowerOff, Mail, Check, Eye } from "lucide-react";

// Registro de iconos: los callers pasan un nombre (serializable) en vez del
// componente, para poder usarse desde Server Components.
const ICONS = {
  pencil: Pencil,
  trash: Trash2,
  zap: Zap,
  form: FormInput,
  copy: Copy,
  power: Power,
  "power-off": PowerOff,
  mail: Mail,
  check: Check,
  eye: Eye,
} as const;

export type IconName = keyof typeof ICONS;
export type IconActionTone = "neutral" | "danger" | "success";

const TONE_COLOR: Record<IconActionTone, string> = {
  neutral: "#fd1384",
  danger: "#dc2626",
  success: "#16a34a",
};

const base: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "2rem",
  height: "2rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--app-border)",
  background: "none",
  color: "var(--app-text-muted)",
  transition: "color 0.15s, border-color 0.15s",
  flexShrink: 0,
  textDecoration: "none",
};

const ICON_STYLE = { width: "0.95rem", height: "0.95rem" } as const;

function enter(tone: IconActionTone) {
  return (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.color = TONE_COLOR[tone];
    e.currentTarget.style.borderColor = TONE_COLOR[tone];
  };
}
function leave(e: React.MouseEvent<HTMLElement>) {
  e.currentTarget.style.color = "var(--app-text-muted)";
  e.currentTarget.style.borderColor = "var(--app-border)";
}

function Tip({ label }: { label: string }) {
  return <span className="icon-action-tip">{label}</span>;
}

/** Botón de acción de icono con tooltip (sin texto). */
export function IconAction({
  icon,
  label,
  onClick,
  tone = "neutral",
  disabled = false,
  pending = false,
}: {
  icon: IconName;
  label: string;
  onClick?: () => void;
  tone?: IconActionTone;
  disabled?: boolean;
  pending?: boolean;
}) {
  const Icon = ICONS[icon];
  const off = disabled || pending;
  return (
    <span className="icon-action-wrap">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={off}
        style={{ ...base, cursor: off ? "not-allowed" : "pointer", opacity: off ? 0.5 : 1 }}
        onMouseEnter={off ? undefined : enter(tone)}
        onMouseLeave={off ? undefined : leave}
      >
        {pending ? <Loader2 className="animate-spin" style={ICON_STYLE} /> : <Icon style={ICON_STYLE} />}
      </button>
      <Tip label={label} />
    </span>
  );
}

/** Enlace de acción de icono con tooltip (sin texto). */
export function IconActionLink({
  icon,
  label,
  href,
  tone = "neutral",
}: {
  icon: IconName;
  label: string;
  href: string;
  tone?: IconActionTone;
}) {
  const Icon = ICONS[icon];
  return (
    <span className="icon-action-wrap">
      <Link
        href={href}
        aria-label={label}
        style={base}
        onMouseEnter={enter(tone)}
        onMouseLeave={leave}
      >
        <Icon style={ICON_STYLE} />
      </Link>
      <Tip label={label} />
    </span>
  );
}
