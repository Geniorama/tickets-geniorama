"use client";

import { useState, useRef, useEffect } from "react";
import { AtSign } from "lucide-react";
import { getMentionableUsers } from "@/actions/user.actions";

type User = { id: string; name: string };

interface Props {
  placeholder?: string;
  rows?: number;
  required?: boolean;
  style?: React.CSSProperties;
  className?: string;
  /** Nombre del campo en el FormData (default: "body") */
  name?: string;
}

/**
 * Textarea con soporte de menciones @[Name](id).
 * Es un input no controlado — form.reset() funciona normalmente.
 * El dropdown aparece al escribir @ y filtra usuarios por nombre.
 */
export function MentionTextarea({
  placeholder,
  rows = 3,
  required,
  style,
  className,
  name = "body",
}: Props) {
  // Solo para lógica del dropdown; el DOM del textarea es fuente de verdad
  const [internalValue, setInternalValue] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState<User[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  async function loadUsers(): Promise<User[]> {
    if (usersLoaded) return users;
    const result = await getMentionableUsers();
    setUsers(result);
    setUsersLoaded(true);
    return result;
  }

  async function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInternalValue(val);

    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);

    // Buscar el último @ antes del cursor que no sea parte de un @[...](...)
    const atIdx = before.lastIndexOf("@");
    if (atIdx !== -1) {
      const afterAt = before.slice(atIdx + 1);
      // Si ya tiene corchete es un mention ya insertado
      if (!afterAt.startsWith("[") && !afterAt.includes("[")) {
        const q = afterAt;
        const allUsers = await loadUsers();
        const matches =
          q.length === 0
            ? allUsers.slice(0, 8)
            : allUsers
                .filter((u) => u.name.toLowerCase().includes(q.toLowerCase()))
                .slice(0, 8);

        if (matches.length > 0) {
          setMentionStart(atIdx);
          setQuery(q);
          setFiltered(matches);
          setShowDropdown(true);
          setActiveIdx(0);
          return;
        }
      }
    }

    setShowDropdown(false);
  }

  function insertMention(user: User) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const before = internalValue.slice(0, mentionStart);
    const after = internalValue.slice(mentionStart + 1 + query.length);
    const mention = `@[${user.name}](${user.id})`;
    const newValue = `${before}${mention} ${after}`;

    // Actualizar DOM (uncontrolled) y estado
    textarea.value = newValue;
    setInternalValue(newValue);
    setShowDropdown(false);

    // Mover cursor al final del mention
    textarea.focus();
    const newPos = before.length + mention.length + 1;
    setTimeout(() => textarea.setSelectionRange(newPos, newPos), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!showDropdown || filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(filtered[activeIdx]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <textarea
        ref={textareaRef}
        name={name}
        defaultValue=""
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        required={required}
        style={style}
        className={className}
      />

      {/* Dropdown de menciones */}
      {showDropdown && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 0.25rem)",
            left: 0,
            zIndex: 50,
            backgroundColor: "#1a0a10",
            border: "1px solid #fd1384",
            borderRadius: "0.5rem",
            boxShadow: "0 4px 20px rgba(253,19,132,0.25)",
            minWidth: "14rem",
            maxHeight: "13rem",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              padding: "0.375rem 0.75rem 0.25rem",
              borderBottom: "1px solid rgba(253,19,132,0.3)",
            }}
          >
            <span
              style={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
                color: "rgba(253,19,132,0.7)",
              }}
            >
              MENCIONAR
            </span>
          </div>
          {filtered.map((user, idx) => (
            <button
              key={user.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(user);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.5rem 0.75rem",
                fontSize: "0.875rem",
                color: idx === activeIdx ? "#fd1384" : "#f0d0e0",
                backgroundColor:
                  idx === activeIdx ? "rgba(253,19,132,0.2)" : "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <AtSign
                style={{
                  width: "0.75rem",
                  height: "0.75rem",
                  flexShrink: 0,
                  color: "#fd1384",
                }}
              />
              {user.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
