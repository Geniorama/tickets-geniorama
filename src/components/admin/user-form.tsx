"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser } from "@/actions/user.actions";

interface Company { id: string; name: string; }

export function UserForm({ companies }: { companies: Company[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState("CLIENTE");

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createUser(formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.emailError) {
        alert(result.emailError);
        router.push("/admin/users");
      } else {
        router.push("/admin/users");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
        <input name="name" required className={inputClass} placeholder="Nombre completo" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input name="email" type="email" required className={inputClass} placeholder="correo@ejemplo.com" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña temporal</label>
        <input name="password" type="password" required minLength={8} className={inputClass} placeholder="Mínimo 8 caracteres" />
        <p className="text-xs text-gray-400 mt-1">El usuario recibirá un email para establecer su propia contraseña.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={inputClass}
        >
          <option value="CLIENTE">Cliente</option>
          <option value="COLABORADOR">Colaborador</option>
          <option value="ADMINISTRADOR">Administrador</option>
        </select>
      </div>

      {role === "CLIENTE" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Empresas <span className="text-gray-400 font-normal">(selecciona una o más)</span>
          </label>
          {companies.length === 0 ? (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No hay empresas registradas.{" "}
              <a href="/admin/companies/new" className="underline font-medium">Crear empresa primero</a>.
            </p>
          ) : (
            <div className="border border-gray-300 rounded-lg px-3 py-2 space-y-2 max-h-48 overflow-y-auto">
              {companies.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    name="companyIds"
                    value={c.id}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending || (role === "CLIENTE" && companies.length === 0)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {isPending ? "Creando..." : "Crear usuario"}
        </button>
      </div>
    </form>
  );
}
