"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, Heading2, Code } from "lucide-react";

interface MarkdownEditorProps {
  name: string;
  defaultValue?: string;
  placeholder?: string;
}

export function MarkdownEditor({ name, defaultValue = "", placeholder }: MarkdownEditorProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [isEmpty, setIsEmpty] = useState(!defaultValue?.trim());

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    content: defaultValue,
    immediatelyRender: false,
    onUpdate({ editor }) {
      setIsEmpty(editor.isEmpty);
      if (hiddenRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hiddenRef.current.value = (editor.storage as any).markdown.getMarkdown();
      }
    },
  });

  const isActive = (type: string, attrs?: Record<string, unknown>) =>
    editor?.isActive(type, attrs) ?? false;

  const toolbarBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "0.25rem 0.4rem",
    borderRadius: "0.25rem",
    border: "none",
    cursor: "pointer",
    background: active ? "rgba(253,19,132,0.15)" : "transparent",
    color: active ? "#fd1384" : "var(--app-body-text)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  });

  const sep: React.CSSProperties = {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "var(--app-border)",
    margin: "0 0.25rem",
  };

  return (
    <div style={{
      border: "1px solid var(--app-border)",
      borderRadius: "0.5rem",
      overflow: "hidden",
    }}>
      {/* Toolbar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.125rem",
        padding: "0.375rem 0.5rem",
        borderBottom: "1px solid var(--app-border)",
        backgroundColor: "var(--app-input-bg)",
      }}>
        <button
          type="button"
          title="Negrita"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          style={toolbarBtnStyle(isActive("bold"))}
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          title="Cursiva"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          style={toolbarBtnStyle(isActive("italic"))}
        >
          <Italic size={14} />
        </button>
        <span style={sep} />
        <button
          type="button"
          title="Encabezado"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          style={toolbarBtnStyle(isActive("heading", { level: 2 }))}
        >
          <Heading2 size={14} />
        </button>
        <span style={sep} />
        <button
          type="button"
          title="Lista con viñetas"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          style={toolbarBtnStyle(isActive("bulletList"))}
        >
          <List size={14} />
        </button>
        <button
          type="button"
          title="Lista numerada"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          style={toolbarBtnStyle(isActive("orderedList"))}
        >
          <ListOrdered size={14} />
        </button>
        <span style={sep} />
        <button
          type="button"
          title="Código"
          onClick={() => editor?.chain().focus().toggleCode().run()}
          style={toolbarBtnStyle(isActive("code"))}
        >
          <Code size={14} />
        </button>
      </div>

      {/* Editor area */}
      <div style={{ position: "relative", backgroundColor: "var(--app-input-bg)" }}>
        {isEmpty && placeholder && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "0.5rem",
              left: "0.75rem",
              color: "var(--app-placeholder)",
              fontSize: "0.875rem",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            {placeholder}
          </div>
        )}
        <EditorContent editor={editor} className="markdown-editor-content" />
      </div>

      {/* Hidden input carries the markdown value for FormData */}
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={defaultValue} />
    </div>
  );
}
