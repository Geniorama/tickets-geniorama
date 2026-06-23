# Changelog — Geniorama Tickets

Todas las entregas notables de este proyecto. Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionado semántico: `MAJOR.MINOR.PATCH` — funciones nuevas incrementan MINOR, correcciones incrementan PATCH.

---

## [Unreleased]

---

## [1.34.0] — 2026-06-23

### Pegar listas en el checklist las separa en ítems
- Al **pegar texto en cualquier checklist** (tickets y tareas: formularios de creación/edición, plantillas, recurrentes y el panel de la vista de detalle), cada renglón se detecta y se agrega como un **ítem independiente**.
- Se reconocen y limpian los marcadores de lista más comunes: **viñetas** (`-`, `*`, `•`, `·`, `◦`, flechas…), **numeración/letras** (`1.`, `1)`, `a.`, `a)`), **casillas** (`[ ]`, `[x]`) y **renglones tabulados/indentados**. Las líneas vacías se descartan.
- Si lo pegado es una sola línea, el comportamiento no cambia (se escribe en el campo como siempre).
- Nuevo helper `src/lib/checklist-paste.ts` (`parseChecklistPaste`) y server actions de inserción múltiple `addTicketChecklistItems` / `addTaskChecklistItems` (vía `createMany`) para el panel de detalle.

---

## [1.33.0] — 2026-06-23

### Plantillas de ticket
- Nuevo módulo de **plantillas de ticket** (`/tickets/plantillas`), análogo al de plantillas de tarea. El staff (ADMINISTRADOR/COLABORADOR) puede crear, editar y eliminar plantillas reutilizables con **nombre, título, descripción, prioridad, categoría y checklist**.
- El formulario de **«Nuevo ticket»** muestra ahora un **selector de plantilla** (solo staff): al elegir una, prellena título, descripción, prioridad, categoría y checklist, que siguen siendo editables antes de crear el ticket.
- Las plantillas son **globales** (compartidas por el staff) y **no** incluyen cliente/plan/sitio, ya que esos datos dependen del ticket concreto.
- Nuevo modelo Prisma `TicketTemplate` (tabla `ticket_templates`) y server actions `createTicketTemplate` / `updateTicketTemplate` / `deleteTicketTemplate`.
- Acceso desde el sidebar: **Tickets → Plantillas**.

---

## [1.32.0] — 2026-06-19

### Vista previa de programación en plantillas recurrentes
- El formulario de plantillas recurrentes muestra ahora una **vista previa de las próximas 5 tareas** que generará, con su fecha y una descripción legible de la cadencia (p. ej. _"Cada semana (Lun, Mié)"_). Se recalcula en vivo al cambiar frecuencia, intervalo, días, fecha de inicio/fin u offset de vencimiento.
- La previsualización reutiliza la **lógica real del runner** (`computeNextRunAt` / `describeRecurrence` de `src/lib/recurrence.ts`): la 1ª ocurrencia es la fecha de inicio (`nextRunAt = startDate`) y de ahí encadena; respeta `endDate` cuando no hay offset de vencimiento.

### Avisos de éxito al guardar
- Se añadieron **mensajes de confirmación** (toast verde) al guardar cambios, al "Ejecutar ahora" una plantilla y al crear una nueva (vía `?created=1` tras el redirect a edición). Se auto-ocultan a los 5 segundos.

### Corrección: la columna "Próxima" coincide con la vista previa
- **"Ejecutar ahora"** avanzaba `nextRunAt` anclándolo a `now` (instante del clic, con hora del día), en vez de encadenar desde la fecha programada como hace el cron. Resultado: la columna **"Próxima"** del listado dejaba de coincidir con la vista previa. Ahora `runRecurringNow` usa la misma lógica que el cron (encadena desde `nextRunAt` y salta lo vencido) y **no altera la cadencia** si la próxima fecha aún es futura.
- `toDateLocal` ahora fija la **medianoche UTC** explícita, de modo que `formatDate` (que lee partes UTC) muestre siempre el día tecleado sin depender de la zona horaria del servidor.

---

## [1.31.1] — 2026-06-19

### Build movido a CI — el servidor ya no compila
- El **build de Next.js se ejecuta ahora en GitHub Actions** (runner `ubuntu-latest`), no en el servidor. El servidor solo **recibe el bundle ya compilado** y reinicia PM2: se acabaron las caídas por falta de RAM durante `next build`.
- Se activó el **output `standalone`** de Next (`next.config.ts`): genera un servidor autocontenido con solo las dependencias necesarias, así no hay que subir todo `node_modules` ni correr `npm install` en el servidor.
- El bundle se sube por **`rsync`** a `/home/ubuntu/tickets-geniorama-app/` (con `--exclude=.env*` para no tocar el `.env.local` del servidor) y arranca con `node server.js` bajo PM2.
- `next.config.ts`: se añadió `outputFileTracingIncludes` para que el query engine de Prisma (WASM, en la ruta custom `src/generated/prisma`) viaje dentro del bundle standalone.

> **Nota de despliegue:** las migraciones de Prisma se siguen ejecutando manualmente desde el servidor (el runner de CI no tiene acceso a RDS). Ver pasos de configuración inicial en el README/notas de deploy.

---

## [1.31.0] — 2026-06-19

### Plantillas y checklists en tareas recurrentes
- Al crear o editar una **tarea recurrente**, ahora se puede **prellenar el formulario desde una plantilla de tarea** existente (copia título, descripción, prioridad, categoría, horas estimadas y checklist), y luego ajustar los campos.
- Las tareas recurrentes ahora admiten un **checklist**: cada tarea generada —tanto la generación manual («Generar tarea ahora») como la automática del cron— crea sus ítems de checklist a partir de la plantilla recurrente.
- Nuevo campo `checklist` (lista de textos) en el modelo `RecurringTaskTemplate`. Cambio **no destructivo** (columna con valor por defecto vacío); las plantillas existentes siguen funcionando sin checklist.

### Selector de modelo IA en los informes
- Los **informes IA** de **tareas**, **proyectos** y **tickets** ahora incluyen el mismo **switch de modelo (Gemini / OpenAI)** que el asistente y el diagnóstico. El staff elige el proveedor antes de generar el informe.
- Antes los informes estaban fijos a Gemini; ahora enrutan la llamada al servicio del proveedor elegido (por defecto sigue siendo Gemini).

### Webhooks de equipo: sin avisos de asignación individual
- Las notificaciones de **asignación** de tickets y tareas («Se te asignó…») **ya no se envían al webhook de equipo (Google Chat)**, porque están redactadas en segunda persona y no corresponden a un canal compartido. El canal de equipo ya recibe el aviso de **«Nuevo ticket / Nueva tarea»**, que incluye el encargado.
- Se conservan intactas la **notificación in-app** del destinatario, su **webhook personal** y el **correo al cliente**. Solo se omite el reenvío redundante al canal de equipo.

### Servicios accesible para colaboradores
- La sección **Servicios** ahora es visible y gestionable para **colaboradores**, igual que **Sitios y apps**. Pueden ver, crear, editar, duplicar y eliminar servicios.
- La vista **«Mis servicios»** de clientes no cambia.

