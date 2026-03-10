"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { formatDateTimeLong, formatDateTime } from "@/lib/format-date";
import { Pencil, User as UserIcon, Building2, UserCheck, Calendar, Check, BookOpen } from "lucide-react";
import type { Session } from "next-auth";
import type { Ticket, TicketComment, TicketAttachment, TimeEntry, User, TicketStatus, Priority } from "@/generated/prisma";
import { TicketTimer } from "./ticket-timer";
import { StatusBadge, PriorityBadge } from "./ticket-status-badge";
import { updateTicketStatus } from "@/actions/ticket.actions";
import { addComment } from "@/actions/comment.actions";
import { isStaff, isAdmin } from "@/lib/roles";
import { AttachmentList } from "./attachment-list";
import { AttachmentUploader } from "./attachment-uploader";

type TicketWithDetails = Ticket & {
  createdBy: Pick<User, "id" | "name" | "email">;
  assignedTo: Pick<User, "id" | "name"> | null;
  client: (Pick<User, "id" | "name"> & { companies: { name: string }[] }) | null;
  plan: { id: string; name: string; type: string } | null;
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

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-bold text-gray-900">{ticket.title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin(role) && (
              <Link
                href={`/tickets/${ticket.id}/edit`}
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 rounded px-2 py-1"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </Link>
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
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatDateTimeLong(ticket.createdAt)}
          </span>
        </div>
      </div>

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

function CommentForm({ ticketId, isStaff }: { ticketId: string; isStaff: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [internal, setInternal] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("isInternal", String(internal));
    startTransition(async () => {
      await addComment(ticketId, formData);
      form.reset();
      setInternal(false);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        name="body"
        required
        rows={3}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder="Escribe un comentario..."
      />
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
