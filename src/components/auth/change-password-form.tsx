"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/actions/password.actions";

export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await changePassword(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        (e.target as HTMLFormElement).reset();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Contraseña actual
        </label>
        <input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
          placeholder="••••••••"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nueva contraseña
        </label>
        <input
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
          placeholder="Mínimo 8 caracteres"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Confirmar nueva contraseña
        </label>
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
          placeholder="Repite la nueva contraseña"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          Contraseña actualizada correctamente.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        {isPending ? "Guardando..." : "Cambiar contraseña"}
      </button>
    </form>
  );
}
