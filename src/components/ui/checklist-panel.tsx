"use client";

import { useState, useRef, useTransition } from "react";
import { Check, GripVertical, ListPlus, Plus, X } from "lucide-react";
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  addTicketChecklist,
  renameTicketChecklist,
  deleteTicketChecklist,
  reorderTicketChecklists,
  addTicketChecklistItem,
  addTicketChecklistItems,
  toggleTicketChecklistItem,
  updateTicketChecklistItem,
  deleteTicketChecklistItem,
} from "@/actions/checklist.actions";
import {
  addTaskChecklist,
  renameTaskChecklist,
  deleteTaskChecklist,
  reorderTaskChecklists,
  addTaskChecklistItem,
  addTaskChecklistItems,
  toggleTaskChecklistItem,
  updateTaskChecklistItem,
  deleteTaskChecklistItem,
} from "@/actions/checklist.actions";
import { parseChecklistPaste } from "@/lib/checklist-paste";
import { DEFAULT_CHECKLIST_TITLE } from "@/lib/checklist";
import { applyChecklistDrag, itemDragId, listDragId, zoneDragId } from "@/lib/checklist-dnd";

type Item = { id: string; title: string; isChecked: boolean };
type Checklist = { id: string; title: string; items: Item[] };

/** Lo recién agregado vive con un id temporal hasta que el servidor responde. */
const isTempId = (id: string) => id.startsWith("temp-");

const ACCENT = "#fd1384";

// ─── Texto editable en línea ──────────────────────────────────────────────────

function EditableText({
  value,
  editable,
  onChange,
  style,
  inputStyle,
  title,
}: {
  value: string;
  editable: boolean;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  title?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // Escape cancela: marcamos para que el blur posterior no guarde el borrador.
  const cancelled = useRef(false);

  function commit() {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const t = draft.trim();
    if (t && t !== value) onChange(t);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={draft}
        maxLength={200}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); cancelled.current = true; setEditing(false); }
        }}
        onFocus={(e) => e.currentTarget.select()}
        style={{
          minWidth: 0,
          padding: "0.1875rem 0.375rem",
          border: `1px solid ${ACCENT}`,
          borderRadius: "0.25rem",
          backgroundColor: "var(--app-card-bg)",
          color: "var(--app-body-text)",
          outline: "none",
          ...inputStyle,
        }}
      />
    );
  }

  return (
    <span
      onClick={() => {
        if (!editable) return;
        setDraft(value);
        cancelled.current = false;
        setEditing(true);
      }}
      title={editable ? (title ?? "Clic para editar") : undefined}
      style={{
        minWidth: 0,
        wordBreak: "break-word",
        cursor: editable ? "text" : "default",
        padding: "0.1875rem 0.375rem",
        borderRadius: "0.25rem",
        ...style,
      }}
    >
      {value}
    </span>
  );
}

// ─── Ítem ─────────────────────────────────────────────────────────────────────

