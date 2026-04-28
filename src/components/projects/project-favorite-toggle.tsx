"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleProjectFavorite } from "@/actions/project.actions";

export function ProjectFavoriteToggle({
  projectId,
  initial,
  size = "md",
}: {
  projectId: string;
  initial: boolean;
  size?: "sm" | "md";
}) {
  const [favorited, setFavorited] = useState(initial);
  const [isPending, startTransition] = useTransition();

  const dim = size === "sm" ? "0.875rem" : "1rem";

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !favorited;
    setFavorited(next);
    startTransition(async () => {
      const result = await toggleProjectFavorite(projectId);
      if (result?.favorited !== next) setFavorited(result.favorited);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={favorited ? "Quitar de favoritos" : "Marcar como favorito"}
      title={favorited ? "Quitar de favoritos" : "Marcar como favorito"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "none",
        border: "none",
        padding: "0.25rem",
        borderRadius: "0.25rem",
        cursor: isPending ? "wait" : "pointer",
        color: favorited ? "#f59e0b" : "var(--app-text-muted)",
        opacity: isPending ? 0.6 : 1,
        transition: "color 0.15s",
      }}
    >
      <Star
        style={{
          width: dim,
          height: dim,
          fill: favorited ? "#f59e0b" : "transparent",
        }}
      />
    </button>
  );
}
