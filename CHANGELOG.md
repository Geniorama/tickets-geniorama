# Changelog — Geniorama Tickets

Todas las entregas notables de este proyecto. Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [Unreleased]

---

## 2026-03-16 — `924cb74`

### Añadido
- **Reacciones en comentarios** — 👍 Like, 🧞 Genio, 👎 Dislike, 👀 Revisando en tickets y tareas. Toggle por usuario, contador visible.
- **Informes ejecutivos con IA** — botón "Generar informe" en detalle de tarea y ticket usando Gemini 2.5 Flash. Vista previa en la misma página con scroll propio, texto reducido y opacidad suavizada para modo oscuro.
- **Exportar informe a PDF y DOCX** — descarga directa desde el navegador con `jsPDF` y `docx`.
- **Layout de dos columnas** — en pantallas grandes (≥ 1024 px) el detalle de tarea y ticket divide contenido principal (izquierda) y herramientas IA + comentarios (derecha) al 50/50.
- **Integraciones Google Chat** — envío de notificaciones a canales distintos según tipo de evento mediante webhooks entrantes.
  - Canal **Tickets**: ticket nuevo, ticket asignado, cambio de estado, cambio de fecha límite.
  - Canal **Tareas**: tarea asignada, tarea completada, cambio de fechas inicio/límite.
  - Canal **Comentarios**: comentario en ticket o tarea.
  - Canal **Menciones**: mención con `@` en comentarios.
- **Vista `/admin/integraciones`** — gestión de webhooks de Google Chat desde la UI, con instrucciones paso a paso y estado activo/inactivo por canal.
- **Tabla `app_settings`** en BD para persistir configuración de webhooks sin tocar `.env`.
- **Notificación ticket nuevo** — se notifica a administradores cuando un cliente abre un ticket.
- **Notificación tarea completada** — se notifica al creador y asignado cuando una tarea pasa a "Completado".
- **Notificación cambio de fechas** — se notifica cuando cambia la fecha de inicio o fecha límite de una tarea o ticket.
- **Nueva página `/tareas/new`** — crear tareas desde la vista global con selector de proyecto.

### Corregido
- **Desfase de zona horaria en fechas límite** — las fechas tipo `date` se almacenan en UTC y ahora se muestran con `formatDate` (UTC) en lugar de `formatDateTime` (Bogotá -5 h), evitando que "1 de abril" apareciera como "31 de marzo".

---

## 2026-03-12 — `05c4ced` · `3acaf4d` · `19d786f` · `74bec13` · `6d70dc6`

### Añadido
- Edición y eliminación de adjuntos al editar una tarea.
- Menciones con `@` en comentarios de tickets y tareas.
- Edición y borrado de comentarios propios.
- Sistema de notificaciones en la app (campana en topbar con contador).
- Paginación en listados de tickets.

### Corregido
- Guardado de descripción en tareas.
- Reordenamiento de adjuntos.
- Ajuste de visualización de fechas en tareas.

---

## 2026-03-11 — `631185d` · `6369f9d` · `4fa0c97` · `7107f7a` · `4b42e37` · `3f88c76` · `3ea8ee6`

### Añadido
- **Módulo Bóveda** — contraseñas y accesos cifrados con compartición entre usuarios y vinculación a tickets y proyectos.
- Buscador y filtro por fechas en listado de Bóveda.
- Editor WYSIWYG con Markdown en descripciones de tickets, tareas y proyectos (adjuntos en descripción de proyectos).
- Categorías adicionales en tickets: Hosting, Dominio, Correos.
- Colaboradores pueden gestionar sitios y apps.

### Corregido
- Errores en Bóveda en producción.
- Toolbar del editor Markdown en tareas.
- Altura mínima del editor a 14 rem.
- Impedir que clientes asignen tickets a usuarios.

---

## 2026-03-10 — `565ce5a` · `7daeeb9` · `cef4a52` · `53afc18` · `3725ddd` · `9688a35`

### Añadido
- **Proyectos y tareas** — módulo completo con Kanban, calendario, lista y detalle.
- **Contador de tiempo** en tareas (`TaskTimeEntry`).
- **Asistente IA en tickets** con Gemini 2.5 Flash (diagnóstico, panel colapsable y modal).
- **Sitios y apps** vinculados a tickets con contexto de documentación y arquitectura.
- Borrado de tickets, tareas, proyectos, usuarios, empresas y planes (solo admin).
- Modo claro / oscuro y cambio de contraseña desde el perfil.
- Vista Kanban de tickets.

### Corregido
- Sesión y logout para NextAuth v5 (cookies `authjs.*`).
- Migración a AWS RDS.

---

## 2026-03-09 — `3c76c44`

### Añadido
- **Primera versión funcional** — tickets, planes, usuarios, empresas, autenticación con NextAuth v5, middleware de roles (ADMINISTRADOR, COLABORADOR, CLIENTE).
- Deploy inicial en producción.