function ChecklistRow({
  item,
  index,
  canManage,
  readOnly,
  onToggle,
  onDelete,
  onRename,
}: {
  item: Item;
  index: number;
  canManage: boolean;
  readOnly: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const editable = canManage && !readOnly && !isTempId(item.id);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: itemDragId(item.id),
    disabled: !editable,
  });

  const [hover, setHover] = useState(false);

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        borderRadius: "0.375rem",
        padding: "0.125rem 0.25rem",
        backgroundColor: isDragging ? "var(--app-card-bg)" : "transparent",
      }}
    >
      {editable ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          title="Arrastrar para reordenar"
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            background: "none",
            border: "none",
            padding: 0,
            color: "var(--app-text-muted)",
            cursor: "grab",
            touchAction: "none",
            opacity: hover || isDragging ? 0.7 : 0,
            transition: "opacity 0.15s",
          }}
        >
          <GripVertical style={{ width: "0.875rem", height: "0.875rem" }} />
        </button>
      ) : (
        <span style={{ flexShrink: 0, width: "0.875rem" }} />
      )}

      <span
        style={{
          flexShrink: 0,
          minWidth: "1.25rem",
          textAlign: "right",
          fontSize: "0.75rem",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: "var(--app-text-muted)",
        }}
      >
        {index + 1}.
      </span>

      <button
        type="button"
        onClick={onToggle}
        disabled={readOnly}
        style={{
          flexShrink: 0,
          width: "1.125rem",
          height: "1.125rem",
          borderRadius: "0.25rem",
          border: item.isChecked ? "2px solid #22c55e" : "2px solid rgba(128,128,128,0.4)",
          backgroundColor: item.isChecked ? "#22c55e" : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: readOnly ? "default" : "pointer",
          transition: "border-color 0.15s, background-color 0.15s",
          padding: 0,
        }}
      >
        {item.isChecked && <Check style={{ width: "0.75rem", height: "0.75rem", color: "#fff", strokeWidth: 3 }} />}
      </button>

      <EditableText
        value={item.title}
        editable={editable}
        onChange={onRename}
        style={{
          flex: 1,
          fontSize: "0.875rem",
          color: item.isChecked ? "var(--app-text-muted)" : "var(--app-body-text)",
          textDecoration: item.isChecked ? "line-through" : "none",
          border: "1px solid transparent",
          backgroundColor: editable && hover ? "var(--app-border)" : "transparent",
        }}
        inputStyle={{ flex: 1, fontSize: "0.875rem" }}
      />

      {canManage && !readOnly && (
        <button
          type="button"
          onClick={onDelete}
          title="Eliminar ítem"
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            color: "var(--app-text-muted)",
            cursor: "pointer",
            padding: "0.125rem",
            borderRadius: "0.25rem",
            background: "none",
            border: "none",
            opacity: hover ? 1 : 0.35,
            transition: "opacity 0.15s",
          }}
        >
          <X style={{ width: "0.875rem", height: "0.875rem" }} />
        </button>
      )}
    </div>
  );
}

// ─── Un checklist ─────────────────────────────────────────────────────────────

