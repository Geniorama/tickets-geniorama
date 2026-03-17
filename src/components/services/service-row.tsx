import Link from "next/link";
import { Globe, Server, Mail, Shield, Wrench, Package } from "lucide-react";
import { DuplicateServiceButton } from "@/components/services/duplicate-service-button";
import { DeleteServiceButton } from "@/components/services/delete-service-button";

type ServiceType     = "DOMINIO" | "HOSTING" | "CORREO" | "SSL" | "MANTENIMIENTO" | "OTRO";
type ServiceProvider = "GENIORAMA" | "EXTERNO";

interface ServiceRowService {
  id: string; name: string; type: ServiceType; provider: ServiceProvider;
  description: string | null; dueDate: Date | null;
  price: number | null; isActive: boolean;
  company: { id: string; name: string };
}

const TYPE_META: Record<ServiceType, { label: string; icon: React.ElementType; color: string }> = {
  DOMINIO:       { label: "Dominio",       icon: Globe,    color: "#3b82f6" },
  HOSTING:       { label: "Hosting",       icon: Server,   color: "#8b5cf6" },
  CORREO:        { label: "Correos",       icon: Mail,     color: "#f59e0b" },
  SSL:           { label: "SSL",           icon: Shield,   color: "#22c55e" },
  MANTENIMIENTO: { label: "Mantenimiento", icon: Wrench,   color: "#f97316" },
  OTRO:          { label: "Otro",          icon: Package,  color: "#64748b" },
};

function getServiceStatus(dueDate: Date | null, isActive: boolean) {
  if (!isActive) return { label: "Cancelado", color: "#64748b", bg: "rgba(100,116,139,0.12)" };
  if (!dueDate)  return { label: "Activo",    color: "#22c55e", bg: "rgba(34,197,94,0.12)" };
  const days = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
  if (days < 0)   return { label: "Vencido",           color: "#dc2626", bg: "rgba(239,68,68,0.12)" };
  if (days <= 30) return { label: `Vence en ${days}d`, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" };
  return { label: "Activo", color: "#22c55e", bg: "rgba(34,197,94,0.12)" };
}

function formatCOP(v: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

export function ServiceRow({
  service,
  showDuplicate = false,
  showDelete = false,
  editHref,
}: {
  service: ServiceRowService;
  showDuplicate?: boolean;
  showDelete?: boolean;
  editHref?: string;
}) {
  const meta   = TYPE_META[service.type];
  const status = getServiceStatus(service.dueDate, service.isActive);
  const Icon   = meta.icon;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.5rem 1fr auto auto auto auto",
        alignItems: "center",
        gap: "0 1rem",
        padding: "0.625rem 1rem",
        borderBottom: "1px solid var(--app-border)",
        opacity: service.isActive ? 1 : 0.6,
      }}
    >
      {/* Icon */}
      <Icon style={{ width: "1rem", height: "1rem", color: meta.color, flexShrink: 0 }} />

      {/* Name + type */}
      <div style={{ minWidth: 0 }}>
        <p style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--app-body-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {service.name}
        </p>
        <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>{meta.label}</p>
      </div>

      {/* Due date */}
      <span style={{ fontSize: "0.8125rem", color: service.dueDate ? status.color : "var(--app-text-muted)", whiteSpace: "nowrap" }}>
        {service.dueDate ? formatDate(service.dueDate) : "—"}
      </span>

      {/* Price */}
      <span style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", whiteSpace: "nowrap" }}>
        {service.price != null && service.provider === "GENIORAMA" ? formatCOP(service.price) : "—"}
      </span>

      {/* Status badge */}
      <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.15rem 0.5rem", borderRadius: "9999px", backgroundColor: status.bg, color: status.color, whiteSpace: "nowrap" }}>
        {status.label}
      </span>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
        {showDuplicate && <DuplicateServiceButton serviceId={service.id} />}
        {showDelete    && <DeleteServiceButton    serviceId={service.id} />}
        {editHref && (
          <Link href={editHref} style={{ fontSize: "0.8125rem", color: "#fd1384", fontWeight: 500, textDecoration: "none", paddingLeft: "0.25rem" }}>
            Editar →
          </Link>
        )}
      </div>
    </div>
  );
}