### Corrección de UI
- Se corrigió el selector de **revisores** en la creación/edición de tickets, que perdía su estructura (la flecha y la alineación se veían mal). El componente de multiselección ahora conserva siempre su layout, sin importar si recibe estilos por clase o inline.

---

## [1.30.0] — 2026-06-18

### Selector de modelo IA en el diagnóstico de tickets
- La herramienta de **diagnóstico IA** del detalle de ticket ahora incluye el mismo **switch de modelo (Gemini / OpenAI)** que el asistente global y el planificador. El staff puede elegir el proveedor antes de solicitar el diagnóstico.
- Antes el diagnóstico estaba fijo a Gemini; ahora valida que el proveedor elegido esté configurado y enruta la llamada al servicio correspondiente.

---

## [1.29.0] — 2026-06-16

### Tour guiado para nuevos usuarios
- Nuevo **recorrido guiado** que explica para qué sirve cada módulo y cada parte de la app, construido sobre `driver.js`.
- **Tour de bienvenida**: resalta los ítems del menú lateral y las herramientas principales (notificaciones, tema, perfil, asistente IA, botón de ayuda), **adaptado al rol** (administrador, colaborador y cliente ven los pasos correspondientes a sus módulos).
- **Recorridos por sección**: al entrar por primera vez a Dashboard, Tickets, Proyectos, Tareas y Bóveda, un mini‑tour explica el encabezado, los filtros/búsqueda y la acción principal de esa página.
- **Inicio automático** en el primer ingreso; se recuerda lo ya visto en el navegador (`localStorage`), sin volver a interrumpir. Cada recorrido puede **repetirse** desde el nuevo botón de **ayuda (?)** en la barra superior.
- Textos en español; los pasos cuyo elemento no está visible (p. ej. el menú en móvil) se omiten automáticamente.

---

## [1.28.0] — 2026-06-16

### Múltiples adjuntos en comentarios
- Los comentarios (de **tickets** y **tareas**) ahora permiten adjuntar **varios archivos y varios enlaces** en un mismo comentario, en lugar de uno solo. Se pueden ir agregando enlaces (URL + etiqueta) y archivos de forma incremental, con vista previa y opción de quitarlos antes de enviar.
- Nuevo modelo de datos: tablas `ticket_comment_attachments` y `task_comment_attachments` (1‑N con el comentario). Cambio **no destructivo**: los comentarios existentes conservan su adjunto único y se siguen mostrando; los nuevos usan la tabla de adjuntos múltiples. La visualización unifica ambos.
- En tickets, adjuntar sigue siendo exclusivo del **staff**; en tareas, disponible para cualquier usuario con acceso (se mantiene el comportamiento previo). Límite de 10 MB por archivo.
- Componente compartido `ui/comment-attachments-input` reutilizado por los formularios de comentarios de tickets y tareas. Los botones **«Adjuntar archivo» / «Adjuntar enlace»** ahora son más visibles y muestran un contador de adjuntos pendientes.
- **Clientes:** ya no pueden adjuntar archivos al ticket desde el detalle después de creado; solo pueden hacerlo dentro de los **comentarios**. La subida directa al ticket queda reservada al equipo (restricción aplicada también en el servidor, no solo en la UI).
- **Requiere ejecutar la migración** `20260616180000_add_comment_attachments` en la base de datos.

---

## [1.27.0] — 2026-06-16

### Asistente IA para colaboradores
- Nueva sección **«Asistente IA»** en el menú lateral (solo staff: administradores y colaboradores) con un **chat global** que ayuda a **diagnosticar, planear y avanzar** las tareas de proyectos.
- El asistente tiene contexto de las **tareas activas** del colaborador (pendientes, en progreso y en revisión): proyecto, prioridad, fechas de inicio/vencimiento (marca las **vencidas**), estimación y checklist. Puede priorizar, sugerir en qué enfocarse y descomponer trabajo en pasos.
- También accede a los **comentarios recientes** de cada tarea y a los **tickets activos** asignados al colaborador (con su descripción, sitio/app afectado, prioridad, vencimiento y comentarios), para diagnosticar con más contexto. Los tickets son de solo consulta: las acciones de un clic siguen aplicando únicamente a tareas.
- **Revisores:** el asistente conoce las **tareas pendientes de tu revisión** (donde eres revisor) y puede ayudarte a descubrirlas y, tras revisarlas, aprobarlas (marcar completadas) o devolverlas. Se añadieron prompts sugeridos en el chat para revisar pendientes, resumir tickets, detectar comentarios que requieren atención y armar un plan del día.
- **Acciones de un clic** que el colaborador confirma manualmente (el asistente nunca ejecuta solo): **cambiar el estado** de una tarea, **agregar ítems de checklist** y **crear una tarea** nueva en uno de sus proyectos. Cada propuesta se muestra como una tarjeta con botones «Confirmar» / «Descartar».
- **Botón flotante** de acceso rápido (esquina inferior derecha, visible en toda la app para staff) que abre el asistente con un clic; se expande al pasar el cursor y se oculta cuando ya estás en la sección. El cronómetro flotante se reubicó para no solaparse con él.
- Construido sobre la integración existente con **Gemini 2.5 Flash** (function-calling). Los IDs propuestos por el modelo se validan contra el contexto real y los permisos se re-verifican en el servidor antes de aplicar cualquier cambio.
- Se extrajo el renderizador de Markdown a un componente compartido (`ui/markdown-text`), reutilizado por el asistente de tickets y el nuevo chat.

### Planificador con IA (desde documentos)
- Nueva herramienta **«Planificar con IA»** disponible en las secciones de **Proyectos** y **Tareas** (staff), que genera un plan de trabajo a partir de un documento: **notas de reunión, briefs, etc.**
- El documento se puede **pegar como texto y/o subir como archivo** (PDF, Word `.docx` o `.txt`). Los PDF se procesan de forma nativa con Gemini y los Word se extraen con `mammoth`.
- La IA propone un **plan estructurado**: un **proyecto nuevo** (nombre, descripción, empresa y fechas sugeridas) o tareas para un **proyecto existente**, con una lista de **tareas** (prioridad, estimación) y sus **subtareas** (checklist). También **sugiere responsables** del equipo según el contenido del documento.
- El plan es **revisable y editable** antes de aplicarse: se puede ajustar el proyecto, incluir/excluir tareas, cambiar prioridad y responsable, y quitar subtareas. Con un clic se crean el proyecto (si aplica), todas las tareas y sus checklists.
- **Permisos:** crear proyectos nuevos sigue siendo exclusivo de administradores; los colaboradores generan tareas y subtareas sobre proyectos existentes. Los responsables sugeridos se validan contra el equipo activo y los permisos se re-verifican en el servidor.
- Al aplicar el plan se envía una notificación-resumen a cada responsable y un aviso a Google Chat (en proyectos no privados), evitando spam por tarea.

