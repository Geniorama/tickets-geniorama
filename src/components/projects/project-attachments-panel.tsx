"use client";

import { useState, useTransition, useRef } from "react";
import { Paperclip, Link2, Trash2, FileText, ExternalLink, Plus, X, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  addProjectFile,
  addProjectLink,
  deleteProjectAttachment,
  reorderProjectAttachments,
} from "@/actions/project-attachment.actions";

interface Attachment {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  storagePath: string | null;
  uploadedBy: { name: string };
  createdAt: Date;
}

interface ProjectAttachmentsPanelProps {
  projectId: string;
  attachments: Attachment[];
  canManage: boolean;
}

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--app-border)",
  borderRadius: "0.375rem",
  padding: "0.4rem 0.625rem",
  fontSize: "0.8125rem",
  color: "var(--app-body-text)",
  backgroundColor: "var(--app-input-bg)",
  outline: "none",
  flex: 1,
};

// ─── Sortable item ────────────────────────────────────────────────────────────

function SortableAttachment({
  att,
  canManage,
  isPending,
  onDelete,
}: {
  att: Attachment;
  canManage: boolean;
  isPending: boolean;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: att.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    display: "flex",
    alignItems: "center",
    gap: "0.625rem",
    padding: "0.5rem 0.625rem",
    borderRadius: "0.375rem",
    border: "1px solid var(--app-border)",
    backgroundColor: isDragging ? "var(--app-card-bg)" : "var(--app-input-bg)",
    listStyle: "none",
  };

  return (
    <li ref={setNodeRef} style={style}>
      {canManage && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          style={{
            background: "none",
            border: "none",
            cursor: "grab",
            color: "var(--app-text-muted)",
            padding: "0.125rem",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            touchAction: "none",
          }}
          title="Arrastrar para reordenar"
        >
          <GripVertical style={{ width: "0.875rem", height: "0.875rem" }} />
        </button>
      )}

      {att.type === "link" ? (
        <Link2 style={{ width: "0.875rem", height: "0.875rem", color: "#fd1384", flexShrink: 0 }} />
      ) : (
        <FileText style={{ width: "0.875rem", height: "0.875rem", color: "var(--app-text-muted)", flexShrink: 0 }} />
      )}

      <a
        href={att.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: "0.8125rem",
          color: "var(--app-body-text)",
          textDecoration: "none",
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
        }}
      >
        {att.fileName}
        <ExternalLink style={{ width: "0.75rem", height: "0.75rem", flexShrink: 0, opacity: 0.5 }} />
      </a>

      <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", flexShrink: 0 }}>
        {att.uploadedBy.name}
      </span>

      {canManage && (
        <button
          type="button"
          onClick={() => onDelete(att.id)}
          disabled={isPending}
          style={{
            background: "none",
            border: "none",
            cursor: isPending ? "not-allowed" : "pointer",
            color: "var(--app-text-muted)",
            padding: "0.125rem",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            opacity: isPending ? 0.5 : 1,
          }}
          title="Eliminar adjunto"
        >
          <Trash2 style={{ width: "0.875rem", height: "0.875rem" }} />
        </button>
      )}
    </li>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────

export function ProjectAttachmentsPanel({
  projectId,
  attachments: initialAttachments,
  canManage,
}: ProjectAttachmentsPanelProps) {
  const [items, setItems] = useState(initialAttachments);
  const [isPending, startTransition] = useTransition();
  const [fileError, setFileError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  // Sync when server re-renders the component (new attachment added / deleted)
  // We keep local state for optimistic DnD reordering
  const prevInitial = useRef(initialAttachments);
  if (prevInitial.current !== initialAttachments) {
    prevInitial.current = initialAttachments;
    setItems(initialAttachments);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((a) => a.id === active.id);
    const newIndex = items.findIndex((a) => a.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered); // optimistic

    startTransition(async () => {
      await reorderProjectAttachments(projectId, reordered.map((a) => a.id));
    });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const result = await addProjectFile(projectId, fd);
      if (result?.error) setFileError(result.error);
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function handleAddLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLinkError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addProjectLink(projectId, fd);
      if (result?.error) {
        setLinkError(result.error);
      } else {
        setShowLinkForm(false);
        (e.target as HTMLFormElement).reset();
      }
    });
  }

  function handleDelete(attachmentId: string) {
    if (!confirm("¿Eliminar este adjunto?")) return;
    startTransition(async () => {
      await deleteProjectAttachment(attachmentId, projectId);
    });
  }

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        padding: "1.25rem 1.5rem",
        marginTop: "1.5rem",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h3
          style={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--app-body-text)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            margin: 0,
          }}
        >
          <Paperclip style={{ width: "1rem", height: "1rem" }} />
          Adjuntos y enlaces
        </h3>

        {canManage && (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "0.8125rem",
                color: "var(--app-text-muted)",
                border: "1px solid var(--app-border)",
                borderRadius: "0.375rem",
                padding: "0.25rem 0.625rem",
                backgroundColor: "transparent",
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              <Plus style={{ width: "0.75rem", height: "0.75rem" }} />
              Archivo
            </button>
            <button
              type="button"
              onClick={() => { setShowLinkForm(!showLinkForm); setLinkError(null); }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "0.8125rem",
                color: "var(--app-text-muted)",
                border: "1px solid var(--app-border)",
                borderRadius: "0.375rem",
                padding: "0.25rem 0.625rem",
                backgroundColor: "transparent",
                cursor: "pointer",
              }}
            >
              <Link2 style={{ width: "0.75rem", height: "0.75rem" }} />
              Enlace
            </button>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              onChange={handleFileUpload}
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
            />
          </div>
        )}
      </div>

      {fileError && (
        <p style={{ fontSize: "0.8125rem", color: "#b91c1c", marginBottom: "0.75rem" }}>{fileError}</p>
      )}

      {showLinkForm && (
        <form
          onSubmit={handleAddLink}
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "flex-start",
            marginBottom: "1rem",
            flexWrap: "wrap",
            backgroundColor: "var(--app-input-bg)",
            border: "1px solid var(--app-border)",
            borderRadius: "0.5rem",
            padding: "0.75rem",
          }}
        >
          <input name="name" required placeholder="Nombre del enlace" style={{ ...inputStyle, minWidth: "10rem" }} />
          <input name="url" type="url" required placeholder="https://..." style={{ ...inputStyle, minWidth: "14rem" }} />
          <div style={{ display: "flex", gap: "0.375rem" }}>
            <button
              type="submit"
              disabled={isPending}
              style={{
                backgroundColor: "#fd1384",
                color: "#fff",
                border: "none",
                borderRadius: "0.375rem",
                padding: "0.4rem 0.75rem",
                fontSize: "0.8125rem",
                fontWeight: 500,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              Añadir
            </button>
            <button
              type="button"
              onClick={() => { setShowLinkForm(false); setLinkError(null); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--app-text-muted)", padding: "0.4rem" }}
            >
              <X style={{ width: "1rem", height: "1rem" }} />
            </button>
          </div>
          {linkError && (
            <p style={{ width: "100%", fontSize: "0.8125rem", color: "#b91c1c", marginTop: "0.25rem" }}>{linkError}</p>
          )}
        </form>
      )}

      {items.length === 0 ? (
        <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", fontStyle: "italic" }}>
          Sin adjuntos.{canManage ? " Añade archivos o enlaces para dar contexto al proyecto." : ""}
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {items.map((att) => (
                <SortableAttachment
                  key={att.id}
                  att={att}
                  canManage={canManage}
                  isPending={isPending}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
