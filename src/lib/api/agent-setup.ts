/**
 * ¿Está listo el agente de atención por WhatsApp? Lo que la plataforma puede
 * comprobar de su lado: planes que lo incluyen, la llave con el permiso
 * `agent`, el secreto con que se firman los tokens y qué clientes ya tienen su
 * número registrado. El workflow de n8n no se ve desde aquí.
 *
 * El número de cada cliente lo guarda él mismo en *Mis integraciones*; sin
 * esto el equipo no tenía forma de saber quién podrá escribirle al agente.
 */

import { prisma } from "@/lib/prisma";
import { getEffectiveExpiresAt } from "@/lib/plans";

export type AgentSetupClient = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** Otra cuenta de cliente tiene el mismo número: el agente no lo atiende. */
  duplicated: boolean;
};

export type AgentSetup = {
  companies: { id: string; name: string; plans: string[]; clients: AgentSetupClient[] }[];
  keys: { id: string; label: string; owner: string; lastUsedAt: Date | null }[];
  secretConfigured: boolean;
};

export async function getAgentSetup(): Promise<AgentSetup> {
  const now = Date.now();
  const [plans, keys, phones] = await Promise.all([
    prisma.plan.findMany({
      where: { aiAgent: true, isActive: true, company: { isActive: true } },
      select: {
        name: true, startedAt: true, expiresAt: true, durationDays: true,
        company: {
          select: {
            id: true, name: true,
            users: {
              where: { role: "CLIENTE", isActive: true },
              select: { id: true, name: true, email: true, whatsappPhone: true },
              orderBy: { name: "asc" },
            },
          },
        },
      },
      orderBy: { company: { name: "asc" } },
    }),
    prisma.apiKey.findMany({
      where: { scopes: { has: "agent" }, isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { id: true, label: true, lastUsedAt: true, user: { select: { name: true, role: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // Los repetidos se buscan entre todos los clientes, no solo los de estas
    // empresas: el choque puede ser con una cuenta de otra empresa.
    prisma.user.groupBy({
      by: ["whatsappPhone"],
      where: { role: "CLIENTE", isActive: true, whatsappPhone: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const repeated = new Set(phones.filter((p) => p._count._all > 1).map((p) => p.whatsappPhone));

  // Un plan con el agente pero vencido no da el agente: se deja fuera, igual
  // que hace `clientHasPlanFeature`.
  const byCompany = new Map<string, AgentSetup["companies"][number]>();
  for (const p of plans) {
    const expires = getEffectiveExpiresAt(p);
    if (expires && expires.getTime() < now) continue;
    const entry = byCompany.get(p.company.id) ?? {
      id: p.company.id,
      name: p.company.name,
      plans: [],
      clients: p.company.users.map((u) => ({
        id: u.id, name: u.name, email: u.email, phone: u.whatsappPhone,
        duplicated: u.whatsappPhone !== null && repeated.has(u.whatsappPhone),
      })),
    };
    entry.plans.push(p.name);
    byCompany.set(p.company.id, entry);
  }

  return {
    companies: [...byCompany.values()],
    // Una llave de cliente con `agent` no funciona (se rechaza en cada
    // petición), así que no cuenta como lista.
    keys: keys
      .filter((k) => k.user.role !== "CLIENTE")
      .map((k) => ({ id: k.id, label: k.label, owner: k.user.name, lastUsedAt: k.lastUsedAt })),
    secretConfigured: Boolean(process.env.AUTH_SECRET?.trim()),
  };
}