### OpenAI como proveedor de IA alternativo
- El **chat del asistente** y el **planificador desde documentos** permiten ahora elegir el proveedor de IA **por petición** con un selector **Gemini / OpenAI**.
- Nueva capa de abstracción (`lib/ai`) que unifica ambos proveedores tanto para el chat con herramientas (function-calling) como para la salida estructurada del planificador. OpenAI procesa los PDF mediante entrada de archivo nativa.
- Modelo de OpenAI por defecto: **gpt-4o-mini**, configurable con la variable `OPENAI_MODEL`. Requiere `OPENAI_API_KEY`; si falta, el selector muestra un error claro al usar OpenAI. Gemini sigue siendo el predeterminado.

---

## [1.26.0] — 2026-06-16

### Bóveda: notificación al compartir y visibilidad restringida
- Al **compartir** una entrada de la Bóveda con un usuario, ahora se le **notifica** (notificación in-app `vault_shared` con enlace a la entrada). Solo se notifica cuando el acceso es nuevo, no al reintentar uno existente. Es una notificación sensible: no se envía a Google Chat.
- Las entradas de la Bóveda ahora son **visibles solo para su creador y los usuarios con los que se comparte**. Se eliminó la excepción que permitía a los administradores ver y gestionar todas las entradas: ahora los admins quedan en igualdad de condiciones (solo ven/gestionan lo propio o lo compartido con ellos).
- La restricción aplica en todas las superficies: lista y detalle de Bóveda, edición, y los paneles de Bóveda embebidos en el detalle de tickets, proyectos y tareas. Editar, borrar y compartir siguen siendo exclusivos del **creador**; los usuarios compartidos solo pueden ver.

---

## [1.25.0] — 2026-06-16

### Tickets y tareas en modo borrador
- El **staff** (administradores y colaboradores) puede ahora **guardar tickets y tareas como borrador** desde el formulario de creación, mediante el botón «Guardar como borrador» junto al de crear. Los clientes siguen creando tickets directamente (sin borradores).
- Los borradores son **privados de su creador**: no aparecen en las listas, el dashboard, el panel, los reportes, el calendario, las alertas de vencimiento ni el cron de vencidos para nadie más, y su detalle devuelve 404 a quien no los creó.
- Un borrador **no dispara notificaciones** (in-app, Google Chat ni email) ni cuenta en la detección de conflictos de horario hasta que se publica.
- El creador ve sus borradores en sus listas de tickets/tareas con una etiqueta **«Borrador»**, y en el detalle aparece un aviso con el botón **«Publicar»**, que vuelve el ticket/tarea visible para todos y lanza las notificaciones de creación habituales.
- El **número/código consecutivo se asigna recién al publicar** (los borradores quedan en `number = 0` y no muestran código), de modo que no se consumen números ni se generan huecos por borradores que nunca se publican.
- Esquema: nuevo campo `isDraft` (`is_draft`, por defecto `false`) en `Ticket` y `Task`. Nuevas server actions `publishTicket` y `publishTask`.

---

## [1.24.1] — 2026-06-03

### Corrección de día desfasado en el cronograma
- En la vista de **Calendario / Cronograma** del detalle de proyecto, las tareas con fecha aparecían un día antes (p. ej. una tarea del lunes se mostraba el domingo). Las fechas sin hora se guardan como medianoche UTC y `react-big-calendar` las renderizaba en hora local (America/Bogota, UTC-5), desfasándolas un día. Ahora `task-calendar.tsx` reconstruye cada fecha a medianoche local usando las partes UTC (`toLocalDateOnly`), igual que ya hacía `formatDate`, de modo que el día mostrado coincide con el día programado.

## [1.24.0] — 2026-06-03

### Configuración del proyecto visible en el detalle de tarea
- En el detalle de una tarea de proyecto (`/proyectos/[id]/tareas/[taskId]`) ahora se muestran, debajo de la tarea, los paneles de **Accesos (bóveda)** y **Adjuntos** del proyecto, bajo el título «Configuración del proyecto». La página obtiene las entradas de bóveda vinculadas/disponibles (respetando la visibilidad por usuario) y los adjuntos del proyecto, y reutiliza `ProjectVaultPanel` y `ProjectAttachmentsPanel`. Solo staff/admin acceden al detalle de tarea, por lo que pueden gestionarlos.

---

## [1.23.0] — 2026-06-03

### Botones de acción unificados en tablas
- **Componente compartido `IconAction` / `IconActionLink`** (`src/components/ui/icon-action.tsx`) — botón/enlace de icono cuadrado (2rem, bordeado) con tooltip al pasar el cursor, sin texto. Tonos semánticos: `neutral` (hover rosa de marca), `danger` (rojo), `success` (verde). Spinner al estar pendiente. El icono se pasa por **nombre** (string serializable, vía registro interno) para poder usarse desde Server Components.
- **Tablas unificadas** — usuarios, empresas, sitios, planes, servicios, plantillas de tarea y bóveda ahora muestran sus acciones (ver, editar, eliminar, duplicar, activar/desactivar, reenviar invitación, crear desde plantilla, usar en formulario) como iconos con tooltip, con colores consistentes y sin textos sueltos.
- **Tooltip global** — estilo `.icon-action-wrap`/`.icon-action-tip` en `globals.css`, reemplazando los tooltips ad-hoc de los botones de servicios.

---

## [1.22.0] — 2026-06-03

### Plan vencido: lectura sí, creación no
- **Clientes con plan vencido/agotado** conservan el acceso de **lectura** a sus tickets antiguos (lista y detalle nunca se bloquean por plan), pero **no pueden crear nuevos**.
- En `/tickets` el botón «Nuevo ticket» se oculta para clientes sin plan activo y se muestra un aviso para contactar a su agente. La página `/tickets/new` y el server action `createTicket` ya bloqueaban la creación (se mantienen como salvaguarda).

---

## [1.21.0] — 2026-06-03

### Exportar PDF de reportes de proyectos
- **Botón «Exportar PDF»** en `/proyectos/reportes` — usa el diálogo de impresión del navegador (igual que los reportes de tickets). Exporta lo que está en pantalla: KPIs globales, proyectos por estado, tabla por proyecto y, si hay un proyecto seleccionado, su panel de estadísticas individual.
- **Encabezado de impresión** con título, fecha de generación y proyecto seleccionado; el selector y el botón se ocultan en el PDF (`no-print`).
- **Colores fieles** — se añadió `print-color-adjust: exact` a la hoja de impresión para que las barras, badges y gráficos conserven su color en el PDF (también mejora el reporte de tickets).
- **Layout de impresión** — se evita que el contenido se recorte: `overflow: visible` en impresión, tablas que reducen fuente/padding y reparten filas entre páginas (encabezado repetido), sin partir secciones, y margen de página reducido a 1cm.

---

## [1.20.0] — 2026-06-03

### Estadísticas de proyecto individual en reportes
- **Selector de proyecto** en `/proyectos/reportes` — además de la vista global (KPIs + tabla), se puede elegir un proyecto para ver un panel detallado de sus estadísticas, sin perder la vista agregada.
- **Panel individual** — KPIs del proyecto (tareas, completadas, vencidas, progreso, horas estimadas), desglose de tareas por estado y por prioridad (con barras segmentadas) y resumen por responsable (completadas/total). Respeta el alcance por rol (el proyecto debe ser visible para el usuario).

