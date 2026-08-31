/**
 * Registro de módulos.
 *
 * Es la fuente única de qué apps existen, cómo se llaman de cara al usuario y
 * cuáles están construidas. El lanzador y la pantalla de permisos se arman
 * desde aquí, así que dar de alta un módulo nuevo es añadir una entrada.
 */

import type { AppKey, AccessLevel } from "@/generated/prisma";

export type AppDefinition = {
  key: AppKey;
  name: string;
  description: string;
  /** Ruta de entrada del módulo. */
  href: string;
  /**
   * false mientras el módulo no exista. Se puede conceder acceso igualmente
   * —para dejar perfiles preparados— pero la interfaz lo señala como pendiente.
   */
  built: boolean;
  /**
   * false mientras el módulo siga rigiéndose por chequeos de rol. El nivel se
   * guarda pero todavía no decide nada, así que la interfaz debe decirlo: sin
   * este aviso, cambiar un nivel parece no surtir efecto.
   */
  enforced: boolean;
  /**
   * Roles que pueden llegar a tener este módulo. Un cliente no debe recibir
   * acceso a la administración ni al CRM por mucho que se le conceda un nivel.
   */
  allowedRoles: readonly ("ADMINISTRADOR" | "COLABORADOR" | "CLIENTE")[];
};

export const APPS: readonly AppDefinition[] = [
  {
    key: "TICKETS",
    name: "Tickets",
    description: "Soporte y solicitudes de los clientes.",
    href: "/tickets",
    built: true,
    enforced: false,
    allowedRoles: ["ADMINISTRADOR", "COLABORADOR", "CLIENTE"],
  },
  {
    key: "PROYECTOS",
    name: "Proyectos",
    description: "Proyectos, tareas y planificación.",
    href: "/proyectos",
    built: true,
    enforced: true,
    allowedRoles: ["ADMINISTRADOR", "COLABORADOR", "CLIENTE"],
  },
  {
    key: "INFRAESTRUCTURA",
    name: "Infraestructura",
    description: "Sitios, servicios, dominios y vencimientos.",
    href: "/admin/sitios",
    built: true,
    enforced: true,
    allowedRoles: ["ADMINISTRADOR", "COLABORADOR"],
  },
  {
    key: "PORTAL",
    name: "Portal del cliente",
    description: "Empresas, planes y servicios contratados.",
    href: "/mis-empresas",
    built: true,
    enforced: false,
    allowedRoles: ["CLIENTE"],
  },
  {
    key: "ADMIN",
    name: "Administración",
    description: "Usuarios, empresas, planes y productividad.",
    href: "/admin/users",
    built: true,
    enforced: true,
    allowedRoles: ["ADMINISTRADOR"],
  },
  {
    key: "CRM",
    name: "CRM",
    description: "Cuentas, contactos y seguimiento comercial.",
    href: "/crm",
    built: true,
    enforced: true,
    allowedRoles: ["ADMINISTRADOR", "COLABORADOR"],
  },
  {
    key: "FACTURACION",
    name: "Facturación",
    description: "Qué hay por facturar, facturado y cobrado.",
    href: "/facturacion",
    built: true,
    enforced: true,
    // Nunca un cliente: aquí está lo que se le cobra a todos, no solo a él.
    allowedRoles: ["ADMINISTRADOR", "COLABORADOR"],
  },
] as const;

export const APP_BY_KEY = new Map(APPS.map((a) => [a.key, a]));

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  SIN_ACCESO: "Sin acceso",
  LECTURA: "Lectura",
  MIEMBRO: "Miembro",
  GESTOR: "Gestor",
};

/** Orden de menor a mayor: sirve para comparar niveles. */
export const LEVEL_ORDER: Record<AccessLevel, number> = {
  SIN_ACCESO: 0,
  LECTURA: 1,
  MIEMBRO: 2,
  GESTOR: 3,
};
