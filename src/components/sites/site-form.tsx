"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { createSite, updateSite } from "@/actions/site.actions";

interface Company { id: string; name: string; }
interface SiteData {
  id: string;
  name: string;
  domain: string;
  companyId: string;
  documentation: string | null;
  architecture: string | null;
  isActive: boolean;
}

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500";
const textareaClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono resize-y";

export function SiteForm({
  companies,
  site,
  defaultCompanyId,
}: {
  companies: Company[];
  site?: SiteData;
  defaultCompanyId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!site;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = isEdit
        ? await updateSite(site.id, formData)
        : await createSite(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre del sitio / app <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            required
            defaultValue={site?.name}
            placeholder="Ej: Portal de clientes"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dominio <span className="text-red-500">*</span>
          </label>
          <input
            name="domain"
            required
            defaultValue={site?.domain}
            placeholder="Ej: clientes.miempresa.com"
            className={inputClass}
          />
          <p className="text-xs text-gray-400 mt-1">Sin https://. Puede incluir subdominio.</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Empresa <span className="text-red-500">*</span>
        </label>
        <select
          name="companyId"
          required
          defaultValue={site?.companyId ?? defaultCompanyId ?? ""}
          className={inputClass}
        >
          <option value="">Seleccionar empresa...</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Documentación
        </label>
        <textarea
          name="documentation"
          rows={8}
          defaultValue={site?.documentation ?? ""}
          placeholder={`## Stack tecnológico\n- Frontend: React + Next.js\n- Backend: Node.js + Express\n- DB: PostgreSQL\n\n## Accesos relevantes\n- Panel de administración: /admin\n- API base URL: /api/v1\n\n## Notas de soporte\n...`}
          className={textareaClass}
        />
        <p className="text-xs text-gray-400 mt-1">
          Soporta Markdown. Incluye stack, accesos, credenciales de prueba, variables de entorno relevantes, etc.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Arquitectura <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          name="architecture"
          rows={6}
          defaultValue={site?.architecture ?? ""}
          placeholder={`## Infraestructura\n- Hosting: Netlify (frontend) + Railway (API)\n- CDN: Cloudflare\n- Storage: AWS S3\n\n## Diagrama de componentes\n[Descripción o enlace al diagrama]\n\n## Flujo de despliegue\n...`}
          className={textareaClass}
        />
        <p className="text-xs text-gray-400 mt-1">
          Infraestructura, servicios externos, diagrama de componentes, flujo de CI/CD.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isActive"
          name="isActive"
          value="true"
          defaultChecked={site?.isActive ?? true}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          onChange={(e) => {
            const hidden = e.currentTarget.form?.querySelector('input[name="isActive"][type="hidden"]') as HTMLInputElement | null;
            if (hidden) hidden.value = e.currentTarget.checked ? "true" : "false";
          }}
        />
        <input type="hidden" name="isActive" defaultValue={site?.isActive !== false ? "true" : "false"} />
        <label htmlFor="isActive" className="text-sm text-gray-700">Sitio activo</label>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
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
          {isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear sitio"}
        </button>
      </div>
    </form>
  );
}
