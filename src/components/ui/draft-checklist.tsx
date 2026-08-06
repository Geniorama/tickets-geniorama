"use client";

import { useState, useRef } from "react";
import { GripVertical, ListPlus, Plus, X } from "lucide-react";
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
import { parseChecklistPaste } from "@/lib/checklist-paste";
import { DEFAULT_CHECKLIST_TITLE, type ChecklistGroup } from "@/lib/checklist";
import { applyChecklistDrag, itemDragId, listDragId, zoneDragId } from "@/lib/checklist-dnd";

/**
 * Checklists en borrador: operan sobre `ChecklistGroup[]` (formularios de
 * creación y plantillas, donde nada existe todavía en base de datos).
 * Se pueden crear varios, cada uno con su título; los ítems se editan en línea,
 * se reordenan arrastrando —incluso entre checklists— y van numerados.
 */

type Row = { id: string; text: string };
type Group = { id: string; title: string; items: Row[] };

// Contadores de módulo: dnd-kit necesita ids estables y el `ChecklistGroup[]`
// del formulario no los trae.
let seq = 0;
const nextId = (prefix: string) => `${prefix}-${seq++}`;
const toRows = (texts: string[]): Row[] => texts.map((text) => ({ id: nextId("i"), text }));
const toGroups = (groups: ChecklistGroup[]): Group[] =>
  groups.map((g) => ({ id: nextId("g"), title: g.title, items: toRows(g.items) }));

// ─── Texto editable en línea ──────────────────────────────────────────────────

function EditableText({
  value,
  onChange,
  style,
  inputStyle,
  title,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  title?: string;
  placeholder?: string;
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
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); cancelled.current = true; setEditing(false); }
        }}
        onFocus={(e) => e.currentTarget.select()}
        style={{
          minWidth: 0,
          border: "1px solid #fd1384",
          borderRadius: "0.25rem",
          backgroundColor: "var(--app-card-bg)",
          color: "var(--app-body-text)",
          outline: "none",
          padding: "0.125rem 0.375rem",
          ...inputStyle,
        }}
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value); cancelled.current = false; setEditing(true); }}
      title={title ?? "Clic para editar"}
      style={{ cursor: "text", wordBreak: "break-word", minWidth: 0, ...style }}
    >
      {value}
    </span>
  );
}

// ─── Ítem ─────────────────────────────────────────────────────────────────────

function DraftRow({
  row,
  index,
  onRename,
  onDelete,
}: {
  row: Row;
  index: number;
  onRename: (text: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: itemDragId(row.id),
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        fontSize: "0.8125rem",
        backgroundColor: "var(--app-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.375rem",
        padding: "0.375rem 0.625rem",
        listStyle: "none",
      }}
    >
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
        }}
      >
        <GripVertical style={{ width: "0.875rem", height: "0.875rem" }} />
      </button>

      <span
        style={{
          flexShrink: 0,
          minWidth: "1.125rem",
          textAlign: "right",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: "var(--app-text-muted)",
        }}
      >
        {index + 1}.
      </span>

      <EditableText
        value={row.text}
        onChange={onRename}
        style={{ flex: 1, color: "var(--app-body-text)", padding: "0.125rem 0" }}
        inputStyle={{ flex: 1, fontSize: "0.8125rem" }}
      />

      <button
        type="button"
        onClick={onDelete}
        title="Quitar ítem"
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--app-text-muted)",
        }}
      >
        <X style={{ width: "0.875rem", height: "0.875rem" }} />
      </button>
    </li>
  );
}

// ─── Checklist ────────────────────────────────────────────────────────────────

