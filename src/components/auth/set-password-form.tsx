"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPassword } from "@/actions/set-password.actions";

export function SetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("token", token);

    startTransition(async () => {
      const result = await setPassword(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        router.push("/login?activated=1");
      }
    });
  }

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className={inputClass}
          placeholder="Mínimo 8 caracteres"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
        <input
          name="confirm"
          type="password"
          required
          minLength={8}
          className={inputClass}
          placeholder="Repite la contraseña"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        {isPending ? "Guardando..." : "Activar cuenta"}
      </button>
    </form>
  );
}
