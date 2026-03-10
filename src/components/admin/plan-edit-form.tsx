"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlan } from "@/actions/plan.actions";
import type { Plan } from "@/generated/prisma";

interface Company {
  id: string;
  name: string;
}

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500";

function detectExpiresType(plan: Plan): "none" | "duration" | "date" {
  if (plan.durationDays) return "duration";
  if (plan.expiresAt) return "date";
  return "none";
}

export function PlanEditForm({
  plan,
  companies,
}: {
  plan: Plan;
  companies: Company[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<"BOLSA_HORAS" | "SOPORTE_MENSUAL">(
    plan.type as "BOLSA_HORAS" | "SOPORTE_MENSUAL"
  );
  const [expiresType, setExpiresType] = useState<"none" | "duration" | "date">(
    detectExpiresType(plan)
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updatePlan(plan.id, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        router.push("/admin/plans");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
        <input
          name="name"
          required
          defaultValue={plan.name}
          className={inputClass}
          placeholder="Ej: Bolsa 40 horas Q1 2026"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
        <select name="companyId" required defaultValue={plan.companyId} className={inputClass}>
          <option value="">Seleccionar empresa...</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as "BOLSA_HORAS" | "SOPORTE_MENSUAL")}
          className={inputClass}
        >
          <option value="BOLSA_HORAS">Bolsa de horas</option>
          <option value="SOPORTE_MENSUAL">Soporte mensual</option>
        </select>
      </div>

      {type === "BOLSA_HORAS" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total de horas</label>
          <input
            name="totalHours"
            type="number"
            min="0.5"
            step="0.5"
            required
            defaultValue={plan.totalHours ?? undefined}
            className={inputClass}
            placeholder="Ej: 40"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de inicio</label>
        <input
          name="startedAt"
          type="date"
          defaultValue={new Date(plan.startedAt).toISOString().split("T")[0]}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Caducidad</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="expiresType"
              value="none"
              checked={expiresType === "none"}
              onChange={() => setExpiresType("none")}
              className="text-indigo-600"
            />
            Sin caducidad
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="expiresType"
              value="duration"
              checked={expiresType === "duration"}
              onChange={() => setExpiresType("duration")}
              className="text-indigo-600"
            />
            Por duración
          </label>
          {expiresType === "duration" && (
            <div className="ml-6">
              <input
                name="durationDays"
                type="number"
                min="1"
                step="1"
                required
                defaultValue={plan.durationDays ?? undefined}
                className={inputClass}
                placeholder="Número de días (ej: 30)"
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="radio"
              name="expiresType"
              value="date"
              checked={expiresType === "date"}
              onChange={() => setExpiresType("date")}
              className="text-indigo-600"
            />
            Por fecha fija
          </label>
          {expiresType === "date" && (
            <div className="ml-6">
              <input
                name="expiresAt"
                type="date"
                required
                defaultValue={
                  plan.expiresAt
                    ? new Date(plan.expiresAt).toISOString().split("T")[0]
                    : undefined
                }
                className={inputClass}
              />
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {isPending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
