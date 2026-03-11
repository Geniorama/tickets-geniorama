"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { formatDateTimeLong, formatDateTime } from "@/lib/format-date";
import { Pencil, User as UserIcon, Building2, UserCheck, Calendar, Check, BookOpen, Link2, Paperclip, FileText, ExternalLink, Globe, ChevronDown } from "lucide-react";
import type { Session } from "next-auth";
import type { Ticket, TicketComment, TicketAttachment, TimeEntry, User, TicketStatus, Priority } from "@/generated/prisma";
import { TicketTimer } from "./ticket-timer";
import { TicketAiAssistant } from "./ticket-ai-assistant";
import { StatusBadge, PriorityBadge } from "./ticket-status-badge";
import { updateTicketStatus, deleteTicket } from "@/actions/ticket.actions";
import { addComment } from "@/actions/comment.actions";
import { isStaff, isAdmin } from "@/lib/roles";
import { AttachmentList } from "./attachment-list";
import { AttachmentUploader } from "./attachment-uploader";

type TicketWithDetails = Ticket & {
  createdBy: Pick<User, "id" | "name" | "email">;
  assignedTo: Pick<User, "id" | "name"> | null;
  client: (Pick<User, "id" | "name"> & { companies: { name: string }[] }) | null;
  plan: { id: string; name: string; type: string } | null;
  site: { id: string; name: string; domain: string; documentation: string | null; architecture: string | null } | null;
  attachments: TicketAttachment[];
  timeEntries: (TimeEntry & { user: Pick<User, "name"> })[];
  comments: (TicketComment & {
    author: Pick<User, "name" | "role">;
  })[];
};

const statusOptions: { value: TicketStatus; label: string }[] = [
  { value: "ABIERTO", label: "Abierto" },
  { value: "EN_PROGRESO", label: "En progreso" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "CERRADO", label: "Cerrado" },
];

