"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateCompany } from "@/actions/company.actions";
import type { Company } from "@/generated/prisma";
import { Building2, Upload, X } from "lucide-react";
import Image from "next/image";

interface Agency { id: string; name: string; }

export function CompanyEditForm({
  company,
  agencies,
}: {
  company: Company;
  agencies: Agency[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [type, setType] = useState<"AGENCIA" | "EMPRESA">(company.type as "AGENCIA" | "EMPRESA");
  const fileRef = useRef<HTMLInputElement>(null);

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  const visibleLogo = !removeLogo ? (preview ?? company.logoUrl) : null;

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  }

  function clearLogo() {
    setPreview(null);
    setRemoveLogo(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    if (removeLogo) formData.set("removeLogo", "1");
    startTransition(async () => {
      const result = await updateCompany(company.id, formData);
      if (result?.error) setError(result.error);
      else router.push("/admin/companies");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as "AGENCIA" | "EMPRESA")}
          className={inputClass}
        >
          <option value="EMPRESA">Empresa</option>
          <option value="AGENCIA">Agencia</option>
        </select>
      </div>

      {type === "EMPRESA" && agencies.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Agencia <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <select
            name="parentId"
            defaultValue={company.parentId ?? ""}
            className={inputClass}
          >
            <option value="">Sin agencia</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la empresa</label>
        <input name="name" required defaultValue={company.name} className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          NIT / RUC <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input name="taxId" defaultValue={company.taxId ?? ""} className={inputClass} placeholder="Ej: 900123456-7" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Logo <span className="text-gray-400 font-normal">(JPG, PNG, WebP, SVG · máx. 2 MB)</span>
        </label>

        <input
          ref={fileRef}
          type="file"
          name="logo"
          accept="image/*"
          className="hidden"
          onChange={handleLogoChange}
        />

        {visibleLogo ? (
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
              <Image src={visibleLogo} alt={company.name} fill className="object-contain p-2" />
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <Upload className="w-3.5 h-3.5" /> Cambiar logo
              </button>
              <button type="button" onClick={clearLogo}
                className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700">
                <X className="w-3.5 h-3.5" /> Eliminar logo
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
          >
            <Building2 className="w-7 h-7 text-gray-300 mb-1" />
            <span className="text-sm text-gray-400 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Seleccionar imagen
            </span>
          </button>
        )}
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