---

## [1.19.0] — 2026-06-03

### Cargo y Área en usuarios staff
- **Nuevos campos `cargo` y `area`** en usuarios. Aparecen en los formularios de crear/editar usuario **solo cuando el rol es Administrador o Colaborador** (los clientes no los tienen; se fuerzan a `null`).
- **Visualización** — el detalle del usuario muestra cargo y área junto al rol.
- **Esquema** — columnas `cargo String?` y `area String?` en `users`, aplicadas con `prisma db push`. Acciones `createUser`/`updateUser` validan y persisten ambos campos.

---

## [1.18.0] — 2026-06-03

### Plantillas de tarea reutilizables
- **Nueva sección Plantillas** (`/tareas/plantillas`, staff) — el staff crea plantillas globales reutilizables para tareas frecuentes. Guardan nombre, título, descripción, prioridad, categoría, horas estimadas y una checklist.
- **Dos formas de uso**: (1) selector «Usar plantilla» en «Nueva tarea» (global y por proyecto) que prellena el formulario vía `?template=<id>` —se puede ajustar antes de crear— y (2) acción rápida «Crear tarea» que genera una tarea global directamente con la checklist incluida.
- **Modelo `TaskTemplate`** (`name`, `title`, `description`, `priority`, `category`, `estimatedHours`, `checklist String[]`, `createdBy`). Aplicado con `prisma db push` (tabla `task_templates`). Es independiente de `RecurringTaskTemplate` (que es por calendario).
- **Acciones** `src/actions/task-template.actions.ts` — CRUD + `createTaskFromTemplate`. `TaskForm` gana una prop `prefill` para inicializar campos y checklist.
- **Sidebar** — submenú «Plantillas» bajo «Tareas» (admin y colaborador).

---

## [1.17.0] — 2026-06-03

### Revisores en tickets y tareas
- **Asignación de revisores** — tanto tickets como tareas permiten asignar varios usuarios a la revisión (relación muchos-a-muchos `reviewers`). Si no se asigna ninguno, por defecto queda **quien creó la entrada** (se persiste, nunca queda vacío).
- **Notificación al entrar en revisión** — cuando un ticket/tarea pasa a estado «En revisión», se notifica a sus revisores (campana + webhooks personales), excluyendo a quien dispara el cambio. Se cubren todos los puntos de transición: `updateTicketStatus`, `updateTicket`, `configureTicket`, `updateTaskStatus` y `updateTask`. No duplica el aviso al canal del equipo (`skipGChat`).
- **Selector** — los formularios de ticket (crear/editar) y de tarea (crear/editar) muestran un multiselector de revisores **con búsqueda por texto** (cualquier usuario activo es elegible). El campo aparece solo para staff. `MultiSelect` gana una prop `searchable` que muestra un campo de búsqueda dentro del desplegable.
- **Visualización** — el detalle de ticket y de tarea muestra la lista de revisores junto al responsable.
- **Esquema** — relaciones implícitas `TicketReviewers` y `TaskReviewers` (tablas `_TicketReviewers`, `_TaskReviewers`). Aplicado con `prisma db push`.
- **Helper** `src/lib/reviewers.ts` — `parseReviewerIds`, `resolveReviewerIds` (fallback al creador) y `notifyReviewers`.

---

## [1.16.0] — 2026-06-03

### Panel unificado de tickets y tareas
- **Nueva sección Panel** (`/panel`, solo staff) — visualiza tickets y tareas en una sola tabla ordenable para filtrar y priorizar. Columnas: Tipo, Código, Título (+contexto: empresa/proyecto), Estado, Prioridad, Responsable y Vence. Resalta los vencidos.
- **Orden de priorización por defecto** — vencidos primero, luego por prioridad (crítica → baja) y por fecha de vencimiento más próxima. Cada columna es ordenable; ordenamiento y paginación se resuelven en el servidor sobre el conjunto combinado (`src/lib/panel.ts`).
- **Alcance por rol** — el colaborador ve por defecto lo asignado a él (redirect inicial con `assignedToId`); el admin ve todo. Las tareas respetan la restricción de staff (asignadas o de proyectos que gestiona).
- **Filtros** — tipo (tickets/tareas), prioridad, responsable, "solo vencidos", "incluir cerradas/completadas" y búsqueda de texto. Reusa `FilterTags`, `SearchInput`, `Pagination` y `MultiSelect`. Tope defensivo de 500 filas por fuente, ordenadas por `updatedAt` desc.
- **Sidebar** — nuevo ítem "Panel" para administradores y colaboradores.

---

## [1.15.0] — 2026-06-03

### Integraciones — Webhooks personales
- **Nueva sección Integraciones para todos los usuarios** (`/integraciones`) — cada usuario (admin, colaborador o cliente) registra hasta 10 webhooks para enviar **solo sus propias** notificaciones a apps externas (Zapier, Make, n8n, Slack, etc.). La sección admin de Google Chat se renombró a "Integraciones (equipo)".
- **Suscripción por categorías** — cada webhook elige qué recibir entre Tickets, Tareas, Comentarios y Menciones (`src/lib/notification-categories.ts` mapea cada `type` de notificación a su categoría).
- **Payload JSON genérico** — POST con `{ event, category, title, message, url, timestamp, text }`. El campo `text` viene preformateado para destinos de solo texto. Cabeceras `X-Geniorama-Event` y, si hay secreto, firma HMAC SHA-256 en `X-Geniorama-Signature`. Timeout de 8s y registro de `lastStatus`/`lastError`/`lastSentAt` por webhook. Botón "Probar" envía un payload de ejemplo.
- **Disparo** — `src/lib/notify.ts` (`notify`/`notifyMany`) llama a `dispatchUserWebhooks` por destinatario, fire-and-forget, sin bloquear la acción principal.
- **Modelo `UserWebhook`** (`label?`, `url`, `secret?`, `events String[]`, `isActive`, `lastStatus?`, `lastError?`, `lastSentAt?`). Aplicado con `prisma db push` (nueva tabla `user_webhooks`).

### Tareas
- **Columna "Creado por"** en la lista de tareas (`/tareas`, detalle de proyecto y perfil de usuario), ordenable, también visible en la vista mobile.
- **Limpiar todos los filtros** — botón "Limpiar todo" y centinela `?clear=1` para poder dejar la vista sin filtros sin que se reapliquen los predeterminados (`filter-tags.tsx`, `task-filters.tsx`).
- **Categorías de Marketing Digital** — lista centralizada y agrupada en `src/lib/task-categories.ts` (Estrategia Digital, Redes Sociales, Community Management, SEO, SEM, Email Marketing, Branding, etc.) usada por el form de tareas y el de tareas recurrentes (este último pasó de texto libre a `<select>`).

