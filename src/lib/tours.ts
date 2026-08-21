import type { Role } from "@/generated/prisma";

export type TourStep = {
  /** Selector CSS del elemento a resaltar. Omitir para un paso centrado (intro/cierre). */
  selector?: string;
  title: string;
  description: string;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
};

export type TourDef = { key: string; steps: TourStep[] };

const isStaff = (r: Role) => r === "ADMINISTRADOR" || r === "COLABORADOR";
const isAdmin = (r: Role) => r === "ADMINISTRADOR";
const isCliente = (r: Role) => r === "CLIENTE";

const nav = (href: string) => `[data-tour-id="${href}"]`;

/** Qué módulos nombrar en el paso del selector, según lo que ese rol puede ver. */
function modulesDescription(role: Role): string {
  if (isCliente(role)) {
    return "Desde aquí entras a cada módulo: Tickets para tus solicitudes de soporte, " +
      "Proyectos para seguir el trabajo en curso y el Portal con tus empresas, planes y servicios contratados.";
  }
  if (isAdmin(role)) {
    return "Desde aquí entras a cada módulo: Tickets, Proyectos, Infraestructura (sitios y servicios) " +
      "y Administración (usuarios, empresas y planes). Solo aparecen los módulos a los que tienes acceso.";
  }
  return "Desde aquí entras a cada módulo: Tickets, Proyectos e Infraestructura. " +
    "Solo aparecen los módulos a los que tienes acceso.";
}

/** Tour de bienvenida: recorre el menú lateral y las partes principales, adaptado al rol. */
export function getWelcomeTour(role: Role): TourDef {
  const steps: TourStep[] = [];

  steps.push({
    title: "¡Bienvenido a Geniorama! 👋",
    description:
      "Te muestro en un minuto cómo está organizada la app y para qué sirve cada parte. Avanza con «Siguiente» y puedes salir cuando quieras.",
  });

  // El menú es contextual: solo se ven las secciones del módulo activo. Por eso
  // los módulos se explican desde el selector y no uno a uno, que es como
  // estaba antes de la v1.59.0 — aquellos pasos apuntaban a enlaces que ya no
  // están visibles a la vez y el tour los descartaba en silencio.
  steps.push({
    selector: '[data-tour-id="app-launcher"]',
    title: "Los módulos",
    description: modulesDescription(role) +
      " Al entrar en uno, el menú de abajo muestra solo sus secciones.",
    side: "right",
  });

  steps.push({
    selector: nav("/dashboard"),
    title: "Inicio",
    description: "Tu resumen de actividad y pendientes. Vuelve aquí cuando quieras elegir otro módulo.",
    side: "right",
  });

  steps.push({
    selector: nav("/boveda"),
    title: "Bóveda",
    description: "Almacén seguro de credenciales y accesos, cifrados. Solo ves lo tuyo o lo que te comparten.",
    side: "right",
  });

  if (isStaff(role)) {
    steps.push({
      selector: nav("/asistente"),
      title: "Asistente IA",
      description: "Te ayuda a diagnosticar, priorizar y avanzar tus tareas, y a planificar proyectos desde documentos.",
      side: "right",
    });
    steps.push({
      selector: nav("/panel"),
      title: "Panel",
      description: "Una vista operativa del equipo para seguir el estado general del trabajo.",
      side: "right",
    });
  }

  // Barra superior y herramientas siempre visibles
  steps.push({
    selector: '[data-tour-id="search"]',
    title: "Buscar en todo",
    description:
      "Encuentra tickets, tareas, proyectos y cuentas sin acordarte de en qué módulo están. Se abre con ⌘K (Ctrl+K en Windows).",
    side: "bottom",
  });
  steps.push({
    selector: '[data-tour-id="notifications"]',
    title: "Notificaciones",
    description: "Aquí llegan tus avisos: asignaciones, comentarios, menciones y vencimientos.",
    side: "bottom",
  });
  steps.push({
    selector: '[data-tour-id="theme"]',
    title: "Tema claro/oscuro",
    description: "Cambia entre modo claro y oscuro cuando quieras.",
    side: "bottom",
  });
  steps.push({
    selector: '[data-tour-id="profile"]',
    title: "Tu perfil",
    description: "Gestiona tu cuenta y tu contraseña.",
    side: "bottom",
  });

  if (isStaff(role)) {
    steps.push({
      selector: '[data-tour-id="assistant-fab"]',
      title: "Asistente a un clic",
      description: "Este botón abre el Asistente IA desde cualquier pantalla.",
      side: "left",
    });
  }

  steps.push({
    selector: '[data-tour-id="tour-help"]',
    title: "¿Repetir el recorrido?",
    description: "Cuando quieras, vuelve a ver este tour —o el de cada sección— desde este botón de ayuda.",
    side: "bottom",
  });

  steps.push({
    title: "¡Listo! 🎉",
    description:
      "Eso es lo esencial. Explora con confianza: cada sección tiene un mini‑recorrido la primera vez que entras.",
  });

  return { key: "welcome", steps };
}

