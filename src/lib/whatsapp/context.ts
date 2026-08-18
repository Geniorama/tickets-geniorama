/**
 * Contexto que el agente de WhatsApp recibe antes de responder.
 *
 * A diferencia de un agente con herramientas de lectura, aquí el contexto se
 * calcula entero de antemano y se inyecta como primer turno. Es lo mismo que
 * hace el asistente del panel, y por la misma razón: el volumen de datos de un
 * cliente (su plan y sus tickets) es pequeño, así que una consulta resuelve
 * todo lo que el modelo puede llegar a necesitar, sin rondas extra de
 * herramientas que cuestan latencia — y en WhatsApp la latencia se nota.
 *
 * El contexto además acota lo que el modelo puede tocar: los mapas que devuelve
 * son la lista blanca contra la que se validan las llamadas a herramientas.
 */

import { prisma } from "@/lib/prisma";
import { ticketCode } from "@/lib/ticket-code";
import { daysUntilExpiry, formatHours, getEffectiveExpiresAt, isPlanExpired } from "@/lib/plans";
import { getPlanUsedHours } from "@/lib/time-entries";
import { recentCommentsByEntity } from "@/lib/comments";
import type { TicketStatus } from "@/generated/prisma";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  POR_ASIGNAR: "Por asignar",
  ABIERTO: "Abierto",
  EN_PROGRESO: "En progreso",
  EN_REVISION: "En revisión",
  CERRADO: "Cerrado",
};

const PLAN_TYPE_LABELS: Record<string, string> = {
  BOLSA_HORAS: "Bolsa de horas",
  SOPORTE_MENSUAL: "Soporte mensual",
};

const OPEN_STATUSES: TicketStatus[] = ["POR_ASIGNAR", "ABIERTO", "EN_PROGRESO", "EN_REVISION"];

/** Tickets cerrados recientes que se incluyen para poder responder «¿ya quedó?». */
const CLOSED_TICKETS_SHOWN = 5;

export type TicketCtx = { id: string; code: string; title: string; status: TicketStatus };

export type WhatsappContext = {
  contextText: string;
  userName: string;
  /** Tickets que este usuario puede tocar, por id. Lista blanca de herramientas. */
  ticketMap: Map<string, TicketCtx>;
  /** Mismo conjunto indexado por código legible («ACM-12»), en mayúsculas. */
  ticketsByCode: Map<string, TicketCtx>;
  /** Si no tiene plan activo, no puede abrir tickets. */
  hasActivePlan: boolean;
};

function fmtDate(d: Date) {
  return format(d, "d MMM yyyy", { locale: es });
}

/**
 * Ids de los usuarios cuyos tickets puede ver este cliente: él mismo y los
 * demás clientes de sus empresas. Es la misma regla que aplica
 * `canAccessTicket`, resuelta en bloque para poder filtrar con un `in`.
 */
async function visibleClientIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      companies: {
        where: { isActive: true },
        select: { users: { where: { role: "CLIENTE" }, select: { id: true } } },
      },
    },
  });
  const ids = (user?.companies ?? []).flatMap((c) => c.users.map((u) => u.id));
  return [...new Set([userId, ...ids])];
}