### Planes
- **ID visible** — cada plan muestra su ID (cuid) para distinguir planes con el mismo nombre, en "Mis planes" (cliente), tabla admin, selects de plan en tickets y detalle de ticket. Nuevo componente `CopyId` con copiar-al-portapapeles.

---

## [1.14.0] — 2026-05-18

### Tareas recurrentes
- **Nueva sección Admin → Tareas recurrentes** — los administradores definen plantillas que generan tareas automáticamente cada cierto período. Soporta tres patrones: cada N días, cada N semanas (con días específicos Lun/Mié/Vie…), o cada N meses (día del mes específico o último día). Fecha de fin opcional; fin indefinido por defecto. Cada plantilla configura prioridad, categoría, horas estimadas, responsable, proyecto (o global) y offset de vencimiento de la tarea generada.
- **Endpoint cron `/api/cron/recurring-tasks`** — análogo a `/api/cron/overdue`: barre plantillas activas cuya `nextRunAt <= hoy`, crea la tarea, avanza el `nextRunAt` según patrón y registra `lastRunAt`. Debe configurarse en el cron runner (Vercel Cron / sistema) para correr una vez al día. Mismo Bearer `CRON_SECRET` opcional para auth.
- **Plantilla → tareas globales** — `Task.projectId` ahora es nullable. Las tareas sin proyecto se listan en `/tareas` (columna Proyecto muestra "Sin proyecto") y tienen rutas propias `/tareas/[id]` y `/tareas/[id]/edit`. Las actions (`updateTask`, `deleteTask`, `duplicateTask`, comments, timer, checklist, reactions) aceptan `projectId: string | null` y revalidan la ruta correspondiente.
- **Forma del cuerpo de la plantilla** — `RecurringTaskTemplate` (modelo Prisma): `frequency` enum, `interval`, `daysOfWeek` CSV ("1,3,5"), `dayOfMonth` (-1 = último día), `startDate`, `endDate?`, `nextRunAt`, `lastRunAt?`, `isActive`, `dueDateOffsetDays`. Índice compuesto `(isActive, nextRunAt)` para el query del cron. `Task.recurringTemplateId` enlaza cada tarea generada con la plantilla origen.
- **UI** — `/admin/tareas-recurrentes` lista plantillas con próxima ejecución, patrón legible y conteo de tareas generadas. Form unificado para crear/editar con botón "Generar tarea ahora" para disparo manual y "Pausar/Activar". Sidebar agrega submenú "Recurrentes" bajo "Tareas" (solo admin).
- **Migración** — aplicada con `prisma db push` (la historia de migraciones estaba desincronizada con la DB en RDS). Cambios: nueva tabla `recurring_task_templates`, columna `recurring_template_id` en `tasks`, `project_id` en `tasks` ahora nullable.

---

## [1.13.1] — 2026-05-07

### Fixes
- **Eliminación de usuarios** — el pre-check de relaciones solo cubría 9 de las ~14 relaciones FK bloqueantes del modelo `User`, por lo que un usuario con `TicketAttachment`, `TimeEntry`, `TaskAttachment`, `TaskTimeEntry`, `Service`, `VaultEntry`, `ProjectAttachment` o checklist items pasaba la validación y luego rompía con un error de Prisma sin manejar (`P2003`). `src/actions/user.actions.ts` ahora envuelve el `prisma.user.delete` en try/catch y traduce `P2003` al mismo mensaje amigable que sugiere desactivar al usuario.

---

## [1.13.0] — 2026-04-27

### Tickets
- **Fecha límite al crear tickets** — admin y colaboradores la asignan directamente en el formulario; los clientes no ven el campo y el server action lo ignora si lo envían. Si está presente al crear, viaja también a la notificación de Google Chat.
- **Códigos legibles "ACM-12"** — cada ticket recibe un prefijo derivado del nombre de la empresa propietaria (`plan.company` → `client.companies[0]` → fallback `TKT`) y un número correlativo dentro de ese prefijo. Visible en listado, kanban, detalle y "Tickets recientes" del dashboard.
- **`prisma/schema.prisma`** — nuevas columnas `prefix String?` y `number Int @default(0)` en `Ticket`.
- **Migración** `prisma/migrations/20260427120000_add_ticket_code/` — añade ambas columnas a `tickets` (aplicada en RDS).
- **`src/lib/ticket-code.ts`** — helpers `ticketPrefix()` y `ticketCode()` reusando `projectPrefix`.
- **`createTicket`** y **`duplicateTicket`** envuelven la creación en `prisma.$transaction` y asignan `number = max(number)+1` dentro del prefijo.
- **Backfill** `scripts/backfill-ticket-codes.ts` — script idempotente que asigna `prefix`/`number` correlativo a tickets pre-existentes (35 actualizados).
- **Filtros unificados con tareas** — los filtros de tickets ahora usan grid plano (sin tarjeta colapsable), variables de tema (`--app-border`, `--app-card-bg`) en lugar de colores fijos, y aplicación inmediata al cambiar cualquier campo. Se conservan todos los campos (estado, asignado, creado por, empresa, 4 rangos de fecha).

### Filtros, búsqueda y paginación
- **Selector de filas por página** en todas las listas paginadas (tickets, tareas, proyectos, bóveda, usuarios admin, sitios admin, empresas) con opciones 10, 20, 50 y 100. Persiste en la URL como `?pageSize=` y resetea a página 1 al cambiar.
- **`src/lib/pagination.ts`** — helper `getPageSize()` con allow-list y `DEFAULT_PAGE_SIZE = 10`.
- **`src/components/ui/page-size-select.tsx`** — componente cliente con `useTransition`.
- **Defaults unificados** — antes cada listado tenía su propio `PAGE_SIZE` (20/25/30); ahora todos parten de 10.

### Empresas (`/admin/companies`)
- **Filtros y paginación** — búsqueda por nombre o NIT/RUC, filtros por tipo (agencia/empresa), estado (activa/inactiva) y agencia padre. Ordenamiento por columnas movido de cliente a servidor.
- **`src/components/admin/company-filters.tsx`** — selectores con el mismo estilo que `UserFilters`.
- **`CompanyTable`** ahora es presentacional puro.
- **Vista plana** — cada empresa es una fila independiente con su agencia padre en la columna "Agencia"; se removió la indentación jerárquica para que la paginación tenga sentido.

### Bóveda
- **Búsqueda funciona en todas las páginas** — antes solo filtraba la página visible; ahora la consulta se ejecuta en el servidor sobre `vaultEntry` con `?q=` en la URL y busca en título, usuario, URL, empresa, sitio, servicio y nombre del creador antes de paginar.
- **Filtros por empresa, servicio y creador**, y para no-admin un filtro de acceso ("Todas" / "Solo mías" / "Compartidas conmigo"). Combinables con la búsqueda por texto.
- **`src/components/vault/vault-filters.tsx`** — componente cliente con los selects.
- **Opciones acotadas al ámbito accesible** — los dropdowns solo listan entidades con al menos una entrada visible para el usuario actual.
- **Botón "Limpiar filtros"** — aparece cuando hay al menos un filtro activo (`access`, `companyId`, `serviceId`, `createdById`) y los borra todos a la vez, conservando búsqueda y `pageSize`.
- **`VaultList`** pasó a ser presentacional (sin `"use client"` ni estado interno).

