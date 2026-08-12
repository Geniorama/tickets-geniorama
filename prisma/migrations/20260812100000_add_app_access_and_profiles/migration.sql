-- Fase 1: permisos por módulo.
--
-- Introduce los niveles de acceso por app y los perfiles reutilizables. El
-- backfill reproduce EXACTAMENTE el acceso que cada usuario tiene hoy según su
-- rol, así que el despliegue no cambia ningún comportamiento: los chequeos de
-- rol existentes siguen mandando hasta que se migren módulo por módulo.
--
-- Los perfiles «Project manager», «Soporte», «Diseño y desarrollo» y
-- «Comercial» se crean disponibles pero SIN asignar a nadie: reparten niveles
-- distintos a los actuales, así que asignarlos es una decisión consciente del
-- administrador, no un efecto colateral de esta migración.

-- CreateEnum
CREATE TYPE "AppKey" AS ENUM ('TICKETS', 'PROYECTOS', 'INFRAESTRUCTURA', 'PORTAL', 'ADMIN', 'CRM');

-- CreateEnum
CREATE TYPE "AccessLevel" AS ENUM ('SIN_ACCESO', 'LECTURA', 'MIEMBRO', 'GESTOR');

-- CreateTable
CREATE TABLE "access_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "grants" JSONB NOT NULL DEFAULT '{}',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_access" (
    "user_id" TEXT NOT NULL,
    "app" "AppKey" NOT NULL,
    "level" "AccessLevel" NOT NULL DEFAULT 'SIN_ACCESO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_access_pkey" PRIMARY KEY ("user_id","app")
);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "profile_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "access_profiles_name_key" ON "access_profiles"("name");

-- AddForeignKey
ALTER TABLE "app_access" ADD CONSTRAINT "app_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "access_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Perfiles del sistema
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "access_profiles" ("id", "name", "description", "grants", "is_system", "updated_at") VALUES
  ('prf_direccion', 'Dirección',
   'Acceso completo a todos los módulos, incluida la administración.',
   '{"TICKETS":"GESTOR","PROYECTOS":"GESTOR","INFRAESTRUCTURA":"GESTOR","ADMIN":"GESTOR","CRM":"GESTOR"}',
   true, CURRENT_TIMESTAMP),

  ('prf_equipo', 'Equipo',
   'Acceso de trabajo a tickets, proyectos e infraestructura. Sin administración.',
   '{"TICKETS":"MIEMBRO","PROYECTOS":"MIEMBRO","INFRAESTRUCTURA":"MIEMBRO"}',
   true, CURRENT_TIMESTAMP),

  ('prf_cliente', 'Cliente',
   'Abre tickets, consulta sus proyectos y su portal.',
   '{"TICKETS":"MIEMBRO","PROYECTOS":"LECTURA","PORTAL":"MIEMBRO"}',
   true, CURRENT_TIMESTAMP),

  ('prf_pm', 'Project manager',
   'Gestiona proyectos; participa en tickets e infraestructura.',
   '{"TICKETS":"MIEMBRO","PROYECTOS":"GESTOR","INFRAESTRUCTURA":"MIEMBRO"}',
   true, CURRENT_TIMESTAMP),

  ('prf_soporte', 'Soporte',
   'Gestiona tickets; participa en proyectos e infraestructura.',
   '{"TICKETS":"GESTOR","PROYECTOS":"MIEMBRO","INFRAESTRUCTURA":"MIEMBRO"}',
   true, CURRENT_TIMESTAMP),

  ('prf_produccion', 'Diseño y desarrollo',
   'Trabaja tickets y tareas; consulta infraestructura.',
   '{"TICKETS":"MIEMBRO","PROYECTOS":"MIEMBRO","INFRAESTRUCTURA":"LECTURA"}',
   true, CURRENT_TIMESTAMP),

  ('prf_comercial', 'Comercial',
   'Gestiona el CRM; consulta tickets y proyectos.',
   '{"TICKETS":"LECTURA","PROYECTOS":"LECTURA","CRM":"GESTOR"}',
   true, CURRENT_TIMESTAMP);

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: el acceso de hoy, tal cual
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE "users" SET "profile_id" = 'prf_direccion' WHERE "role" = 'ADMINISTRADOR';
UPDATE "users" SET "profile_id" = 'prf_equipo'    WHERE "role" = 'COLABORADOR';
UPDATE "users" SET "profile_id" = 'prf_cliente'   WHERE "role" = 'CLIENTE';

-- Niveles explícitos equivalentes al comportamiento actual. Se materializan en
-- app_access además del perfil para que la pantalla de permisos muestre desde
-- el primer día qué tiene cada quien, sin depender de leer el JSON.
INSERT INTO "app_access" ("user_id", "app", "level", "updated_at")
SELECT u."id", a.app::"AppKey", a.level::"AccessLevel", CURRENT_TIMESTAMP
FROM "users" u
CROSS JOIN LATERAL (
  VALUES
    ('TICKETS',         CASE u."role" WHEN 'ADMINISTRADOR' THEN 'GESTOR' WHEN 'COLABORADOR' THEN 'MIEMBRO' ELSE 'MIEMBRO' END),
    ('PROYECTOS',       CASE u."role" WHEN 'ADMINISTRADOR' THEN 'GESTOR' WHEN 'COLABORADOR' THEN 'MIEMBRO' ELSE 'LECTURA' END),
    ('INFRAESTRUCTURA', CASE u."role" WHEN 'ADMINISTRADOR' THEN 'GESTOR' WHEN 'COLABORADOR' THEN 'MIEMBRO' ELSE 'SIN_ACCESO' END),
    ('PORTAL',          CASE u."role" WHEN 'CLIENTE'       THEN 'MIEMBRO' ELSE 'SIN_ACCESO' END),
    ('ADMIN',           CASE u."role" WHEN 'ADMINISTRADOR' THEN 'GESTOR' ELSE 'SIN_ACCESO' END),
    ('CRM',             CASE u."role" WHEN 'ADMINISTRADOR' THEN 'GESTOR' ELSE 'SIN_ACCESO' END)
) AS a(app, level);