// ─── Tours por página (se ejecutan al entrar a cada módulo) ───────────────────

const PAGE_TOURS: Record<string, TourStep[]> = {
  "/dashboard": [
    {
      selector: '[data-tour-id="page-title"]',
      title: "Tu dashboard",
      description: "Un resumen de tu actividad: lo pendiente, lo reciente y accesos rápidos.",
      side: "bottom",
    },
    {
      selector: '[data-tour-id="page-stats"]',
      title: "Métricas rápidas",
      description: "Indicadores clave de un vistazo: tickets, tareas y su estado.",
      side: "bottom",
    },
  ],
  "/tickets": [
    {
      selector: '[data-tour-id="page-title"]',
      title: "Tickets",
      description: "Ves los tickets según tu rol: los tuyos, los asignados o los de tu empresa.",
      side: "bottom",
    },
    {
      selector: '[data-tour-id="page-filters"]',
      title: "Buscar y filtrar",
      description: "Filtra por estado, prioridad o busca por texto para encontrar un ticket al instante.",
      side: "bottom",
    },
    {
      selector: '[data-tour-id="page-primary-action"]',
      title: "Crear ticket",
      description: "Registra una nueva solicitud o incidencia desde aquí.",
      side: "left",
    },
  ],
  "/proyectos": [
    {
      selector: '[data-tour-id="page-title"]',
      title: "Proyectos",
      description: "Cada proyecto agrupa tareas, archivos, cronograma y la información del cliente.",
      side: "bottom",
    },
    {
      selector: '[data-tour-id="page-filters"]',
      title: "Buscar y filtrar",
      description: "Encuentra proyectos por estado, empresa o nombre.",
      side: "bottom",
    },
    {
      selector: '[data-tour-id="page-primary-action"]',
      title: "Planificar o crear",
      description: "Crea un proyecto, o genera proyectos y tareas a partir de un documento con «Planificar con IA».",
      side: "left",
    },
  ],
  "/tareas": [
    {
      selector: '[data-tour-id="page-title"]',
      title: "Tareas",
      description: "Tu trabajo de proyectos en un solo lugar, con prioridad, fechas y responsable.",
      side: "bottom",
    },
    {
      selector: '[data-tour-id="page-filters"]',
      title: "Filtrar tu trabajo",
      description: "Filtra por estado, proyecto o responsable para enfocarte en lo importante.",
      side: "bottom",
    },
    {
      selector: '[data-tour-id="page-primary-action"]',
      title: "Nueva tarea",
      description: "Crea una tarea, o usa «Planificar con IA» para generarlas desde un brief o notas.",
      side: "left",
    },
  ],
  "/boveda": [
    {
      selector: '[data-tour-id="page-title"]',
      title: "Bóveda",
      description: "Tus credenciales y accesos, cifrados y privados. Solo ves lo tuyo o lo compartido contigo.",
      side: "bottom",
    },
    {
      selector: '[data-tour-id="page-primary-action"]',
      title: "Nuevo acceso",
      description: "Guarda una credencial de forma segura y, si quieres, compártela con quien la necesite.",
      side: "left",
    },
  ],
};

export function getPageTour(pathname: string): TourDef | null {
  const steps = PAGE_TOURS[pathname];
  return steps ? { key: `page:${pathname}`, steps } : null;
}

export function hasPageTour(pathname: string): boolean {
  return pathname in PAGE_TOURS;
}