### Proyectos
- **Vista de lista** — `/proyectos` ahora ofrece un toggle "Tarjetas / Lista" en la cabecera. La vista lista muestra una tabla compacta (Nombre, Empresa, Encargado, Estado, Tareas, Fecha límite) con cards condensadas en mobile. La **vista lista es la nueva default**; para volver a tarjetas se usa `?view=grid`.
- **`src/components/projects/project-view-toggle.tsx`** — toggle reusable que conserva el resto de query params.
- **Proyectos favoritos por usuario** — cada usuario puede marcar/desmarcar con una estrella en `/proyectos` (vista lista y tarjetas). Los favoritos aparecen primero en su listado, paginación incluida.
- **Quick access en dashboard** — nueva sección "Proyectos favoritos" sobre el grid principal con tarjetas compactas (nombre, empresa, conteo de tareas) cuando el usuario tiene al menos un favorito.
- **`prisma/schema.prisma`** — nuevo modelo `ProjectFavorite { projectId, userId, createdAt }` con backrefs en `Project.favorites` y `User.projectFavorites`.
- **Migración** `prisma/migrations/20260427150000_add_project_favorites/` — crea `project_favorites` con FK cascade (aplicada en RDS).
- **`toggleProjectFavorite(projectId)`** — server action idempotente que revalida `/proyectos` y `/dashboard`.
- **`src/components/projects/project-favorite-toggle.tsx`** — botón cliente con optimistic update y `stopPropagation` para no disparar el `Link` envolvente.
- **Paginación con favoritos primero** — `/proyectos` hace dos consultas (favoritos en orden, luego no-favoritos) y las concatena respetando `pageSize`/`offset`, manteniendo la paginación correcta a nivel global.

### Sidebar
- **Colapsable a modo "solo iconos"** — botón "Colapsar / Expandir" al pie del menú reduce el ancho de `w-60` a `w-16`, oculta etiquetas, submenús y el logo (cambia a una "G" compacta), y muestra el `title` en hover. Preferencia persistida en `localStorage` (`sidebar-collapsed`).
- **`DashboardShell`** maneja el estado `collapsed` y lo pasa al `Sidebar`. En mobile el modo se ignora y se mantiene el overlay completo.

### UI
- **Ancho completo en páginas de contenido** — eliminadas las restricciones `maxWidth: "1200px"` / `"1400px"` en `dashboard`, `admin/estadisticas`, `admin/servicios`, `admin/users/[id]`, `mis-servicios` y `proyectos/reportes`. El padding lo aporta el shell (`p-4 md:p-6`). Las páginas tipo formulario conservan sus anchos legibles.

### Corregido durante la sesión
- **Submenús desbordando el sidebar colapsado** — los `<ul>` y el botón chevron tenían `style={{ display: "flex" }}` inline, que sobrescribía `lg:hidden` por especificidad CSS. Movido a clases utilitarias para que la regla `lg:hidden` aplique correctamente.
- **Código de ticket no aparecía en el dashboard** — el widget "Tickets recientes" hacía un `select` explícito que omitía `prefix` y `number`. Se añadieron al `select` y se renderiza el badge antes del título.

---

## [1.12.0] — 2026-04-08

### Añadido
- **Loading skeletons** — se crearon `loading.tsx` para dashboard, tickets, proyectos, tareas, reportes y admin. Los usuarios ven un estado de carga en lugar de pantalla en blanco.
- **Error boundaries** — se crearon `error.tsx` para el dashboard global, detalle de ticket, detalle de proyecto y reportes. Los errores ahora muestran un mensaje amigable con opción de reintentar.
- **Paginación de comentarios** — los detalles de ticket y tarea cargan los últimos 50 comentarios inicialmente, con botón "Cargar comentarios anteriores" para ver el historial completo.
- **Server actions de paginación** — `getTicketComments()` y `getTaskComments()` para carga incremental de comentarios.
- **`maxDuration` en API routes** — cron overdue (30s) y timer pause-all (15s) para evitar timeouts en Netlify.

### Mejorado
- **Suspense en dashboard layout** — la alerta de items vencidos se carga de forma asíncrona sin bloquear el render del shell principal.
- **Queries limitadas** — se agregó `take` a todas las queries pesadas: reportes (100-200), layout overdue (50), comentarios (50), time entries (200), estadísticas (500), listado de tickets en reportes (500), cron overdue (50).
- **Batch de operaciones N+1** — los links y checklist items en tareas y tickets ahora usan `createMany()` en lugar de inserts secuenciales en loop.
- **Notificaciones cron en paralelo** — las notificaciones GChat de items vencidos se envían en batches de 5 en paralelo en vez de secuencialmente.
- **Cache en `getMentionableUsers()`** — resultado cacheado 60s con `unstable_cache` para evitar queries repetidas en cada keystroke de menciones.
- **Timeout en Gemini AI** — las llamadas a `callGemini()` ahora tienen timeout de 25s para evitar que una respuesta lenta consuma todo el budget de la función serverless.

---

## [1.11.0] — 2026-04-06

### Añadido
- **Email a clientes al ser mencionados** — cuando un usuario con rol `CLIENTE` es etiquetado con `@` en un comentario de ticket o tarea, recibe un email de notificación vía ZeptoMail con el nombre de quien lo mencionó, el título del ticket/tarea y un enlace directo al comentario.

### Corregido
- **URLs unificadas a `AUTH_URL`** — se reemplazó `NEXTAUTH_URL` por `AUTH_URL` en `ticket.actions.ts` y `gchat.ts` para que todas las URLs del proyecto usen la misma variable de entorno de producción.

---

## [1.10.1] — 2026-04-01

### Corregido
- **Gemini 401 en Netlify** — el SDK `@google/genai` detectaba el entorno Netlify y enrutaba las peticiones por el proxy `/.netlify/ai/`, causando `401 Unauthorized`. Se agrega `httpOptions.baseUrl` apuntando directamente a `https://generativelanguage.googleapis.com` en `ai.actions.ts` y `report.actions.ts` para evitar el proxy.

---

## [1.10.0] — 2026-04-01

### Añadido
- **Informes IA para proyectos** — botón "Informe IA del proyecto" en la vista de detalle de cada proyecto (visible solo para staff/admin). Genera un informe ejecutivo con Gemini que incluye: resumen, estado y % de avance, análisis del cronograma (fechas de inicio/vencimiento del proyecto y de cada tarea), desglose de tareas por estado y prioridad, y conclusiones. Opciones configurables antes de generar: checkbox para incluir nombres de encargados e instrucciones adicionales libres al agente IA. Exportable a PDF y DOCX como el resto de informes.
- **Webhook al revertir tarea a Pendiente** — `updateTaskStatus` envía notificación a GChat cuando una tarea vuelve al estado `PENDIENTE` desde cualquier otro estado (respeta la supresión de webhooks en proyectos privados).
- **Webhook al reabrir ticket** — `updateTicketStatus` envía notificación a GChat cuando un ticket vuelve al estado `ABIERTO` desde cualquier otro estado.

