/**
 * Conversaciones del agente: WhatsApp y el chat de la plataforma (GENIA).
 *
 * Pide GESTOR sobre Administración, como el feedback: son conversaciones de
 * clientes con nombre, teléfono y datos de sus planes.
 *
 * Una conversación de WhatsApp es un teléfono; una del chat es un
 * `conversationId`. La lista muestra las 150 más recientes de cada canal y el
 * detalle, los últimos 300 mensajes de la elegida.
 */

import Link from "next/link";
import { AlertTriangle, MessageCircle, MonitorSmartphone } from "lucide-react";
import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format-date";

export const metadata = { title: "Conversaciones del agente" };
export const dynamic = "force-dynamic";

const LIST_LIMIT = 150;
const THREAD_LIMIT = 300;

type Canal = "whatsapp" | "web";

type Thread = {
  key: string; // "wa:+57…" | "web:<conversationId>"
  canal: Canal;
  title: string;
  subtitle: string;
  last: Date;
  count: number;
  errors: number;
  preview: string;
};

type Msg = { id: string; role: "user" | "assistant"; content: string; at: Date; error: string | null; audio: boolean };

const short = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

async function whatsappThreads(): Promise<Thread[]> {
  const groups = await prisma.agentMessage.groupBy({
    by: ["phone"],
    where: { channel: "WHATSAPP" },
    _max: { createdAt: true },
    _count: { _all: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: LIST_LIMIT,
  });
  if (groups.length === 0) return [];
  const phones = groups.map((g) => g.phone);

  const [latest, named, errs] = await Promise.all([
    prisma.agentMessage.findMany({
      where: { channel: "WHATSAPP", phone: { in: phones } },
      orderBy: { createdAt: "desc" },
      distinct: ["phone"],
      select: { phone: true, content: true, direction: true },
    }),
    prisma.agentMessage.findMany({
      where: { channel: "WHATSAPP", phone: { in: phones }, clientId: { not: null } },
      orderBy: { createdAt: "desc" },
      distinct: ["phone"],
      select: { phone: true, client: { select: { name: true, email: true } } },
    }),
    prisma.agentMessage.groupBy({
      by: ["phone"],
      where: { channel: "WHATSAPP", phone: { in: phones }, error: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const lastBy = new Map(latest.map((m) => [m.phone, m]));
  const nameBy = new Map(named.map((m) => [m.phone, m.client]));
  const errBy = new Map(errs.map((e) => [e.phone, e._count._all]));

  return groups.map((g): Thread => {
    const client = nameBy.get(g.phone);
    const l = lastBy.get(g.phone);
    return {
      key: `wa:${g.phone}`,
      canal: "whatsapp",
      title: client?.name ?? g.phone,
      subtitle: client ? g.phone : "Número sin cliente",
      last: g._max.createdAt ?? new Date(0),
      count: g._count._all,
      errors: errBy.get(g.phone) ?? 0,
      preview: l ? `${l.direction === "OUT" ? "Agente: " : ""}${short(l.content)}` : "",
    };
  });
}

async function webThreads(): Promise<Thread[]> {
  const groups = await prisma.agentChatMessage.groupBy({
    by: ["conversationId"],
    _max: { createdAt: true },
    _count: { _all: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: LIST_LIMIT,
  });
  if (groups.length === 0) return [];
  const ids = groups.map((g) => g.conversationId);

  const latest = await prisma.agentChatMessage.findMany({
    where: { conversationId: { in: ids } },
    orderBy: { createdAt: "desc" },
    distinct: ["conversationId"],
    select: { conversationId: true, content: true, role: true, user: { select: { name: true, email: true } } },
  });
  const lastBy = new Map(latest.map((m) => [m.conversationId, m]));

  return groups.map((g): Thread => {
    const l = lastBy.get(g.conversationId);
    return {
      key: `web:${g.conversationId}`,
      canal: "web",
      title: l?.user.name ?? "Usuario",
      subtitle: l?.user.email ?? "",
      last: g._max.createdAt ?? new Date(0),
      count: g._count._all,
      errors: 0,
      preview: l ? `${l.role === "assistant" ? "Agente: " : ""}${short(l.content)}` : "",
    };
  });
}

async function threadMessages(key: string): Promise<{ title: string; subtitle: string; canal: Canal; messages: Msg[] } | null> {
  if (key.startsWith("wa:")) {
    const phone = key.slice(3);
    const rows = await prisma.agentMessage.findMany({
      where: { channel: "WHATSAPP", phone },
      orderBy: { createdAt: "desc" },
      take: THREAD_LIMIT,
      select: { id: true, direction: true, content: true, createdAt: true, error: true, client: { select: { name: true } } },
    });
    if (rows.length === 0) return null;
    const client = rows.find((r) => r.client)?.client;
    return {
      title: client?.name ?? phone,
      subtitle: client ? `WhatsApp · ${phone}` : `WhatsApp · ${phone} · sin cliente`,
      canal: "whatsapp",
      messages: rows.reverse().map((r): Msg => ({
        id: r.id, role: r.direction === "IN" ? "user" : "assistant", content: r.content, at: r.createdAt, error: r.error, audio: false,
      })),
    };
  }
  if (key.startsWith("web:")) {
    const conversationId = key.slice(4);
    const rows = await prisma.agentChatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: THREAD_LIMIT,
      select: { id: true, role: true, content: true, kind: true, createdAt: true, user: { select: { name: true, email: true } } },
    });
    if (rows.length === 0) return null;
    return {
      title: rows[0].user.name,
      subtitle: `Chat de la plataforma · ${rows[0].user.email}`,
      canal: "web",
      messages: rows.reverse().map((r): Msg => ({
        id: r.id, role: r.role === "assistant" ? "assistant" : "user", content: r.content, at: r.createdAt, error: null, audio: r.kind === "audio",
      })),
    };
  }
  return null;
}

function CanalIcon({ canal, className }: { canal: Canal; className?: string }) {
  return canal === "whatsapp"
    ? <MessageCircle className={`text-green-600 ${className ?? ""}`} aria-label="WhatsApp" />
    : <MonitorSmartphone className={`text-indigo-600 ${className ?? ""}`} aria-label="Chat de la plataforma" />;
}

export default async function ConversacionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireCan("ADMIN", "gestionar");
  const params = await searchParams;
  const canal: Canal | undefined = params.canal === "whatsapp" || params.canal === "web" ? params.canal : undefined;
  const q = (params.q ?? "").trim().toLowerCase();
  const soloErrores = params.errores === "1";
  const selected = params.c ?? "";

  const [wa, web] = await Promise.all([
    canal === "web" ? [] : whatsappThreads(),
    canal === "whatsapp" || soloErrores ? [] : webThreads(),
  ]);

  const threads = [...wa, ...web]
    .filter((t) => !soloErrores || t.errors > 0)
    .filter((t) => !q || `${t.title} ${t.subtitle}`.toLowerCase().includes(q))
    .sort((a, b) => b.last.getTime() - a.last.getTime());

  const detail = selected ? await threadMessages(selected) : null;

  const link = (over: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { canal, q: params.q, errores: soloErrores ? "1" : undefined, c: selected || undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/admin/conversaciones?${s}` : "/admin/conversaciones";
  };

  const pill = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-medium ${
      active ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"
    }`;

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Conversaciones del agente</h1>
        <p className="mt-1 text-sm text-gray-500">
          Lo que clientes y equipo hablan con el agente por WhatsApp y en el chat de la plataforma.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={link({ canal: undefined, c: undefined })} className={pill(!canal)}>Todos</Link>
        <Link href={link({ canal: "whatsapp", c: undefined })} className={pill(canal === "whatsapp")}>WhatsApp</Link>
        <Link href={link({ canal: "web", c: undefined, errores: undefined })} className={pill(canal === "web")}>Chat de la plataforma</Link>
        <Link href={link({ errores: soloErrores ? undefined : "1", c: undefined })} className={pill(soloErrores)}>
          Con fallas del agente
        </Link>
        <form method="get" className="ml-auto flex items-center gap-2">
          {canal && <input type="hidden" name="canal" value={canal} />}
          {soloErrores && <input type="hidden" name="errores" value="1" />}
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Buscar por nombre o teléfono"
            className="w-56 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="submit" className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700">
            Buscar
          </button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {threads.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-500">
              {q || canal || soloErrores ? "Ninguna conversación coincide." : "Aún no hay conversaciones."}
            </p>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-gray-100 overflow-y-auto">
              {threads.map((t) => (
                <li key={t.key}>
                  <Link
                    href={link({ c: t.key })}
                    className={`block px-4 py-3 hover:bg-gray-50 ${selected === t.key ? "bg-indigo-50" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <CanalIcon canal={t.canal} className="h-4 w-4 shrink-0" />
                      <span className="truncate text-sm font-medium text-gray-900">{t.title}</span>
                      {t.errors > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                          <AlertTriangle className="h-3 w-3" /> {t.errors}
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-[11px] text-gray-400">{formatDateTime(t.last)}</span>
                    </div>
                    {t.subtitle && <p className="mt-0.5 truncate pl-6 text-xs text-gray-500">{t.subtitle}</p>}
                    <p className="mt-1 truncate pl-6 text-xs text-gray-600">{t.preview}</p>
                    <p className="mt-0.5 pl-6 text-[11px] text-gray-400">{t.count} mensajes</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="rounded-xl border border-gray-200 bg-white">
          {!detail ? (
            <p className="p-10 text-center text-sm text-gray-500">
              {selected ? "Esa conversación ya no existe." : "Elige una conversación para ver los mensajes."}
            </p>
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-gray-100 px-5 py-3">
                <CanalIcon canal={detail.canal} className="h-5 w-5" />
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold text-gray-900">{detail.title}</h2>
                  <p className="truncate text-xs text-gray-500">{detail.subtitle}</p>
                </div>
                <span className="ml-auto text-xs text-gray-400">{detail.messages.length} mensajes</span>
              </header>
              <ol className="max-h-[70vh] space-y-3 overflow-y-auto bg-gray-50 px-5 py-4">
                {detail.messages.map((m) => (
                  <li key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                        m.role === "user"
                          ? "rounded-bl-sm bg-white text-gray-900"
                          : m.error
                            ? "rounded-br-sm border border-red-200 bg-red-50 text-red-900"
                            : "rounded-br-sm bg-indigo-600 text-white"
                      }`}
                    >
                      {m.audio && <p className="mb-1 text-[11px] opacity-70">Nota de voz · transcripción</p>}
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      {m.error && (
                        <p className="mt-1.5 flex items-start gap-1 border-t border-red-200 pt-1.5 text-[11px] text-red-700">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>Falla del agente: {m.error}</span>
                        </p>
                      )}
                      <p className={`mt-1 text-right text-[10px] ${m.role === "user" || m.error ? "text-gray-400" : "text-indigo-100"}`}>
                        {formatDateTime(m.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
