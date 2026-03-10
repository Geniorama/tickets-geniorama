"use client";

import { useTransition } from "react";
import type { TicketAttachment } from "@/generated/prisma";
import { deleteAttachment } from "@/actions/attachment.actions";

function fileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext ?? "")) return "🖼️";
  if (ext === "pdf") return "📄";
  if (["doc", "docx"].includes(ext ?? "")) return "📝";
  return "📎";
}

export function AttachmentList({
  attachments,
  ticketId,
  isAdmin,
}: {
  attachments: TicketAttachment[];
  ticketId: string;
  isAdmin: boolean;
}) {
  if (attachments.length === 0) {
    return <p className="text-sm text-gray-400">Sin archivos adjuntos.</p>;
  }

  return (
    <ul className="space-y-2">
      {attachments.map((att) => (
        <AttachmentRow
          key={att.id}
          attachment={att}
          ticketId={ticketId}
          isAdmin={isAdmin}
        />
      ))}
    </ul>
  );
}

function AttachmentRow({
  attachment,
  ticketId,
  isAdmin,
}: {
  attachment: TicketAttachment;
  ticketId: string;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <li className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 border border-gray-200 text-sm">
      <span className="text-base">{fileIcon(attachment.fileName)}</span>
      <span className="flex-1 truncate text-gray-700">{attachment.fileName}</span>
      <a
        href={attachment.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-600 hover:text-indigo-800 font-medium shrink-0"
      >
        Descargar
      </a>
      {isAdmin && (
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await deleteAttachment(attachment.id, ticketId);
            })
          }
          className="text-red-500 hover:text-red-700 disabled:opacity-50 shrink-0"
          title="Eliminar adjunto"
        >
          {isPending ? "..." : "✕"}
        </button>
      )}
    </li>
  );
}