### Corregido
- **`Pagination` — advertencia de estilos en React** — reemplazado el shorthand `border` por `borderWidth`, `borderStyle` y `borderColor` en `btnBase` para evitar conflictos al hacer override de `borderColor` en la página activa.

---

## [1.9.0] — 2026-03-31

### Añadido
- **Emails transaccionales a clientes** — al asignar un ticket se envía un email notificando que está en proceso; al cerrarlo, un email de ticket cerrado. Ambos emails incluyen un enlace directo al ticket (`sendTicketAssignedEmail`, `sendTicketClosedEmail` en `src/lib/email.ts`).
- **Componente `MultiSelect`** — selector de opciones múltiples reutilizable (`src/components/ui/multi-select.tsx`).
- **Variables CSS para dropdowns** — `--dropdown-bg`, `--dropdown-border`, `--dropdown-text`, `--dropdown-hover-bg`, `--dropdown-danger-*`, `--dropdown-purple-*` en `globals.css` para dark y light mode.

### Mejorado
- **Menú kebab (⋮) en detalle de ticket** — Editar, Duplicar y Eliminar se agrupan en un menú desplegable con icono `MoreVertical`, cerrándose al hacer clic fuera.
- **Filtros con selección múltiple** — los filtros de estado, asignado a, creado por y empresa en tickets, tareas y proyectos ahora usan `MultiSelect` (se pueden seleccionar varios valores a la vez, separados por coma en la URL).
- **`DuplicateTicketButton` y `DuplicateTaskButton`** — aceptan `className` opcional para renderizarse como ítem de menú dropdown.

---

## [1.8.0] — 2026-03-28

### Añadido
- **Privacidad de proyectos en webhooks** — los proyectos marcados como Privado ya no generan notificaciones en ningún canal de Google Chat (creación/asignación/estado/fechas de tareas, comentarios en tareas, menciones, overdue). Las notificaciones in-app (base de datos) se siguen creando normalmente.
- `notify` y `notifyMany` en `src/lib/notify.ts` aceptan el nuevo parámetro opcional `skipGChat` para suprimir el envío al webhook sin afectar las notificaciones internas.
- El cron de tareas vencidas (`/api/cron/overdue`) filtra automáticamente las tareas que pertenecen a proyectos privados.

---

## [1.7.6] — 2026-03-27

### Mejorado
- **Adjuntos en formulario de ticket** — reemplazado el input nativo por el mismo patrón que el formulario de tareas: botón dashed "Seleccionar archivos", lista de archivos seleccionados por filas (con nombre, tamaño y botón de quitar), posibilidad de agregar archivos uno a uno.
- **Checklist en formulario de ticket** — unificado el estilo visual con el formulario de tareas (CSS variables, mismo diseño de filas e input).
- **Adjuntos y checklist movidos debajo de la descripción** — en ambos formularios (ticket y tarea) los campos de archivos adjuntos y checklist ahora aparecen inmediatamente después del campo de descripción.
- **Uploader de adjuntos en detalle de ticket** — mismo estilo y comportamiento que el de tareas: botón dashed, lista de archivos por filas antes de subir, botón "Subir" aparece solo cuando hay archivos pendientes.

---

## [1.7.5] — 2026-03-27

### Añadido
- **Checklist en formularios de creación** — al crear un ticket o tarea se pueden agregar ítems de checklist antes de guardar; se guardan en la BD junto al resto del registro.

---

## [1.7.4] — 2026-03-27

### Añadido
- **Checklists en tickets y tareas** — cada ticket y tarea tiene una sección de Checklist con barra de progreso. Cualquier usuario puede agregar ítems y marcarlos; los administradores pueden eliminarlos. Los cambios se reflejan de forma optimista (sin recargar la página).
- **Fix: filtro de menciones para clientes** — corregido el bug donde `getMentionableUsers` intentaba leer `companyId` directamente en User (relación M:N); ahora usa `companies.some`.

---

## [1.7.3] — 2026-03-27

### Añadido
- **Adjuntos de video en tickets y tareas** — se permiten archivos MP4, WebM, MOV y AVI además de los formatos de imagen ya existentes. El límite para video es de 100 MB (el resto mantiene 10 MB).
- **Múltiples archivos en el uploader del detalle de ticket** — el componente `AttachmentUploader` ahora admite selección y subida de varios archivos a la vez.

---

## [1.7.2] — 2026-03-27

### Añadido
- **Webhook de cambio de estado en tareas** — al pasar una tarea a *En progreso* o *En revisión* se envía una notificación al canal de Google Chat configurado en `gchat_webhook_tasks`. Se añadió el tipo de evento `task_status` (emoji 🔄) a la librería `gchat.ts`.

---

## [1.7.1] — 2026-03-25

### Corregido
- **Hydration crash React #418 en pastilla flotante de timer** — `useState(Date.now())` generaba un valor distinto en el servidor (SSR) y en el cliente, causando un mismatch de nodo de texto. Se inicializa el estado en `0` y se actualiza con el valor real en `useEffect` (solo lado cliente).

---

## [1.7.0] — 2026-03-26

### Añadido
- **Modal de elementos vencidos** — al iniciar sesión, si el usuario tiene tickets o tareas vencidos asignados, aparece un modal intrusivo listando cada elemento con su fecha de vencimiento y enlace directo. Los elementos en estado *En revisión* se muestran en ámbar diferenciado (no dependen del usuario para avanzar); los demás en rojo como acción urgente. Se muestra una vez por sesión de navegador.
- **Visibilidad de tickets por empresa (clientes)** — todos los usuarios CLIENTE de una misma empresa pueden ver y gestionar los tickets en los que esté asignado cualquier compañero de empresa, no solo los propios.
- **Webhook de vencidos a Google Chat** — nuevo endpoint `POST /api/cron/overdue` que consulta todos los tickets y tareas vencidos del sistema (excluyendo *En revisión* y estados finales), y envía un mensaje por elemento al canal de Google Chat correspondiente (`gchat_webhook_tickets` / `gchat_webhook_tasks`) indicando usuario asignado, fecha de vencimiento y prioridad. Protegido con `CRON_SECRET`.

---

## [1.6.0] — 2026-03-25