function DraftGroup({
  group,
  showDelete,
  placeholder,
  onRenameGroup,
  onDeleteGroup,
  onRenameItem,
  onDeleteItem,
  onAddItems,
}: {
  group: Group;
  showDelete: boolean;
  placeholder: string;
  onRenameGroup: (title: string) => void;
  onDeleteGroup: () => void;
  onRenameItem: (itemId: string, text: string) => void;
  onDeleteItem: (itemId: string) => void;
  onAddItems: (texts: string[]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: listDragId(group.id),
  });
  // Permite soltar ítems en un checklist vacío.
  const { setNodeRef: setZoneRef } = useDroppable({ id: zoneDragId(group.id) });

  const [input, setInput] = useState("");

  function addItem() {
    const t = input.trim();
    if (!t) return;
    onAddItems([t]);
    setInput("");
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = parseChecklistPaste(e.clipboardData.getData("text"));
    if (pasted.length > 1) {
      e.preventDefault();
      onAddItems(pasted);
      setInput("");
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        border: "1px solid var(--app-border)",
        borderRadius: "0.5rem",
        padding: "0.625rem 0.75rem",
        backgroundColor: "var(--app-card-bg)",
      }}
    >
      {/* Cabecera */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
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
          }}
        >
          <GripVertical style={{ width: "0.875rem", height: "0.875rem" }} />
        </button>

        <EditableText
          value={group.title}
          onChange={onRenameGroup}
          title="Clic para renombrar el checklist"
          style={{
            flex: 1,
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--app-body-text)",
            padding: "0.125rem 0.25rem",
          }}
          inputStyle={{ flex: 1, fontSize: "0.8125rem", fontWeight: 600 }}
        />

        <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", flexShrink: 0 }}>
          {group.items.length}
        </span>

        {showDelete && (
          <button
            type="button"
            onClick={onDeleteGroup}
            title="Quitar checklist"
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--app-text-muted)",
            }}
          >
            <X style={{ width: "0.875rem", height: "0.875rem" }} />
          </button>
        )}
      </div>

      {/* Ítems */}
      <div ref={setZoneRef}>
        <SortableContext items={group.items.map((i) => itemDragId(i.id))} strategy={verticalListSortingStrategy}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem", minHeight: "0.5rem" }}>
            {group.items.map((row, index) => (
              <DraftRow
                key={row.id}
                row={row}
                index={index}
                onRename={(text) => onRenameItem(row.id, text)}
                onDelete={() => onDeleteItem(row.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </div>

      {/* Agregar ítem */}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
          onPaste={handlePaste}
          placeholder={placeholder}
          style={{ flex: 1, border: "1px solid var(--app-border)", borderRadius: "0.5rem", padding: "0.4375rem 0.75rem", fontSize: "0.8125rem", color: "var(--app-body-text)", backgroundColor: "var(--app-bg)", outline: "none", boxSizing: "border-box" }}
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!input.trim()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "#fd1384",
            backgroundColor: "transparent",
            border: "1px solid rgba(253,19,132,0.35)",
            borderRadius: "0.5rem",
            padding: "0.4375rem 0.75rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
            opacity: input.trim() ? 1 : 0.4,
          }}
        >
          <Plus style={{ width: "0.875rem", height: "0.875rem" }} />
          Agregar
        </button>
      </div>
    </div>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

export function DraftChecklist({
  groups: value,
  onChange,
  placeholder = "Agregar ítem al checklist…",
}: {
  groups: ChecklistGroup[];
  onChange: (groups: ChecklistGroup[]) => void;
  placeholder?: string;
}) {
  const [groups, setGroups] = useState<Group[]>(() => toGroups(value));

  const sensors = useSensors(
    // Un umbral corto evita que un clic para editar dispare un arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  // Si el padre reemplaza el valor por fuera (p. ej. al aplicar una plantilla),
  // se reconstruye. Los cambios propios ya vienen reflejados en `groups`, así
  // que la comparación por contenido los deja pasar sin rehacer ids.
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    const inSync =
      groups.length === value.length &&
      groups.every(
        (g, i) =>
          g.title === value[i].title &&
          g.items.length === value[i].items.length &&
          g.items.every((it, x) => it.text === value[i].items[x])
      );
    if (!inSync) setGroups(toGroups(value));
  }

  function commit(next: Group[]) {
    setGroups(next);
    onChange(next.map((g) => ({ title: g.title, items: g.items.map((i) => i.text) })));
  }

  function updateGroup(groupId: string, fn: (g: Group) => Group) {
    commit(groups.map((g) => (g.id === groupId ? fn(g) : g)));
  }

  function addGroup() {
    commit([...groups, { id: nextId("g"), title: DEFAULT_CHECKLIST_TITLE, items: [] }]);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const next = applyChecklistDrag(groups, active.id, over.id);
    if (next) commit(next);
  }

  return (
    <>
      {groups.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <SortableContext items={groups.map((g) => listDragId(g.id))} strategy={verticalListSortingStrategy}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.5rem" }}>
              {groups.map((group) => (
                <DraftGroup
                  key={group.id}
                  group={group}
                  showDelete={groups.length > 1 || group.items.length > 0}
                  placeholder={placeholder}
                  onRenameGroup={(title) => updateGroup(group.id, (g) => ({ ...g, title }))}
                  onDeleteGroup={() => commit(groups.filter((g) => g.id !== group.id))}
                  onRenameItem={(itemId, text) =>
                    updateGroup(group.id, (g) => ({
                      ...g,
                      items: g.items.map((i) => (i.id === itemId ? { ...i, text } : i)),
                    }))
                  }
                  onDeleteItem={(itemId) =>
                    updateGroup(group.id, (g) => ({ ...g, items: g.items.filter((i) => i.id !== itemId) }))
                  }
                  onAddItems={(texts) =>
                    updateGroup(group.id, (g) => ({ ...g, items: [...g.items, ...toRows(texts)] }))
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        type="button"
        onClick={addGroup}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          fontSize: "0.8125rem",
          fontWeight: 500,
          color: "#fd1384",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
        }}
      >
        <ListPlus style={{ width: "0.875rem", height: "0.875rem" }} />
        {groups.length === 0 ? "Agregar checklist" : "Agregar otro checklist"}
      </button>
    </>
  );
}
