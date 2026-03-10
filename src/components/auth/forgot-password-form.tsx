"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/actions/password.actions";

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSent(true);
      }
    });
  }

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm text-gray-700">
          Si el email está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
        </p>
        <p className="text-xs text-gray-400">Revisa también tu carpeta de spam.</p>
        <Link href="/login" className="block mt-4 text-sm text-indigo-600 hover:underline">
          Volver al login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputClass}
          placeholder="tu@email.com"
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
        {isPending ? "Enviando..." : "Enviar enlace de recuperación"}
      </button>

      <div className="text-center">
        <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600">
          Volver al login
        </Link>
      </div>
    </form>
  );
}
