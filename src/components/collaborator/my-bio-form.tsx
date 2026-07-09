"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateMyBio } from "@/actions/collaborator.actions";

export function MyBioForm({ initialBio }: { initialBio: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateMyBio(fd);
      if (res?.error) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        name="bio"
        defaultValue={initialBio}
        rows={4}
        onChange={() => setSaved(false)}
        placeholder="Breve presentación tuya, visible para los clientes en la página «Agendar»."
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {isPending ? "Guardando..." : "Guardar biografía"}
        </button>
        {saved && <span className="text-sm text-green-600">Guardada ✓</span>}
      </div>
    </form>
  );
}