export async function buildWhatsappContext(userId: string): Promise<WhatsappContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      role: true,
      companies: {
        where: { isActive: true },
        select: {
          name: true,
          plans: {
            where: { isActive: true },
            select: {
              id: true, name: true, type: true, totalHours: true,
              durationDays: true, startedAt: true, expiresAt: true, isActive: true,
            },
          },
        },
      },
    },
  });

  const clientIds = await visibleClientIds(userId);

  const tickets = await prisma.ticket.findMany({
    where: {
      isDraft: false,
      OR: [{ clientId: { in: clientIds } }, { createdById: userId }],
    },
    select: {
      id: true, prefix: true, number: true, title: true, description: true,
      status: true, priority: true, category: true, dueDate: true, createdAt: true,
      assignedTo: { select: { name: true } },
      site: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  const open = tickets.filter((t) => OPEN_STATUSES.includes(t.status));
  const closed = tickets.filter((t) => t.status === "CERRADO").slice(0, CLOSED_TICKETS_SHOWN);

  // Los comentarios públicos son lo que deja ver «en qué va» un ticket. Las
  // notas internas del equipo NO entran: el cliente está al otro lado.
  const comments = await recentCommentsByEntity("TICKET", open.map((t) => t.id), 2, false);

  const ticketMap = new Map<string, TicketCtx>();
  const ticketsByCode = new Map<string, TicketCtx>();
  for (const t of [...open, ...closed]) {
    const entry: TicketCtx = {
      id: t.id,
      code: ticketCode(t.prefix, t.number),
      title: t.title,
      status: t.status,
    };
    ticketMap.set(t.id, entry);
    ticketsByCode.set(entry.code.toUpperCase(), entry);
  }

  // ── Planes ──
  const companies = user?.companies ?? [];
  const planBlocks: string[] = [];
  let hasActivePlan = false;

  for (const company of companies) {
    for (const plan of company.plans) {
      const expired = isPlanExpired(plan);
      const expiry = getEffectiveExpiresAt(plan);
      const days = daysUntilExpiry(plan);

      const lines = [
        `- Plan: ${plan.name} (${PLAN_TYPE_LABELS[plan.type] ?? plan.type}) — ${company.name}`,
      ];

      if (plan.type === "BOLSA_HORAS" && plan.totalHours !== null) {
        const used = await getPlanUsedHours(plan.id);
        const left = Math.max(0, plan.totalHours - used);
        lines.push(
          `  Horas: ${formatHours(used)} consumidas de ${formatHours(plan.totalHours)} · quedan ${formatHours(left)}`,
        );
        if (!expired && left > 0) hasActivePlan = true;
      } else if (!expired) {
        hasActivePlan = true;
      }

      if (expiry) {
        lines.push(
          expired
            ? `  Vencido el ${fmtDate(expiry)}`
            : `  Vence el ${fmtDate(expiry)}${days !== null ? ` (faltan ${days} días)` : ""}`,
        );
      } else {
        lines.push("  Sin fecha de vencimiento");
      }

      planBlocks.push(lines.join("\n"));
    }
  }

  // ── Texto del contexto ──
  const sections: string[] = [];

  sections.push(
    `Usuario: ${user?.name ?? "Cliente"}\n` +
      `Empresa(s): ${companies.map((c) => c.name).join(", ") || "—"}\n` +
      `Fecha de hoy: ${fmtDate(new Date())}`,
  );

  sections.push(
    planBlocks.length > 0
      ? `PLANES\n${planBlocks.join("\n")}`
      : "PLANES\n- No tiene ningún plan activo. No puede abrir tickets hasta que su agente le active uno.",
  );

  if (open.length > 0) {
    const rows = open.map((t) => {
      const parts = [
        `- ${ticketCode(t.prefix, t.number)} · ${t.title}`,
        `  ID: ${t.id}`,
        `  Estado: ${TICKET_STATUS_LABELS[t.status]} · Prioridad: ${t.priority}` +
          (t.category ? ` · Categoría: ${t.category}` : ""),
        `  Responsable: ${t.assignedTo?.name ?? "sin asignar todavía"}`,
        `  Abierto el ${fmtDate(t.createdAt)}`,
      ];
      if (t.site?.name) parts.push(`  Sitio/app: ${t.site.name}`);
      if (t.dueDate) {
        const overdue = t.dueDate < new Date() && t.status !== "CERRADO";
        parts.push(`  Fecha límite: ${fmtDate(t.dueDate)}${overdue ? " (VENCIDA)" : ""}`);
      }
      parts.push(`  Descripción: ${t.description.replace(/\s+/g, " ").trim().slice(0, 300)}`);

      const recent = comments.get(t.id) ?? [];
      if (recent.length > 0) {
        const ordered = [...recent].reverse();
        parts.push(
          "  Últimos comentarios:\n" +
            ordered
              .map((c) => `    · ${c.author.name}: ${c.body.replace(/\s+/g, " ").trim().slice(0, 200)}`)
              .join("\n"),
        );
      }
      return parts.join("\n");
    });
    sections.push(`TICKETS ABIERTOS (${open.length})\n${rows.join("\n")}`);
  } else {
    sections.push("TICKETS ABIERTOS\n- Ninguno.");
  }

  if (closed.length > 0) {
    const rows = closed.map(
      (t) => `- ${ticketCode(t.prefix, t.number)} · ${t.title} (cerrado) · ID: ${t.id}`,
    );
    sections.push(`TICKETS CERRADOS RECIENTES\n${rows.join("\n")}`);
  }

  return {
    contextText: sections.join("\n\n"),
    userName: user?.name ?? "Cliente",
    ticketMap,
    ticketsByCode,
    hasActivePlan,
  };
}
