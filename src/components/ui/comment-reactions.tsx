"use client";

import { useTransition } from "react";
import type { ReactionType } from "@/generated/prisma";

export type ReactionEntry = { type: ReactionType; userId: string };

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "LIKE",      emoji: "👍", label: "Like" },
  { type: "GENIO",     emoji: "🧞", label: "Genio" },
  { type: "DISLIKE",   emoji: "👎", label: "Dislike" },
  { type: "REVISANDO", emoji: "👀", label: "Revisando" },
];

export function CommentReactions({
  reactions,
  currentUserId,
  onToggle,
}: {
  reactions: ReactionEntry[];
  currentUserId: string;
  onToggle: (type: ReactionType) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  // Count per type
  const counts = REACTIONS.map(({ type, emoji, label }) => {
    const list = reactions.filter((r) => r.type === type);
    const mine = list.some((r) => r.userId === currentUserId);
    return { type, emoji, label, count: list.length, mine };
  });

  // Only show reaction types that have > 0 votes + the full set on hover handled via CSS
  // Always show the row; hide zero-count ones that aren't hovered (we show all always for simplicity)

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.25rem",
        flexWrap: "wrap",
        marginTop: "0.5rem",
      }}
    >
      {counts.map(({ type, emoji, label, count, mine }) => (
        <button
          key={type}
          type="button"
          disabled={isPending}
          title={label}
          onClick={() => startTransition(() => onToggle(type))}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            padding: "0.2rem 0.5rem",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: mine ? 600 : 400,
            border: mine ? "1.5px solid #6366f1" : "1px solid var(--app-border)",
            backgroundColor: mine ? "#eef2ff" : "var(--app-card-bg)",
            color: mine ? "#4338ca" : "var(--app-text-muted)",
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.6 : 1,
            transition: "all 0.1s",
          }}
        >
          <span style={{ fontSize: "0.875rem" }}>{emoji}</span>
          {count > 0 && <span>{count}</span>}
        </button>
      ))}
    </div>
  );
}
