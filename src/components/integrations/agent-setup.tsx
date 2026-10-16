import Link from "next/link";
import { CheckCircle2, AlertTriangle, Circle } from "lucide-react";
import { formatDateTime } from "@/lib/format-date";
import type { AgentSetup } from "@/lib/api/agent-setup";

/**
 * El estado del agente de atención por WhatsApp, de solo lectura: lo que falta
 * de este lado y qué clientes ya podrán escribirle. Todo se configura en otro
 * sitio (planes, llaves, n8n); aquí solo se ve si encaja.
 */

type Step = { done: boolean; warn?: boolean; title: string; detail: React.ReactNode };

function StepRow({ step }: { step: Step }) {
  const Icon = step.done ? CheckCircle2 : step.warn ? AlertTriangle : Circle;
  const color = step.done ? "#16a34a" : step.warn ? "#d97706" : "#9ca3af";
  return (
    <li style={{ display: "flex", gap: "0.625rem", alignItems: "flex-start" }}>
      <Icon style={{ width: "1rem", height: "1rem", color, flexShrink: 0, marginTop: "0.1rem" }} />
      <span style={{ fontSize: "0.8125rem", lineHeight: 1.5, color: "var(--app-body-text)" }}>
        <strong>{step.title}</strong>
        <span style={{ display: "block", color: "var(--app-text-muted)", fontSize: "0.75rem" }}>{step.detail}</span>
      </span>
    </li>
  );
}

const card: React.CSSProperties = {
  backgroundColor: "var(--app-card-bg)",
  border: "1px solid var(--app-border)",
  borderRadius: "0.75rem",
  padding: "1rem 1.25rem",
};

export function AgentSetupPanel({ setup }: { setup: AgentSetup }) {
  const clients = setup.companies.flatMap((c) => c.clients);
  const withPhone = clients.filter((c) => c.phone && !c.duplicated);
  const duplicated = clients.filter((c) => c.duplicated);

  const steps: Step[] = [
    {
      done: setup.companies.length > 0,
      title: "Un plan vigente que lo incluya",
      detail: setup.companies.length > 0
        ? `${setup.companies.length} empresa(s): ${setup.companies.map((c) => c.name).join(", ")}.`
        : <>Ningún plan vigente tiene marcado «Agente IA por WhatsApp». Se activa en <Link href="/admin/plans" style={{ color: "#6366f1" }}>Planes</Link>.</>,
    },
    {
      done: setup.keys.length > 0,
      title: "Una llave del equipo con el permiso «Agente de atención a clientes»",
      detail: setup.keys.length > 0
        ? setup.keys.map((k) => `${k.label} (${k.owner}) · ${k.lastUsedAt ? `último uso ${formatDateTime(k.lastUsedAt)}` : "sin usar todavía"}`).join(" — ")
        : <>Créala abajo, en <a href="#llaves" style={{ color: "#6366f1" }}>Llaves de API</a>, atada a una cuenta del equipo creada para el agente.</>,
    },
    {
      done: setup.secretConfigured,
      warn: !setup.secretConfigured,
      title: "AUTH_SECRET en el servidor",
      detail: setup.secretConfigured
        ? "Con ella se firman los tokens que identifican al cliente atendido."
        : "Falta: sin ella los endpoints del agente responden error.",
    },
    {
      done: withPhone.length > 0,
      warn: duplicated.length > 0,
      title: "Clientes con su WhatsApp registrado",
      detail: clients.length === 0
        ? "Aparecerán cuando haya un plan con el agente."
        : `${withPhone.length} de ${clients.length} pueden escribirle al agente.` +
          (duplicated.length > 0 ? ` ${duplicated.length} tienen un número repetido en otra cuenta y no se atienden hasta aclararlo.` : "") +
          " Cada cliente guarda su número en Mis integraciones → Avisos por WhatsApp.",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={card}>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {steps.map((s) => <StepRow key={s.title} step={s} />)}
        </ul>
        <p style={{ margin: "0.875rem 0 0", fontSize: "0.75rem", color: "var(--app-text-muted)", lineHeight: 1.5 }}>
          El workflow (canal de Meta, modelo e instrucciones) vive en n8n y no se ve desde aquí. Cómo montarlo:{" "}
          <Link href="/admin/integraciones/api" style={{ color: "#6366f1" }}>guía, sección 3</Link>.
        </p>
      </div>

      {setup.companies.map((company) => (
        <div key={company.id} style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--app-border)", display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)" }}>{company.name}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>{company.plans.join(" · ")}</span>
          </div>
          {company.clients.length === 0 ? (
            <p style={{ margin: 0, padding: "0.75rem 1.25rem", fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>Esta empresa no tiene usuarios cliente activos.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {company.clients.map((c, i) => (
                <li
                  key={c.id}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", padding: "0.5rem 1.25rem", borderTop: i === 0 ? "none" : "1px solid var(--app-border)" }}
                >
                  <Link href={`/admin/users/${c.id}`} style={{ fontSize: "0.8125rem", color: "var(--app-body-text)", textDecoration: "none", minWidth: 0 }}>
                    {c.name} <span style={{ color: "var(--app-text-muted)" }}>· {c.email}</span>
                  </Link>
                  <span style={{ fontSize: "0.75rem", fontVariantNumeric: "tabular-nums", color: c.duplicated ? "#b45309" : c.phone ? "#15803d" : "var(--app-text-muted)" }}>
                    {c.duplicated ? `${c.phone} · repetido en otra cuenta` : c.phone ?? "Sin número registrado"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
