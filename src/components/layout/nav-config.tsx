import {
  LayoutDashboard, Ticket, Building2, Users, BookOpen, CreditCard,
  BarChart3, FolderKanban, ListTodo, TrendingUp, Server as ServerIcon, Globe,
  KeyRound, Plug, Sparkles, Repeat, Webhook, LayoutList, LayoutTemplate, Bot,
  CalendarClock, Wrench, Briefcase, ShieldCheck, Handshake,
} from "lucide-react";
import type { AppKey, Role } from "@/generated/prisma";

/**
 * Configuración de navegación: qué secciones tiene cada módulo y qué se muestra
 * siempre. Vive aparte de `src/lib/access/apps.ts` a propósito — aquel es el
 * registro de permisos que consume el servidor y no debe arrastrar iconos.
 *
 * El acceso al módulo lo decide `getAccessibleApps()`. El filtro `roles` de
 * cada sección es un segundo tamiz para las que, dentro de un módulo abierto,
 * siguen siendo internas (plantillas de ticket, recurrentes…).
 */

export type NavCapability = "ver" | "crear" | "editar" | "gestionar";

export type NavSection = {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Si se omite, la ve cualquiera que tenga el módulo. */
  roles?: readonly Role[];
  /**
   * Nivel mínimo dentro del módulo. Sin esto, el menú ofrecería enlaces que al
   * pulsarlos redirigen al dashboard — por ejemplo, «Plantillas» a alguien con
   * nivel Lectura en Proyectos.
   */
  requires?: NavCapability;
  /** Marca la sección de entrada del módulo. */
  isRoot?: boolean;
};

const STAFF = ["ADMINISTRADOR", "COLABORADOR"] as const;
const ADMIN = ["ADMINISTRADOR"] as const;

/** Icono de cada módulo en el lanzador y en la cabecera del sidebar. */
export const APP_ICONS: Record<AppKey, React.ElementType> = {
  TICKETS:         Ticket,
  PROYECTOS:       FolderKanban,
  INFRAESTRUCTURA: Wrench,
  PORTAL:          Briefcase,
  ADMIN:           ShieldCheck,
  CRM:             Handshake,
};

export const APP_SECTIONS: Record<AppKey, NavSection[]> = {
  TICKETS: [
    { href: "/tickets",             label: "Tickets",     icon: Ticket,         isRoot: true },
    { href: "/tickets/plantillas",  label: "Plantillas",  icon: LayoutTemplate, roles: STAFF },
    { href: "/reportes",            label: "Reportes",    icon: BarChart3 },
  ],
  PROYECTOS: [
    { href: "/proyectos",                 label: "Proyectos",   icon: FolderKanban,   isRoot: true },
    { href: "/proyectos/reportes",        label: "Reportes",    icon: BarChart3 },
    { href: "/tareas",                    label: "Tareas",      icon: ListTodo,       roles: STAFF },
    { href: "/tareas/plantillas",         label: "Plantillas",  icon: LayoutTemplate, roles: STAFF, requires: "editar" },
    { href: "/admin/tareas-recurrentes",  label: "Recurrentes", icon: Repeat,         roles: ADMIN, requires: "gestionar" },
  ],
  INFRAESTRUCTURA: [
    { href: "/admin/sitios",    label: "Sitios y apps", icon: Globe,      isRoot: true, requires: "ver" },
    { href: "/admin/servicios", label: "Servicios",     icon: ServerIcon, requires: "ver" },
  ],
  PORTAL: [
    { href: "/mis-empresas",  label: "Mis empresas",  icon: Building2,  isRoot: true },
    { href: "/mis-planes",    label: "Mis planes",    icon: CreditCard },
    { href: "/mis-servicios", label: "Mis servicios", icon: ServerIcon },
  ],
  ADMIN: [
    { href: "/admin/users",         label: "Usuarios",      icon: Users,      isRoot: true, requires: "gestionar" },
    { href: "/admin/companies",     label: "Empresas",      icon: Building2, requires: "gestionar" },
    { href: "/admin/plans",         label: "Planes",        icon: BookOpen, requires: "gestionar" },
    { href: "/admin/estadisticas",  label: "Productividad", icon: TrendingUp, requires: "gestionar" },
    { href: "/admin/integraciones", label: "Integraciones", icon: Plug, requires: "gestionar" },
  ],
  // Sin secciones mientras el módulo no exista: el lanzador lo muestra
  // deshabilitado.
  CRM: [],
};

/**
 * Lo que no pertenece a ningún módulo: herramientas y páginas de cuenta que
 * acompañan al usuario esté donde esté.
 */
export const ALWAYS_VISIBLE: NavSection[] = [
  { href: "/dashboard",    label: "Inicio",       icon: LayoutDashboard },
  { href: "/panel",        label: "Panel",        icon: LayoutList,    roles: STAFF },
  { href: "/asistente",    label: "Asistente IA", icon: Bot,           roles: STAFF },
  { href: "/boveda",       label: "Bóveda",       icon: KeyRound },
  { href: "/agendar",      label: "Agendar",      icon: CalendarClock },
  { href: "/integraciones",label: "Integraciones",icon: Webhook },
  { href: "/novedades",    label: "Novedades",    icon: Sparkles },
];

/** Rutas que pertenecen a un módulo pero no son sección propia del menú. */
const EXTRA_PREFIXES: Partial<Record<AppKey, string[]>> = {
  PROYECTOS: ["/proyectos", "/tareas", "/admin/tareas-recurrentes"],
  TICKETS:   ["/tickets", "/reportes"],
  INFRAESTRUCTURA: ["/admin/sitios", "/admin/servicios"],
  PORTAL:    ["/mis-empresas", "/mis-planes", "/mis-servicios"],
  ADMIN:     ["/admin/users", "/admin/companies", "/admin/plans", "/admin/estadisticas", "/admin/integraciones"],
};

/**
 * A qué módulo pertenece una ruta. Devuelve null para lo transversal, que no
 * cambia la app activa: entrar a la Bóveda no debe sacarte de Proyectos.
 *
 * El orden importa: `/admin/tareas-recurrentes` es de PROYECTOS aunque cuelgue
 * de `/admin`, así que se comprueba el prefijo más largo primero.
 */
export function appForPath(pathname: string): AppKey | null {
  const candidatos: { app: AppKey; prefix: string }[] = [];

  for (const [app, prefixes] of Object.entries(EXTRA_PREFIXES) as [AppKey, string[]][]) {
    for (const prefix of prefixes) {
      if (pathname === prefix || pathname.startsWith(prefix + "/")) {
        candidatos.push({ app, prefix });
      }
    }
  }

  if (candidatos.length === 0) return null;
  candidatos.sort((a, b) => b.prefix.length - a.prefix.length);
  return candidatos[0].app;
}
