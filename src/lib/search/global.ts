/**
 * Buscador global.
 *
 * Con la app partida en módulos, encontrar algo exige acordarse primero de en
 * cuál vive. Esto lo evita: se escribe y aparece lo que haya, venga de donde
 * venga, agrupado por módulo para no perder el contexto de dónde está cada cosa.
 *
 * Dos reglas que sostienen todo lo demás:
 *
 *   · **Un módulo sin conceder no se busca.** No es que sus resultados se
 *     escondan al pintarlos: la consulta ni se lanza. Así el buscador no puede
 *     convertirse en la rendija por la que se escapa lo que las pantallas
 *     protegen.
 *   · **La frontera de datos es la de siempre.** Se importa de
 *     `search/scopes.ts`, el mismo sitio del que la leen los listados.
 */

import { prisma } from "@/lib/prisma";
import type { AppKey } from "@/generated/prisma";
import { can } from "@/lib/access/can";
import { APP_BY_KEY } from "@/lib/access/apps";
import { ticketCode } from "@/lib/ticket-code";
import { taskCode } from "@/lib/task-code";
import { ACCOUNT_STAGE_LABELS } from "@/lib/crm/accounts";
import { DEAL_STAGE_LABELS } from "@/lib/crm/deals";
import { visibleProjectWhere, visibleTaskWhere, visibleTicketWhere, type Viewer } from "@/lib/search/scopes";

export type SearchHit = {
  id: string;
  app: AppKey;
  /** Etiqueta del tipo de cosa, para que se distinga un ticket de una tarea. */
  kind: string;
  title: string;
  subtitle: string | null;
  href: string;
};

/** Cuántos resultados como mucho por cada módulo. */
const PER_GROUP = 5;

/** Debajo de tres letras casi todo coincide y el resultado no ayuda. */
export const MIN_QUERY_LENGTH = 3;

const like = (q: string) => ({ contains: q, mode: "insensitive" as const });

/**
 * ¿Se busca dentro de este módulo?
 *
 * No basta con preguntar `can()`. Hay módulos que todavía no aplican niveles
 * —siguen decidiendo por rol, como marca `enforced` en el registro— y para
 * ellos exigir un nivel dejaría al buscador más cerrado que el propio módulo:
 * alguien vería sus tickets en la pantalla y no los encontraría aquí. Mientras
 * un módulo no esté migrado, se usa su mismo criterio.
 *
 * La frontera del rol se comprueba siempre: un cliente no entra al CRM ni a la
 * administración por mucho que el módulo no aplique niveles todavía. Y la
 * frontera de **datos** la sigue poniendo cada consulta, así que un cliente
 * busca tickets pero solo encuentra los suyos.
 */
async function moduloAbierto(viewer: Viewer, app: AppKey): Promise<boolean> {
  const definicion = APP_BY_KEY.get(app);
  if (!definicion) return false;
  if (!definicion.allowedRoles.includes(viewer.role)) return false;
  if (!definicion.enforced) return true;
  return can(viewer, app, "ver");
}

export async function globalSearch(viewer: Viewer, rawQuery: string): Promise<SearchHit[]> {
  const q = rawQuery.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];

  // Qué módulos entran en la búsqueda. Se resuelve una vez y en paralelo.
  const [verTickets, verProyectos, verCrm, verInfra, verAdmin] = await Promise.all([
    moduloAbierto(viewer, "TICKETS"),
    moduloAbierto(viewer, "PROYECTOS"),
    moduloAbierto(viewer, "CRM"),
    moduloAbierto(viewer, "INFRAESTRUCTURA"),
    moduloAbierto(viewer, "ADMIN"),
  ]);

  const grupos = await Promise.all([
    verTickets  ? buscarTickets(viewer, q)  : [],
    verProyectos ? buscarProyectos(viewer, q) : [],
    verProyectos ? buscarTareas(viewer, q)  : [],
    verCrm      ? buscarCuentas(q)          : [],
    verCrm      ? buscarOportunidades(q)    : [],
    verInfra    ? buscarSitios(q)           : [],
    verAdmin    ? buscarEmpresas(q)         : [],
    verAdmin    ? buscarUsuarios(q)         : [],
  ]);

  return grupos.flat();
}

// ─── Por módulo ──────────────────────────────────────────────────────────────

async function buscarTickets(viewer: Viewer, q: string): Promise<SearchHit[]> {
  const scope = await visibleTicketWhere(viewer);

  const rows = await prisma.ticket.findMany({
    where: { AND: [scope, { OR: [{ title: like(q) }, { description: like(q) }] }] },
    select: { id: true, title: true, status: true, prefix: true, number: true },
    orderBy: { updatedAt: "desc" },
    take: PER_GROUP,
  });

  return rows.map((t) => ({
    id: t.id,
    app: "TICKETS" as AppKey,
    kind: "Ticket",
    title: t.title,
    subtitle: `${ticketCode(t.prefix, t.number)} · ${estado(t.status)}`,
    href: `/tickets/${t.id}`,
  }));
}