function ChecklistSection({
  checklist,
  canManage,
  readOnly,
  onToggleItem,
  onDeleteItem,
  onRenameItem,
  onAddItems,
  onRename,
  onDelete,
}: {
  checklist: Checklist;
  canManage: boolean;
  readOnly: boolean;
  onToggleItem: (item: Item) => void;
  onDeleteItem: (id: string) => void;
  onRenameItem: (id: string, title: string) => void;
  onAddItems: (titles: string[]) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const editable = canManage && !readOnly && !isTempId(checklist.id);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: listDragId(checklist.id),
    disabled: !editable,
  });
  // Permite soltar ítems en un checklist vacío.
  const { setNodeRef: setZoneRef } = useDroppable({ id: zoneDragId(checklist.id) });

  const [newTitle, setNewTitle] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [hover, setHover] = useState(false);

  const total = checklist.items.length;
  const checked = checklist.items.filter((i) => i.isChecked).length;
  const done = total > 0 && checked === total;

  function handleAdd() {
    const t = newTitle.trim();
    if (!t) return;
    setNewTitle("");
    setAddOpen(false);
    onAddItems([t]);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const titles = parseChecklistPaste(e.clipboardData.getData("text"));
    if (titles.length > 1) {
      e.preventDefault();
      setNewTitle("");
      setAddOpen(false);
      onAddItems(titles);
    }
  }

  return (
    <div
      ref={setNodeRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        border: "1px solid var(--app-border)",
        borderRadius: "0.5rem",
        padding: "0.75rem",
        backgroundColor: isDragging ? "var(--app-card-bg)" : "transparent",
      }}
    >
      {/* Cabecera del checklist */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.5rem" }}>
        {editable ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            title="Arrastrar para reordenar el checklist"
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              background: "none",
              border: "none",
              padding: 0,
              color: "var(--app-text-muted)",
              cursor: "grab",
              touchAction: "none",
              opacity: hover || isDragging ? 0.7 : 0,
              transition: "opacity 0.15s",
            }}
          >
            <GripVertical style={{ width: "0.875rem", height: "0.875rem" }} />
          </button>
        ) : (
          <span style={{ flexShrink: 0, width: "0.875rem" }} />
        )}

        <EditableText
          value={checklist.title}
          editable={editable}
          onChange={onRename}
          title="Clic para renombrar el checklist"
          style={{
            flex: 1,
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--app-body-text)",
            backgroundColor: editable && hover ? "var(--app-border)" : "transparent",
          }}
          inputStyle={{ flex: 1, fontSize: "0.875rem", fontWeight: 600 }}
        />

        {total > 0 && (
          <span style={{ flexShrink: 0, fontSize: "0.75rem", fontWeight: 500, color: done ? "#16a34a" : "var(--app-text-muted)" }}>
            {checked}/{total}
          </span>
        )}

        {canManage && !readOnly && (
          <button
            type="button"
            onClick={onDelete}
            title="Eliminar checklist"
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--app-text-muted)",
              padding: "0.125rem",
              opacity: hover ? 1 : 0.35,
              transition: "opacity 0.15s",
            }}
          >
            <X style={{ width: "0.875rem", height: "0.875rem" }} />
          </button>
        )}
      </div>

      {/* Ítems */}
      <div ref={setZoneRef}>
        <SortableContext
          items={checklist.items.map((i) => itemDragId(i.id))}
          strategy={verticalListSortingStrategy}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minHeight: "0.5rem" }}>
            {checklist.items.map((item, index) => (
              <ChecklistRow
                key={item.id}
                item={item}
                index={index}
                canManage={canManage}
                readOnly={readOnly}
                onToggle={() => onToggleItem(item)}
                onDelete={() => onDeleteItem(item.id)}
                onRename={(title) => onRenameItem(item.id, title)}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      {/* Agregar ítem */}
      {readOnly ? null : addOpen ? (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem" }}>
          <input
            autoFocus
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") { setAddOpen(false); setNewTitle(""); }
            }}
            onPaste={handlePaste}
            placeholder="Nuevo ítem… (pega una lista para varios)"
            maxLength={200}
            style={{
              flex: 1,
              fontSize: "0.875rem",
              padding: "0.375rem 0.625rem",
              border: "1px solid var(--app-border)",
              borderRadius: "0.375rem",
              backgroundColor: "var(--app-card-bg)",
              color: "var(--app-body-text)",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newTitle.trim()}
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "#fff",
              backgroundColor: newTitle.trim() ? ACCENT : "#f9a8d4",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.375rem 0.75rem",
              cursor: newTitle.trim() ? "pointer" : "not-allowed",
              whiteSpace: "nowrap",
            }}
          >
            Agregar
          </button>
          <button
            type="button"
            onClick={() => { setAddOpen(false); setNewTitle(""); }}
            style={{ display: "flex", alignItems: "center", color: "var(--app-text-muted)", cursor: "pointer", background: "none", border: "none" }}
          >
            <X style={{ width: "1rem", height: "1rem" }} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: ACCENT,
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
            marginTop: "0.5rem",
          }}
        >
          <Plus style={{ width: "0.875rem", height: "0.875rem" }} />
          Agregar ítem
        </button>
      )}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