export function TicketDetail({
  ticket,
  session,
}: {
  ticket: TicketWithDetails;
  session: Session;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const role = session.user.role;
  const staff = isStaff(role);

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    startTransition(async () => {
      await updateTicketStatus(ticket.id, e.target.value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  function handleDeleteTicket() {
    if (!confirm(`¿Eliminar el ticket "${ticket.title}"? Esta acción no se puede deshacer.`)) return;
    startTransition(() => deleteTicket(ticket.id));
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-bold text-gray-900">{ticket.title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin(role) && (
              <>
                <Link
                  href={`/tickets/${ticket.id}/edit`}
                  className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 rounded px-2 py-1"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </Link>
                <button
                  onClick={handleDeleteTicket}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 font-medium border border-red-200 rounded px-2 py-1 disabled:opacity-50"
                >
                  Eliminar
                </button>
              </>
            )}
            <PriorityBadge priority={ticket.priority as Priority} />
            {staff ? (
              <div className="relative flex items-center gap-1.5">
                <select
                  defaultValue={ticket.status}
                  onChange={handleStatusChange}
                  disabled={isPending}
                  className="text-xs text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {saved && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium animate-fade-in">
                    <Check className="w-3.5 h-3.5" />
                    Guardado
                  </span>
                )}
              </div>
            ) : (
              <StatusBadge status={ticket.status as TicketStatus} />
            )}
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600 whitespace-pre-wrap">{ticket.description}</div>

        <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400 flex flex-wrap gap-4">
          <span className="flex items-center gap-1">
            <UserIcon className="w-3.5 h-3.5" />
            Creado por: <strong className="text-gray-600">{ticket.createdBy.name}</strong>
          </span>
          <span className="flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" />
            Cliente:{" "}
            <strong className="text-gray-600">
              {ticket.client
                ? `${ticket.client.name}${ticket.client.companies.length > 0 ? ` (${ticket.client.companies.map((c) => c.name).join(", ")})` : ""}`
                : "Sin asignar"}
            </strong>
          </span>
          <span className="flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5" />
            Asignado a: <strong className="text-gray-600">{ticket.assignedTo?.name ?? "Sin asignar"}</strong>
          </span>
          {ticket.plan && (
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              Plan:{" "}
              <strong className="text-gray-600">{ticket.plan.name}</strong>
              <span className="ml-1 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                {ticket.plan.type === "BOLSA_HORAS" ? "Bolsa de horas" : "Soporte mensual"}
              </span>
            </span>
          )}
          {ticket.site && (
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" />
              Sitio:{" "}
              <strong className="text-gray-600">{ticket.site.name}</strong>
              <span className="ml-1 text-gray-400">({ticket.site.domain})</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatDateTimeLong(ticket.createdAt)}
          </span>
        </div>
      </div>

      {staff && ticket.site && (ticket.site.documentation || ticket.site.architecture) && (
        <SiteContextPanel site={ticket.site} />
      )}

      {staff && <TicketAiAssistant ticketId={ticket.id} />}

      {(staff || (ticket.status === "CERRADO" && ticket.timeEntries.length > 0)) && (
        <TicketTimer
          ticketId={ticket.id}
          entries={ticket.timeEntries}
          canControl={staff}
          isAdmin={isAdmin(role)}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Archivos adjuntos ({ticket.attachments.length})
        </h2>
        <AttachmentList
          attachments={ticket.attachments}
          ticketId={ticket.id}
          isAdmin={isAdmin(role)}
        />
        <div className="mt-4 pt-4 border-t border-gray-100">
          <AttachmentUploader ticketId={ticket.id} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Comentarios ({ticket.comments.length})
        </h2>

        {ticket.comments.length > 0 ? (
          <div className="space-y-4 mb-6">
            {ticket.comments.map((comment) => (
              <div
                key={comment.id}
                className={`p-3 rounded-lg text-sm ${
                  comment.isInternal
                    ? "bg-amber-50 border border-amber-200"
                    : "bg-gray-50 border border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-800">{comment.author.name}</span>
                  {comment.isInternal && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                      Interno
                    </span>
                  )}
                  <span className="text-gray-400 text-xs ml-auto">
                    {formatDateTime(comment.createdAt)}
                  </span>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{comment.body}</p>

                {/* Adjunto del comentario */}
                {comment.attachmentUrl && comment.attachmentType === "link" && (
                  <a
                    href={comment.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    {comment.attachmentName ?? comment.attachmentUrl}
                  </a>
                )}
                {comment.attachmentUrl && comment.attachmentType === "file" && (
                  <a
                    href={comment.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    {comment.attachmentName ?? "Archivo adjunto"}
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 mb-6">No hay comentarios aún.</p>
        )}

        <CommentForm ticketId={ticket.id} isStaff={staff} />
      </div>
    </div>
  );
}

function SiteContextPanel({
  site,
}: {
  site: { name: string; domain: string; documentation: string | null; architecture: string | null };
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <Globe className="w-4 h-4 text-indigo-500 shrink-0" />
          Contexto del sitio: {site.name}
          <span className="text-sm font-normal text-gray-400">({site.domain})</span>
        </span>
        <ChevronDown
          className="w-4 h-4 text-gray-400 shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-4 border-t border-gray-100">
          {site.documentation && (
            <div className="pt-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Documentación</p>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {site.documentation}
              </pre>
            </div>
          )}
          {site.architecture && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Arquitectura</p>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {site.architecture}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type AttachmentMode = "none" | "link" | "file";

function CommentForm({ ticketId, isStaff }: { ticketId: string; isStaff: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [internal, setInternal] = useState(false);
  const [attachMode, setAttachMode] = useState<AttachmentMode>("none");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("isInternal", String(internal));
    formData.set("attachmentType", attachMode === "none" ? "" : attachMode);

    startTransition(async () => {
      const result = await addComment(ticketId, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        form.reset();
        setInternal(false);
        setAttachMode("none");
      }
    });
  }

  const inputCls =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        name="body"
        required
        rows={3}
        className={inputCls}
        placeholder="Escribe un comentario..."
      />

      {/* Adjunto — solo staff */}
      {isStaff && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Adjuntar:</span>
            <button
              type="button"
              onClick={() => setAttachMode(attachMode === "link" ? "none" : "link")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                attachMode === "link"
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <Link2 className="w-3 h-3" />
              Enlace
            </button>
            <button
              type="button"
              onClick={() => setAttachMode(attachMode === "file" ? "none" : "file")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                attachMode === "file"
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <Paperclip className="w-3 h-3" />
              Archivo
            </button>
          </div>

          {attachMode === "link" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">URL *</label>
                <input
                  name="linkUrl"
                  type="url"
                  required
                  placeholder="https://..."
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Etiqueta (opcional)</label>
                <input
                  name="linkLabel"
                  type="text"
                  placeholder="Nombre del enlace"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {attachMode === "file" && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Archivo * (imágenes, PDF, Word — máx. 10 MB)
              </label>
              <input
                name="attachmentFile"
                type="file"
                required
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
                className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        {isStaff && (
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={internal}
              onChange={(e) => setInternal(e.target.checked)}
              className="rounded"
            />
            Nota interna (solo staff)
          </label>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {isPending ? "Enviando..." : "Comentar"}
        </button>
      </div>
    </form>
  );
}