### Añadido
- **UI responsive (mobile-first)** — toda la interfaz adaptada a dispositivos móviles:
  - Sidebar con overlay en móvil (fixed + translate-x), estática en desktop (lg:).
  - Topbar con botón hamburguesa en móvil; nombre/rol y texto "Salir" ocultos en pantallas pequeñas.
  - Tablas de datos (tickets, tareas, usuarios, empresas, planes, sitios) reemplazadas por tarjetas apiladas en móvil (`md:hidden`) con tabla original en desktop (`hidden md:block`).
  - Filtros de tickets, tareas y proyectos en cuadrícula responsive (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-N`) con etiquetas sobre cada campo.
  - Formulario de ticket: fila Prioridad/Categoría en `grid-cols-1 sm:grid-cols-2`.
  - Headers de páginas con `flex-wrap` y texto de botones abreviado en móvil.
  - Dashboard con grids KPI y secciones adaptados a `sm:` / `lg:` / `xl:`.
- **Alertas de planes en panel de cliente** — `/mis-planes` muestra banners de alerta para planes vencidos (rojo), bolsas de horas agotadas (naranja) y planes próximos a vencer en ≤ 30 días (ámbar), con los días restantes.
- **Alertas de planes en dashboard admin** — nueva tarjeta "Planes vencidos / por vencer" visible solo para administradores.
- **Duplicar tareas** — botón "Duplicar" en el detalle de tarea (staff). Crea una copia con estado Pendiente, sin fechas, conservando título, descripción, prioridad, categoría, asignado y horas estimadas.
- **Duplicar tickets** — botón "Duplicar" en el detalle de ticket (admin). Crea una copia con estado Por asignar, conservando título, descripción, prioridad, categoría, asignado, cliente, plan y sitio.
- **Sugeridor de contraseñas seguras** — en la creación de usuarios, botón "Sugerir contraseña segura" que genera una contraseña de 16 caracteres con `crypto.getRandomValues`. Incluye toggle de visibilidad y botón copiar al portapapeles.

### Mejorado
- **Pills de menciones en comentarios** — colores más suaves en modo claro (`bg-pink-100 text-pink-700`) y modo oscuro (`bg-pink-500/10 text-pink-300`) para reducir fatiga visual.

---

## [1.5.0] — 2026-03-17

### Añadido
- **Tareas por vencer en dashboard** — nueva sección que muestra tareas que vencen hoy o mañana, con etiqueta "Hoy" / "Mañana" y fondo ámbar diferenciado.
- **Stat "Por vencer" en KPI de tareas** — el card de tareas en el dashboard incluye ahora el conteo de tareas próximas a vencer.
- **Stat "En revisión" en KPI de tareas y tickets** — las tareas y tickets en estado EN_REVISION tienen su propio contador en los cards del dashboard.
- **"En revisión" en estadísticas globales** — la página de estadísticas de productividad incluye una tarjeta y columna de tabla dedicada a tareas en revisión.

### Corregido
- **Tareas EN_REVISION excluidas de "vencidas"** — las tareas en revisión ya no se contabilizan como vencidas en el dashboard ni en estadísticas.
- **Falsos positivos de vencimiento por zona horaria** — la comparación de fechas ahora usa UTC midnight de la fecha local del servidor, evitando que tareas del día siguiente aparezcan como vencidas.

---

## [1.4.3] — 2026-03-17

### Añadido
- **Mover tareas entre proyectos** — los administradores pueden mover una tarea a otro proyecto activo directamente desde el detalle de la tarea. El botón "Mover" despliega un selector de proyecto destino; al confirmar, la tarea se reasigna y se redirige automáticamente a su nueva URL.

---

## [1.4.2] — 2026-03-17

### Mejorado
- **Notificación `task_new`** — el mensaje incluye ahora el nombre del asignado y la fecha de vencimiento cuando están disponibles.
- **Notificación `ticket_new`** — el mensaje incluye el nombre del asignado cuando está disponible. Además, ahora también se envía cuando un miembro del staff crea un ticket (antes solo se disparaba al crearlo un cliente).

---

## [1.4.1] — 2026-03-17

### Corregido
- **Notificación webhook al crear tarea** — al crear una tarea se envía ahora una notificación al canal de Google Chat configurado para tareas (`gchat_webhook_tasks`), con el tipo de evento `task_new`.

---

## [1.4.0] — 2026-03-17

### Añadido
- **Reacciones en comentarios** — 👍 Like, 🧞 Genio, 👎 Dislike, 👀 Revisando en tickets y tareas. Toggle por usuario, contador visible.
- **Informes ejecutivos con IA** — botón "Generar informe" en detalle de tarea y ticket usando Gemini 2.5 Flash. Vista previa con scroll propio, texto suavizado para modo oscuro.
- **Exportar informe a PDF y DOCX** — descarga directa desde el navegador con `jsPDF` y `docx`.
- **Layout de dos columnas** — en pantallas grandes (≥ 1024 px) el detalle de tarea y ticket divide contenido principal (izquierda) y herramientas IA + comentarios (derecha) al 50/50.
- **Integraciones Google Chat** — envío de notificaciones a canales distintos según tipo de evento mediante webhooks entrantes.
  - Canal **Tickets**: ticket nuevo, ticket asignado, cambio de estado, cambio de fecha límite.
  - Canal **Tareas**: tarea asignada, tarea completada, cambio de fechas inicio/límite.
  - Canal **Comentarios**: comentario en ticket o tarea.
  - Canal **Menciones**: mención con `@` en comentarios.
- **Vista `/admin/integraciones`** — gestión de webhooks de Google Chat desde la UI con instrucciones paso a paso.
- **Notificación ticket nuevo** — se notifica a administradores cuando un cliente abre un ticket.
- **Notificación tarea completada** — se notifica al creador y asignado cuando una tarea pasa a "Completado".
- **Notificación cambio de fechas** — se notifica cuando cambia la fecha de inicio o límite en tareas y tickets.
- **Página de Novedades** — historial visual de versiones accesible desde el sidebar para todos los roles.
- **Nueva página `/tareas/new`** — crear tareas desde la vista global con selector de proyecto.

### Corregido
- **Desfase de zona horaria en fechas límite** — las fechas `date-only` ahora se muestran con `formatDate` (UTC) evitando que "1 de abril" apareciera como "31 de marzo".

---

## [1.3.0] — 2026-03-12

### Añadido
- Edición y eliminación de adjuntos al editar una tarea.
- Menciones con `@` en comentarios de tickets y tareas.
- Edición y borrado de comentarios propios.
- Sistema de notificaciones en la app (campana en topbar con contador).
- Paginación en listados de tickets.

### Corregido
- Guardado de descripción en tareas.
- Reordenamiento de adjuntos.
- Visualización de fechas en tareas.

---

## [1.2.0] — 2026-03-11

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

## [1.1.0] — 2026-03-10

### Añadido
- **Proyectos y tareas** — módulo completo con Kanban, calendario, lista y detalle.
- **Contador de tiempo** en tareas.
- **Asistente IA en tickets** con Gemini 2.5 Flash (diagnóstico, panel colapsable y modal).
- **Sitios y apps** vinculados a tickets con contexto de documentación y arquitectura.
- Borrado de tickets, tareas, proyectos, usuarios, empresas y planes (solo admin).
- Modo claro / oscuro y cambio de contraseña desde el perfil.
- Vista Kanban de tickets.

### Corregido
- Sesión y logout para NextAuth v5 (cookies `authjs.*`).
- Migración a AWS RDS.

---

## [1.0.0] — 2026-03-09

### Añadido
- **Primera versión funcional** — tickets, planes, usuarios, empresas, autenticación con NextAuth v5, middleware de roles (ADMINISTRADOR, COLABORADOR, CLIENTE).
- Deploy inicial en producción.
