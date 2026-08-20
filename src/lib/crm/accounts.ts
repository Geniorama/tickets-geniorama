import type { AccountStage, Prisma } from "@/generated/prisma";

/**
 * Cuentas: las organizaciones del CRM, que son las mismas `Company` de siempre
 * con una etapa comercial encima.
 *
 * La etapa importa fuera del CRM: un lead todavía no es cliente, así que no
 * debe aparecer donde se elige «la empresa» de un proyecto, un plan o un sitio.
 * `operationalCompanyWhere` es ese filtro, en un solo sitio para que no se
 * olvide en ninguna pantalla.
 */

export const ACCOUNT_STAGE_LABELS: Record<AccountStage, string> = {
  LEAD:      "Lead",
  PROSPECTO: "Prospecto",
  CLIENTE:   "Cliente",
  INACTIVO:  "Inactivo",
};

export const ACCOUNT_STAGE_DESCRIPTIONS: Record<AccountStage, string> = {
  LEAD:      "Contacto inicial, sin cualificar todavía.",
  PROSPECTO: "Hay conversación en marcha o propuesta enviada.",
  CLIENTE:   "Tiene trabajo contratado o servicios activos.",
  INACTIVO:  "Ya no hay relación comercial.",
};

/** Colores del ciclo de vida, de frío a activo. */
export const ACCOUNT_STAGE_COLORS: Record<AccountStage, string> = {
  LEAD:      "#64748b",
  PROSPECTO: "#f59e0b",
  CLIENTE:   "#22c55e",
  INACTIVO:  "#94a3b8",
};

export const ACCOUNT_STAGES: AccountStage[] = ["LEAD", "PROSPECTO", "CLIENTE", "INACTIVO"];

/**
 * Empresas que pueden operar en el resto de la app: tener proyectos, tickets,
 * planes, sitios y servicios.
 *
 * Solo las que ya son clientes. Los leads y prospectos viven en el CRM hasta
 * que se ganan; los inactivos se conservan por historial pero no se ofrecen
 * para trabajo nuevo.
 *
 * Nota: el backfill dejó en CLIENTE todas las empresas existentes, así que
 * aplicar este filtro no cambió nada de lo que ya había.
 */
export const operationalCompanyWhere: Prisma.CompanyWhereInput = {
  isActive: true,
  stage: "CLIENTE",
};
