"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton({ fallback = "/tickets" }: { fallback?: string }) {
  const router = useRouter();

  function handleClick() {
    // If there's history to go back to, use it; otherwise fall back
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Volver
    </button>
  );
}