function ChecklistUI({
  checklists,
  canDelete,
  readOnly = false,
  onToggleItem,
  onDeleteItem,
  onRenameItem,
  onAddItems,
  onAddChecklist,
  onRenameChecklist,
  onDeleteChecklist,
  onReorder,
}: {
  checklists: Checklist[];
  canDelete: boolean;
  /** Modo consulta (clientes): muestra el avance sin permitir modificarlo. */
  readOnly?: boolean;
  onToggleItem: (item: Item) => void;
  onDeleteItem: (id: string) => void;
  onRenameItem: (id: string, title: string) => void;
  onAddItems: (checklistId: string, titles: string[]) => void;
  onAddChecklist: () => void;
  onRenameChecklist: (id: string, title: string) => void;
  onDeleteChecklist: (id: string) => void;
  onReorder: (checklists: Checklist[]) => void;
}) {
  const sensors = useSensors(
    // Un umbral corto evita que un clic para editar dispare un arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const all = checklists.flatMap((c) => c.items);
  const total = all.length;
  const checked = all.filter((i) => i.isChecked).length;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
  const done = total > 0 && checked === total;

  // En modo consulta, un checklist vacío no aporta nada: no se muestra el panel
  if (readOnly && checklists.length === 0) return null;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const next = applyChecklistDrag(checklists, active.id, over.id);
    if (next) onReorder(next);
  }

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        padding: "1.5rem",
      }}
    >
      {/* Cabecera */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: total > 0 ? "0.75rem" : "1rem" }}>
        <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)", margin: 0 }}>
          {checklists.length > 1 ? "Checklists" : "Checklist"}
        </h2>
        {total > 0 && (
          <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: done ? "#16a34a" : "var(--app-text-muted)" }}>
            {checked}/{total}
          </span>
        )}
      </div>

      {/* Avance global */}
      {total > 0 && (
        <div style={{ height: "0.375rem", backgroundColor: "var(--app-border)", borderRadius: "9999px", marginBottom: "1rem", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              backgroundColor: done ? "#22c55e" : ACCENT,
              borderRadius: "9999px",
              transition: "width 0.25s ease, background-color 0.25s ease",
            }}
          />
        </div>
      )}

      {checklists.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <SortableContext
            items={checklists.map((c) => listDragId(c.id))}
            strategy={verticalListSortingStrategy}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", marginBottom: "1rem" }}>
              {checklists.map((checklist) => (
                <ChecklistSection
                  key={checklist.id}
                  checklist={checklist}
                  canManage={canDelete}
                  readOnly={readOnly}
                  onToggleItem={onToggleItem}
                  onDeleteItem={onDeleteItem}
                  onRenameItem={onRenameItem}
                  onAddItems={(titles) => onAddItems(checklist.id, titles)}
                  onRename={(title) => onRenameChecklist(checklist.id, title)}
                  onDelete={() => onDeleteChecklist(checklist.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {!readOnly && (
        <button
          type="button"
          onClick={onAddChecklist}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: ACCENT,
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
          }}
        >
          <ListPlus style={{ width: "0.875rem", height: "0.875rem" }} />
          {checklists.length === 0 ? "Agregar checklist" : "Agregar otro checklist"}
        </button>
      )}
    </div>
  );
}

/** Estado local + sincronización con el servidor, común a tickets y tareas. */
function useChecklistState(initial: Checklist[]) {
  const [checklists, setChecklists] = useState<Checklist[]>(initial);

  // Sincroniza con el servidor sin pisar el estado optimista del arrastre:
  // solo se reemplaza cuando el servidor manda una lista nueva.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setChecklists(initial);
  }

  function updateItems(fn: (items: Item[]) => Item[]) {
    setChecklists((prev) => prev.map((c) => ({ ...c, items: fn(c.items) })));
  }

  return { checklists, setChecklists, updateItems };
}

const tempId = (suffix: string | number = "") => `temp-${Date.now()}${suffix === "" ? "" : `-${suffix}`}`;

// ─── Checklist de ticket ──────────────────────────────────────────────────────

export function TicketChecklistPanel({
  ticketId,
  initialChecklists,
  canDelete,
}: {
  ticketId: string;
  initialChecklists: Checklist[];
  canDelete: boolean;
}) {
  const { checklists, setChecklists, updateItems } = useChecklistState(initialChecklists);
  const [, startTransition] = useTransition();

  return (
    <ChecklistUI
      checklists={checklists}
      canDelete={canDelete}
      onToggleItem={(item) => {
        updateItems((items) => items.map((i) => (i.id === item.id ? { ...i, isChecked: !i.isChecked } : i)));
        startTransition(async () => { await toggleTicketChecklistItem(item.id, ticketId); });
      }}
      onDeleteItem={(id) => {
        updateItems((items) => items.filter((i) => i.id !== id));
        startTransition(async () => { await deleteTicketChecklistItem(id, ticketId); });
      }}
      onRenameItem={(id, title) => {
        updateItems((items) => items.map((i) => (i.id === id ? { ...i, title } : i)));
        startTransition(async () => { await updateTicketChecklistItem(id, ticketId, title); });
      }}
      onAddItems={(checklistId, titles) => {
        const temp = titles.map((title, i) => ({ id: tempId(i), title, isChecked: false }));
        setChecklists((prev) =>
          prev.map((c) => (c.id === checklistId ? { ...c, items: [...c.items, ...temp] } : c))
        );
        startTransition(async () => {
          if (titles.length === 1) await addTicketChecklistItem(ticketId, checklistId, titles[0]);
          else await addTicketChecklistItems(ticketId, checklistId, titles);
        });
      }}
      onAddChecklist={() => {
        setChecklists((prev) => [...prev, { id: tempId(), title: DEFAULT_CHECKLIST_TITLE, items: [] }]);
        startTransition(async () => { await addTicketChecklist(ticketId, DEFAULT_CHECKLIST_TITLE); });
      }}
      onRenameChecklist={(id, title) => {
        setChecklists((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
        startTransition(async () => { await renameTicketChecklist(id, ticketId, title); });
      }}
      onDeleteChecklist={(id) => {
        setChecklists((prev) => prev.filter((c) => c.id !== id));
        startTransition(async () => { await deleteTicketChecklist(id, ticketId); });
      }}
      onReorder={(next) => {
        setChecklists(next);
        startTransition(async () => {
          await reorderTicketChecklists(
            ticketId,
            next.map((c) => ({ checklistId: c.id, itemIds: c.items.map((i) => i.id) }))
          );
        });
      }}
    />
  );
}

// ─── Checklist de tarea ───────────────────────────────────────────────────────

export function TaskChecklistPanel({
  taskId,
  projectId,
  initialChecklists,
  canDelete,
  readOnly = false,
}: {
  taskId: string;
  projectId: string | null;
  initialChecklists: Checklist[];
  canDelete: boolean;
  /** Los clientes con acceso a la tarea ven el avance pero no lo modifican. */
  readOnly?: boolean;
}) {
  const { checklists, setChecklists, updateItems } = useChecklistState(initialChecklists);
  const [, startTransition] = useTransition();

  return (
    <ChecklistUI
      checklists={checklists}
      canDelete={canDelete}
      readOnly={readOnly}
      onToggleItem={(item) => {
        updateItems((items) => items.map((i) => (i.id === item.id ? { ...i, isChecked: !i.isChecked } : i)));
        startTransition(async () => { await toggleTaskChecklistItem(item.id, taskId, projectId); });
      }}
      onDeleteItem={(id) => {
        updateItems((items) => items.filter((i) => i.id !== id));
        startTransition(async () => { await deleteTaskChecklistItem(id, taskId, projectId); });
      }}
      onRenameItem={(id, title) => {
        updateItems((items) => items.map((i) => (i.id === id ? { ...i, title } : i)));
        startTransition(async () => { await updateTaskChecklistItem(id, taskId, projectId, title); });
      }}
      onAddItems={(checklistId, titles) => {
        const temp = titles.map((title, i) => ({ id: tempId(i), title, isChecked: false }));
        setChecklists((prev) =>
          prev.map((c) => (c.id === checklistId ? { ...c, items: [...c.items, ...temp] } : c))
        );
        startTransition(async () => {
          if (titles.length === 1) await addTaskChecklistItem(taskId, projectId, checklistId, titles[0]);
          else await addTaskChecklistItems(taskId, projectId, checklistId, titles);
        });
      }}
      onAddChecklist={() => {
        setChecklists((prev) => [...prev, { id: tempId(), title: DEFAULT_CHECKLIST_TITLE, items: [] }]);
        startTransition(async () => { await addTaskChecklist(taskId, projectId, DEFAULT_CHECKLIST_TITLE); });
      }}
      onRenameChecklist={(id, title) => {
        setChecklists((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
        startTransition(async () => { await renameTaskChecklist(id, taskId, projectId, title); });
      }}
      onDeleteChecklist={(id) => {
        setChecklists((prev) => prev.filter((c) => c.id !== id));
        startTransition(async () => { await deleteTaskChecklist(id, taskId, projectId); });
      }}
      onReorder={(next) => {
        setChecklists(next);
        startTransition(async () => {
          await reorderTaskChecklists(
            taskId,
            projectId,
            next.map((c) => ({ checklistId: c.id, itemIds: c.items.map((i) => i.id) }))
          );
        });
      }}
    />
  );
}
