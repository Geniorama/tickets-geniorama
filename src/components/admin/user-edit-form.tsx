"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUser } from "@/actions/user.actions";

interface Company { id: string; name: string; }
interface User {
  id: string; name: string; email: string;
  role: string; isActive: boolean; companyIds: string[];
}

export function UserEditForm({ user, companies }: { user: User; companies: Company[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState(user.role);

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateUser(user.id, formData);
      if (result?.error) setError(result.error);
      else router.push("/admin/users");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
        <input name="name" required defaultValue={user.name} className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input name="email" type="email" required defaultValue={user.email} className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
        <select name="role" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
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
          <div className="border border-gray-300 rounded-lg px-3 py-2 space-y-2 max-h-48 overflow-y-auto">
            {companies.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  name="companyIds"
                  value={c.id}
                  defaultChecked={user.companyIds.includes(c.id)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
        <select name="isActive" defaultValue={user.isActive ? "true" : "false"} className={inputClass}>
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nueva contraseña <span className="text-gray-400 font-normal">(dejar vacío para no cambiar)</span>
        </label>
        <input name="password" type="password" minLength={8} className={inputClass} placeholder="Mínimo 8 caracteres" />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
          Cancelar
        </button>
        <button type="submit" disabled={isPending}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors">
          {isPending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