async function buscarProyectos(viewer: Viewer, q: string): Promise<SearchHit[]> {
  const scope = await visibleProjectWhere(viewer);

  const rows = await prisma.project.findMany({
    where: { AND: [scope, { OR: [{ name: like(q) }, { description: like(q) }] }] },
    select: { id: true, name: true, status: true, company: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: PER_GROUP,
  });

  return rows.map((p) => ({
    id: p.id,
    app: "PROYECTOS" as AppKey,
    kind: "Proyecto",
    title: p.name,
    subtitle: [p.company?.name, estado(p.status)].filter(Boolean).join(" · ") || null,
    href: `/proyectos/${p.id}`,
  }));
}

async function buscarTareas(viewer: Viewer, q: string): Promise<SearchHit[]> {
  const scope = await visibleTaskWhere(viewer);

  const rows = await prisma.task.findMany({
    where: { AND: [scope, { OR: [{ title: like(q) }, { description: like(q) }] }] },
    select: {
      id: true, title: true, status: true, number: true,
      project: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: PER_GROUP,
  });

  return rows.map((t) => ({
    id: t.id,
    app: "PROYECTOS" as AppKey,
    kind: "Tarea",
    title: t.title,
    subtitle: [
      t.project ? taskCode(t.project.name, t.number) : null,
      t.project?.name,
      estado(t.status),
    ].filter(Boolean).join(" · ") || null,
    // Una tarea sin proyecto vive en su propia ruta; con proyecto, dentro de él.
    href: t.project ? `/proyectos/${t.project.id}/tareas/${t.id}` : `/tareas/${t.id}`,
  }));
}

async function buscarCuentas(q: string): Promise<SearchHit[]> {
  const rows = await prisma.company.findMany({
    where: { OR: [{ name: like(q) }, { taxId: like(q) }] },
    select: { id: true, name: true, stage: true, _count: { select: { deals: true } } },
    orderBy: { name: "asc" },
    take: PER_GROUP,
  });

  return rows.map((c) => ({
    id: c.id,
    app: "CRM" as AppKey,
    kind: "Cuenta",
    title: c.name,
    subtitle: [
      ACCOUNT_STAGE_LABELS[c.stage],
      c._count.deals > 0 ? `${c._count.deals} ${c._count.deals === 1 ? "oportunidad" : "oportunidades"}` : null,
    ].filter(Boolean).join(" · "),
    href: `/crm/${c.id}`,
  }));
}

async function buscarOportunidades(q: string): Promise<SearchHit[]> {
  const rows = await prisma.deal.findMany({
    where: { OR: [{ title: like(q) }, { notes: like(q) }] },
    select: { id: true, title: true, stage: true, company: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: PER_GROUP,
  });

  return rows.map((d) => ({
    id: d.id,
    app: "CRM" as AppKey,
    kind: "Oportunidad",
    title: d.title,
    subtitle: `${d.company.name} · ${DEAL_STAGE_LABELS[d.stage]}`,
    href: `/crm/oportunidades/${d.id}`,
  }));
}

async function buscarSitios(q: string): Promise<SearchHit[]> {
  const rows = await prisma.site.findMany({
    where: { OR: [{ name: like(q) }, { domain: like(q) }] },
    select: { id: true, name: true, domain: true, company: { select: { name: true } } },
    orderBy: { name: "asc" },
    take: PER_GROUP,
  });

  return rows.map((s) => ({
    id: s.id,
    app: "INFRAESTRUCTURA" as AppKey,
    kind: "Sitio",
    title: s.name,
    subtitle: [s.domain, s.company?.name].filter(Boolean).join(" · ") || null,
    href: `/admin/sitios/${s.id}/edit`,
  }));
}

async function buscarEmpresas(q: string): Promise<SearchHit[]> {
  const rows = await prisma.company.findMany({
    where: { OR: [{ name: like(q) }, { taxId: like(q) }] },
    select: { id: true, name: true, taxId: true, isActive: true },
    orderBy: { name: "asc" },
    take: PER_GROUP,
  });

  return rows.map((c) => ({
    id: c.id,
    app: "ADMIN" as AppKey,
    kind: "Empresa",
    title: c.name,
    subtitle: [c.taxId, c.isActive ? null : "Inactiva"].filter(Boolean).join(" · ") || null,
    href: `/admin/companies/${c.id}/edit`,
  }));
}

async function buscarUsuarios(q: string): Promise<SearchHit[]> {
  const rows = await prisma.user.findMany({
    where: { OR: [{ name: like(q) }, { email: like(q) }] },
    select: { id: true, name: true, email: true, role: true, isActive: true },
    orderBy: { name: "asc" },
    take: PER_GROUP,
  });

  return rows.map((u) => ({
    id: u.id,
    app: "ADMIN" as AppKey,
    kind: "Usuario",
    title: u.name,
    subtitle: [u.email, u.isActive ? null : "Inactivo"].filter(Boolean).join(" · "),
    href: `/admin/users/${u.id}`,
  }));
}

/** Los enums se guardan en mayúsculas con guion bajo; se leen mejor así. */
function estado(value: string): string {
  const texto = value.replace(/_/g, " ").toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
