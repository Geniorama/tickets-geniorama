"use client";

import { useRef, useState, useTransition } from "react";
import { addAttachment } from "@/actions/attachment.actions";

export function AttachmentUploader({ ticketId }: { ticketId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const file = inputRef.current?.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await addAttachment(ticketId, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
        className="flex-1 text-sm text-gray-600 bg-white file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:text-gray-700 file:bg-gray-50 hover:file:bg-gray-100 cursor-pointer"
      />
      <button
        type="submit"
        disabled={isPending}
        className="shrink-0 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        {isPending ? "Subiendo..." : "Subir"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
