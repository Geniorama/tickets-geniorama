-- Para el equipo, Tickets y Proyectos pasan a abrirse por nivel y no por rol.
--
-- Hasta ahora bastaba ser administrador o colaborador para entrar, así que hay
-- gente del equipo sin ningún nivel concedido en esos módulos: quien se dio de
-- alta después de la v1.48.0 nació sin perfil. Sin esto perderían Tickets y
-- Proyectos al desplegar.
--
-- Se les concede lo equivalente a lo que ya tenían por rol. Solo a quien no
-- tiene nada dicho: ni fila en app_access ni el módulo en su perfil. Quien
-- tenga un «Sin acceso» puesto a mano lo conserva — es lo que se configuró, y
-- a partir de ahora rige.
INSERT INTO "app_access" ("user_id", "app", "level", "updated_at")
SELECT u."id",
       a.app::"AppKey",
       (CASE u."role" WHEN 'ADMINISTRADOR' THEN 'GESTOR' ELSE 'MIEMBRO' END)::"AccessLevel",
       CURRENT_TIMESTAMP
FROM "users" u
CROSS JOIN (VALUES ('TICKETS'), ('PROYECTOS')) AS a(app)
LEFT JOIN "access_profiles" p ON p."id" = u."profile_id"
WHERE u."role" IN ('ADMINISTRADOR', 'COLABORADOR')
  AND NOT EXISTS (
    SELECT 1 FROM "app_access" x
    WHERE x."user_id" = u."id" AND x."app" = a.app::"AppKey"
  )
  AND NOT (COALESCE(p."grants"::jsonb, '{}'::jsonb) ? a.app);
