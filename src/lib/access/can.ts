/**
 * Capa de permisos por módulo.
 *
 * Dos ejes, deliberadamente separados:
 *
 *   · El **rol** (`ADMINISTRADOR` / `COLABORADOR` / `CLIENTE`) delimita QUÉ
 *     registros ve alguien. Es la frontera de datos y no se negocia: un cliente
 *     solo ve lo de sus empresas, sin importar los niveles que tenga.
 *   · El **nivel por app** delimita QUÉ puede hacer con lo que ya ve.
 *
 * Regla dura: un nivel nunca amplía la frontera del rol. Por eso `APPS` declara
 * `allowedRoles` y `getAccessLevel()` devuelve SIN_ACCESO si el rol no encaja,
 * aunque exista una concesión explícita en base de datos.
 *
 * Estado: la capa está disponible pero los chequeos de rol existentes todavía
 * no se han migrado a ella. Se irán trasladando módulo por módulo.
 */

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { AccessLevel, AppKey, Role } from "@/generated/prisma";
import { APP_BY_KEY, LEVEL_ORDER } from "@/lib/access/apps";

export type Actor = { id: string; role: Role };

/** Lo que alguien puede hacer dentro de un módulo, de menor a mayor. */
export type Capability = "ver" | "crear" | "editar" | "gestionar";

const REQUIRED_LEVEL: Record<Capability, AccessLevel> = {
  ver: "LECTURA",
  crear: "MIEMBRO",
  editar: "MIEMBRO",
  gestionar: "GESTOR",
};

export type Grants = Partial<Record<AppKey, AccessLevel>>;

/**
 * Niveles efectivos de un usuario: los de su perfil, pisados por sus accesos
 * explícitos.
 *
 * Va envuelto en `cache()` de React, así que se resuelve una vez por request
 * aunque se consulte desde varios sitios. Los permisos no viven en el JWT a
 * propósito: quitarle un acceso a alguien surte efecto de inmediato y no al
 * siguiente inicio de sesión.
 */
export const getGrants = cache(async (userId: string): Promise<Grants> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      profile: { select: { grants: true } },
      appAccess: { select: { app: true, level: true } },
    },
  });

  if (!user) return {};

  const grants: Grants = {};

  // 1. Lo que otorga el perfil.
  const profileGrants = user.profile?.grants;
  if (profileGrants && typeof profileGrants === "object" && !Array.isArray(profileGrants)) {
    for (const [app, level] of Object.entries(profileGrants)) {
      if (typeof level === "string" && level in LEVEL_ORDER) {
        grants[app as AppKey] = level as AccessLevel;
      }
    }
  }

  // 2. Las excepciones explícitas mandan sobre el perfil.
  for (const access of user.appAccess) {
    grants[access.app] = access.level;
  }

  return grants;
});

/**
 * Nivel efectivo en un módulo, ya aplicada la frontera del rol.
 */
export async function getAccessLevel(
  actor: Actor,
  app: AppKey,
): Promise<AccessLevel> {
  const definition = APP_BY_KEY.get(app);
  if (!definition) return "SIN_ACCESO";

  // El rol es el techo: un cliente nunca entra a la administración ni al CRM,
  // aunque alguien le haya concedido un nivel por error.
  if (!definition.allowedRoles.includes(actor.role)) return "SIN_ACCESO";

  const grants = await getGrants(actor.id);
  return grants[app] ?? "SIN_ACCESO";
}

/** ¿Puede este usuario hacer `capability` dentro de `app`? */
export async function can(
  actor: Actor,
  app: AppKey,
  capability: Capability,
): Promise<boolean> {
  const level = await getAccessLevel(actor, app);
  return LEVEL_ORDER[level] >= LEVEL_ORDER[REQUIRED_LEVEL[capability]];
}

/** Los módulos que este usuario puede abrir. Alimenta el lanzador. */
export async function getAccessibleApps(actor: Actor): Promise<AppKey[]> {
  const grants = await getGrants(actor.id);
  const result: AppKey[] = [];

  for (const [key, definition] of APP_BY_KEY) {
    if (!definition.allowedRoles.includes(actor.role)) continue;
    const level = grants[key] ?? "SIN_ACCESO";
    if (LEVEL_ORDER[level] > LEVEL_ORDER.SIN_ACCESO) result.push(key);
  }

  return result;
}
