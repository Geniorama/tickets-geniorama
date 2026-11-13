/**
 * Buzón de feedback (AG·P-1).
 *
 * Pide GESTOR sobre Administración, como el historial: el feedback trae el
 * nombre, la empresa y la pantalla de quien lo escribió, y no se reparte.
 */

import Link from "next/link";
import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { formatDateTimeLong } from "@/lib/format-date";
import { Pagination } from "@/components/ui/pagination";
import { getPageSize } from "@/lib/pagination";
import { FeedbackActions } from "@/components/feedback/feedback-actions";
import {
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABELS,
  isFeedbackStatus,
  isFeedbackType,
} from "@/lib/feedback";

export const metadata = { title: "Feedback" };

const TYPE_TONE: Record<string, string> = {
  ERROR: "bg-red-50 text-red-700",
  IDEA: "bg-indigo-50 text-indigo-700",
  CONFUSO: "bg-amber-50 text-amber-800",
  OTRO: "bg-gray-100 text-gray-700",
};

const STATUS_TONE: Record<string, string> = {
  NUEVO: "bg-blue-50 text-blue-700",
  EN_REVISION: "bg-amber-50 text-amber-800",
  CONVERTIDO: "bg-green-50 text-green-700",
  DESCARTADO: "bg-gray-100 text-gray-500",
};

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireCan("ADMIN", "gestionar");
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = getPageSize(params.pageSize);

  const type = isFeedbackType(params.type) ? params.type : undefined;
  const status = isFeedbackStatus(params.status) ? params.status : undefined;
  const companyId = params.company || undefined;

  const where: Prisma.FeedbackWhereInput = {
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...(companyId ? { companyId } : {}),
  };

  const [rows, total, companies, projects, counts] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { task: { select: { id: true, projectId: true } } },
    }),
    prisma.feedback.count({ where }),
    prisma.company.findMany({
      where: { feedback: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.project.findMany({
      where: { isActive: true, isDraft: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.feedback.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  // El proyecto de producto, si existe, es el destino natural de la mayoría.
  const defaultProjectId = (projects.find((p) => /producto/i.test(p.name)) ?? projects[0])?.id ?? "";

  const select =
    "rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
        <p className="mt-1 text-sm text-gray-500">
          Lo que clientes y equipo dejan desde el botón «Feedback» de la app.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FEEDBACK_STATUSES.map((s) => (
          <Link
            key={s}
            href={status === s ? "/admin/feedback" : `/admin/feedback?status=${s}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              status === s ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {FEEDBACK_STATUS_LABELS[s]} · {countOf(s)}
          </Link>
        ))}
      </div>

      <form method="get" className="mb-5 flex flex-wrap items-center gap-2">
        <select name="type" defaultValue={type ?? ""} className={select} aria-label="Tipo">
          <option value="">Todos los tipos</option>
          {FEEDBACK_TYPES.map((t) => (
            <option key={t} value={t}>{FEEDBACK_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ""} className={select} aria-label="Estado">
          <option value="">Todos los estados</option>
          {FEEDBACK_STATUSES.map((s) => (
            <option key={s} value={s}>{FEEDBACK_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select name="company" defaultValue={companyId ?? ""} className={select} aria-label="Empresa">
          <option value="">Todas las empresas</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700">
          Filtrar
        </button>
        {(type || status || companyId) && (
          <Link href="/admin/feedback" className="text-sm text-gray-500 hover:underline">Limpiar</Link>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          {type || status || companyId ? "Ningún feedback coincide con los filtros." : "Aún no hay feedback."}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((f) => (
            <li key={f.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-1 font-medium ${TYPE_TONE[f.type]}`}>
                  {FEEDBACK_TYPE_LABELS[f.type]}
                </span>
                <span className={`rounded-full px-2.5 py-1 font-medium ${STATUS_TONE[f.status]}`}>
                  {FEEDBACK_STATUS_LABELS[f.status]}
                </span>
                <span className="text-gray-500">
                  {f.userName} · {f.userRole.toLowerCase()}
                  {f.companyName ? ` · ${f.companyName}` : ""}
                </span>
                <span className="ml-auto text-gray-400">{formatDateTimeLong(f.createdAt)}</span>
              </div>

              <p className="whitespace-pre-wrap text-sm text-gray-900">{f.message}</p>

              <dl className="mt-3 space-y-0.5 text-xs text-gray-500">
                {f.pageUrl && (
                  <div className="truncate">
                    <dt className="inline font-medium">Pantalla: </dt>
                    <dd className="inline">{f.pageUrl}</dd>
                  </div>
                )}
                {f.userAgent && (
                  <div className="truncate">
                    <dt className="inline font-medium">Navegador: </dt>
                    <dd className="inline">{f.userAgent}{f.viewport ? ` · ${f.viewport}` : ""}</dd>
                  </div>
                )}
                {f.screenshotUrl && (
                  <div>
                    <dt className="inline font-medium">Captura: </dt>
                    <dd className="inline">
                      <a href={f.screenshotUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                        Abrir imagen
                      </a>
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mt-3 border-t border-gray-100 pt-3">
                <FeedbackActions
                  id={f.id}
                  status={f.status}
                  taskUrl={f.task ? `/proyectos/${f.task.projectId}/tareas/${f.task.id}` : null}
                  projects={projects}
                  defaultProjectId={defaultProjectId}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <Pagination totalItems={total} currentPage={page} pageSize={pageSize} params={params} basePath="/admin/feedback" />
      </div>
    </div>
  );
}
