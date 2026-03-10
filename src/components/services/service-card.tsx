import Link from "next/link";
import { Globe, Server, Mail, Shield, Wrench, Package, ExternalLink } from "lucide-react";

type ServiceType     = "DOMINIO" | "HOSTING" | "CORREO" | "SSL" | "MANTENIMIENTO" | "OTRO";
type ServiceProvider = "GENIORAMA" | "EXTERNO";

interface ServiceCardService {
  id: string; name: string; type: ServiceType; provider: ServiceProvider;
  description: string | null; dueDate: Date | null;
  price: number | null; notes: string | null; isActive: boolean;
  company: { id: string; name: string };
}

const TYPE_META: Record<ServiceType, { label: string; icon: React.ElementType; color: string }> = {
  DOMINIO:       { label: "Dominio",        icon: Globe,       color: "#3b82f6" },
  HOSTING:       { label: "Hosting",        icon: Server,      color: "#8b5cf6" },
  CORREO:        { label: "Correos",        icon: Mail,        color: "#f59e0b" },
  SSL:           { label: "SSL",            icon: Shield,      color: "#22c55e" },
  MANTENIMIENTO: { label: "Mantenimiento",  icon: Wrench,      color: "#f97316" },
  OTRO:          { label: "Otro",           icon: Package,     color: "#64748b" },
};

function getServiceStatus(dueDate: Date | null, isActive: boolean) {
  if (!isActive) return { label: "Cancelado", color: "#64748b", bg: "rgba(100,116,139,0.12)" };
  if (!dueDate)  return { label: "Activo",    color: "#22c55e", bg: "rgba(34,197,94,0.12)" };
  const now  = new Date();
  const days = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0)  return { label: "Vencido",       color: "#dc2626", bg: "rgba(239,68,68,0.12)" };
  if (days <= 30) return { label: `Vence en ${days}d`, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" };
  return { label: "Activo", color: "#22c55e", bg: "rgba(34,197,94,0.12)" };
}

function formatCOP(value: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value);
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

export function ServiceCard({
  service,
  showCompany = false,
  showNotes = false,
  editHref,
}: {
  service: ServiceCardService;
  showCompany?: boolean;
  showNotes?: boolean;
  editHref?: string;
}) {
  const meta   = TYPE_META[service.type];
  const status = getServiceStatus(service.dueDate, service.isActive);
  const Icon   = meta.icon;

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        opacity: service.isActive ? 1 : 0.65,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div style={{ width: "2rem", height: "2rem", borderRadius: "0.5rem", backgroundColor: `${meta.color}1a`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon style={{ width: "1rem", height: "1rem", color: meta.color }} />
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--app-body-text)" }}>{service.name}</p>
            <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>{meta.label}</p>
          </div>
        </div>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "9999px", backgroundColor: status.bg, color: status.color, whiteSpace: "nowrap" }}>
          {status.label}
        </span>
      </div>

      {/* Company */}
      {showCompany && (
        <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>
          {service.company.name}
        </p>
      )}

      {/* Description */}
      {service.description && (
        <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", lineHeight: 1.5 }}>{service.description}</p>
      )}

      {/* Details row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1.5rem", fontSize: "0.8125rem" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <ExternalLink style={{ width: "0.75rem", height: "0.75rem", color: "var(--app-text-muted)" }} />
          <span style={{ color: service.provider === "GENIORAMA" ? "#fd1384" : "var(--app-text-muted)", fontWeight: 500 }}>
            {service.provider === "GENIORAMA" ? "Geniorama" : "Externo"}
          </span>
        </span>

        {service.dueDate && (
          <span style={{ color: "var(--app-text-muted)" }}>
            Vence: <strong style={{ color: status.color }}>{formatDate(service.dueDate)}</strong>
          </span>
        )}

        {service.price != null && service.provider === "GENIORAMA" && (
          <span style={{ color: "var(--app-text-muted)" }}>
            Valor: <strong style={{ color: "var(--app-body-text)" }}>{formatCOP(service.price)}</strong>
          </span>
        )}
      </div>

      {/* Internal notes (staff only) */}
      {showNotes && service.notes && (
        <div style={{ backgroundColor: "var(--app-content-bg)", borderRadius: "0.5rem", padding: "0.625rem 0.75rem", fontSize: "0.8125rem", color: "var(--app-text-muted)", borderLeft: "3px solid #f59e0b" }}>
          <span style={{ fontWeight: 600, color: "#b45309" }}>Notas internas: </span>
          {service.notes}
        </div>
      )}

      {/* Edit link */}
      {editHref && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Link href={editHref} style={{ fontSize: "0.8125rem", color: "#fd1384", fontWeight: 500, textDecoration: "none" }}>
            Editar →
          </Link>
        </div>
      )}
    </div>
  );
}
