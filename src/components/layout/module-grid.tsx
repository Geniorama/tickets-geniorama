import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AppKey } from "@/generated/prisma";
import { APP_BY_KEY } from "@/lib/access/apps";
import { APP_ICONS, APP_SECTIONS } from "./nav-config";

/**
 * Accesos a los módulos en el inicio.
 *
 * El inicio es el punto neutro desde el que se elige dónde trabajar, pero sin
 * esto la única forma de cambiar de módulo era abrir el selector del menú.
 * Aquí están a la vista, cada uno con una cifra que responde «¿qué me espera
 * ahí?» antes de entrar.
 */

export type ModuleSummary = {
  /** Cifra destacada del módulo, ya calculada por la página. */
  value: number | string;
  /** Qué significa esa cifra: «abiertos», «activos»… */
  label: string;
  /** true cuando la cifra pide atención (vencidos, agotados). */
  alert?: boolean;
};

export function ModuleGrid({
  apps,
  summaries,
}: {
  apps: AppKey[];
  summaries: Partial<Record<AppKey, ModuleSummary>>;
}) {
  // Un módulo sin secciones está declarado pero no construido: no lleva a
  // ninguna parte, así que no se ofrece aquí.
  const visibles = apps.filter((k) => {
    const def = APP_BY_KEY.get(k);
    return def?.built && (APP_SECTIONS[k]?.length ?? 0) > 0;
  });

  if (visibles.length === 0) return null;

  return (
    <div className="mb-6">
      <h2
        style={{
          fontSize: "0.8125rem", fontWeight: 700, letterSpacing: "0.05em",
          textTransform: "uppercase", color: "var(--app-text-muted)", marginBottom: "0.75rem",
        }}
      >
        Tus módulos
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))",
          gap: "0.75rem",
        }}
      >
        {visibles.map((key) => {
          const def = APP_BY_KEY.get(key)!;
          const Icon = APP_ICONS[key];
          const destino = APP_SECTIONS[key][0].href;
          const resumen = summaries[key];

          return (
            <Link
              key={key}
              href={destino}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.875rem",
                padding: "1rem",
                borderRadius: "0.75rem",
                border: "1px solid var(--app-border)",
                backgroundColor: "var(--app-card-bg)",
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "2.5rem", height: "2.5rem", flexShrink: 0,
                  borderRadius: "0.6rem", backgroundColor: "var(--app-nav-hover-bg)",
                }}
              >
                <Icon className="w-[1.15rem] h-[1.15rem]" style={{ color: "#fd1384" }} />
              </span>

              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "0.9375rem", fontWeight: 650, color: "var(--app-body-text)" }}>
                  {def.name}
                </span>
                <span
                  style={{
                    display: "block", fontSize: "0.8125rem", marginTop: "0.1rem",
                    color: resumen?.alert ? "#dc2626" : "var(--app-text-muted)",
                    fontWeight: resumen?.alert ? 600 : 400,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {resumen ? `${resumen.value} ${resumen.label}` : def.description}
                </span>
              </span>

              <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "var(--app-text-muted)", opacity: 0.6 }} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
