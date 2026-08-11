# Changelog — Geniorama Tickets

Todas las entregas notables de este proyecto. Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionado semántico: `MAJOR.MINOR.PATCH` — funciones nuevas incrementan MINOR, correcciones incrementan PATCH.

---

## [Unreleased]

---

## [1.46.0] — 2026-08-11

### Fase 0, paso 4: registros de tiempo polimórficos

El paso con más superficie hasta ahora, porque el cronómetro toca facturación.

- **Un solo modelo.** `TimeEntry` (tickets) y `TaskTimeEntry` (tareas) se unifican en `TimeEntry`, con toda la lógica en `src/lib/time-entries.ts`. Los dos archivos de acciones quedan como envoltorios de permisos y revalidación.
- **Renombrado de tabla.** A diferencia de los pasos anteriores, el nombre destino ya estaba ocupado: la tabla vieja de tickets se llamaba `time_entries`. Pasa a `ticket_time_entries` —simétrica con `task_time_entries`— y el nombre limpio queda para la compartida. Incluye renombrar el índice de la clave primaria: en PostgreSQL los nombres de índice son únicos por esquema, así que sin eso la tabla nueva chocaría al crearse.
- **El contador flotante** hacía dos consultas (una por tipo) para encontrar el cronómetro en marcha; ahora es una, con el título de la entidad resuelto aparte. Lo mismo `/api/timer/pause-all`, que pasa de dos `updateMany` a uno.
- **Los listados de tiempo** (informes de tarea y de ticket, página de reportes) se resuelven con `listTimeEntries` y `elapsedMsByEntity`, este último por lotes para no convertir un `include` en una consulta por ticket.
- El arranque y parada automáticos al cambiar de estado —en `updateTaskStatus`, en el cierre de ticket y en el asistente IA— pasan también por el núcleo.

#### Facturación: `getPlanUsedHours`

Calculaba el consumo con un filtro anidado (`where: { ticket: { planId } }`) sobre la relación directa. Sin ella, resuelve primero los tickets del plan y luego suma sus entradas cerradas. Se verificó la **equivalencia exacta en los 20 planes con tiempo registrado** en producción antes de desplegar: mismas horas hasta el cuarto decimal. Las entradas abiertas siguen sin contar como tiempo consumido.

#### 🔒 Permisos

Las acciones del cronómetro comprobaban el rol pero no el acceso a la entidad: bastaba con ser staff y adivinar un `ticketId` o `taskId` para cronometrar, editar o borrar tiempo sobre cualquiera. Ahora usan `canAccessTicket()` y `canInteractWithTask()`, y el borrado de una entrada va acotado por entidad.

#### Migración `20260811180000_add_shared_time_entry_kernel` (con datos)

- Renombra la tabla vieja, crea la compartida y copia los 682 registros conservando ids y el estado abierto/cerrado.
- Las tablas viejas no se eliminan.
- Verificada en base desechable, incluido el renombrado; `prisma migrate diff` no detecta diferencias.

---

## [1.45.0] — 2026-08-11

### Fase 0, paso 3: checklists polimórficos

- **Un solo modelo.** `TicketChecklist` / `TaskChecklist` y sus ítems se unifican en `Checklist` y `ChecklistItem`. `checklist.actions.ts` pasa de 408 líneas con dieciséis funciones (ocho duplicadas) a envoltorios finos sobre el nuevo `src/lib/checklists.ts`.
- Los ítems **conservan clave foránea real** hacia su checklist, así que la cascada entre ambos sigue existiendo. Solo se pierde el vínculo automático con el ticket o la tarea, cubierto con `deleteChecklistsFor()` en `deleteTicket`, `deleteTask` y `deleteProject`.
- La creación desde plantillas (plantilla de tarea, tarea recurrente y el cron que las genera) y el asistente IA pasan también por el núcleo compartido.

#### 🔒 Las acciones de checklist de ticket no comprobaban acceso

Solo exigían sesión iniciada. **Cualquier usuario autenticado que adivinara un `ticketId` podía añadir, renombrar, marcar o borrar ítems del checklist de cualquier ticket**, incluido el de otra empresa. Las de tarea sí estaban restringidas al staff.

Se añade `src/lib/ticket-access.ts` con `canAccessTicket()`, que extrae la regla que ya aplicaba la página de detalle (borrador solo para su creador; staff todo; cliente solo lo suyo o lo de su empresa) para poder usarla también en las Server Actions. Las de tarea ahora verifican además acceso a la tarea, no solo el rol.

#### 🐛 Corrige lecturas obsoletas introducidas en 1.43.0

Al migrar los comentarios se pasaron por alto cinco consultas que los leían por la relación vieja de `Ticket`/`Task`. Como esas tablas quedaron congeladas, **desde el 11 de agosto mostraban solo comentarios anteriores a la migración**:

- **Informes de tarea y de ticket** (`report.actions.ts`) — el historial de comentarios que va al informe generado, visible para el cliente.
- **Resumen IA del ticket** (`ai.actions.ts`).
- **Contexto del asistente** (`assistant.actions.ts`), tanto en tareas como en tickets, más el conteo de ítems de checklist.

Se añaden `recentCommentsByEntity()` y `checklistItemCountsByEntity()` para resolver por lotes lo que antes hacía el `include`, sin caer en una consulta por entidad.

#### Migración `20260811160000_add_shared_checklist_kernel` (con datos)

- Copia los 43 checklists y 254 ítems conservando ids, títulos, posiciones y estado de marcado.
- Las tablas viejas no se eliminan.
- Verificada en base desechable; `prisma migrate diff` no detecta diferencias.

---

## [1.44.0] — 2026-08-11

### Fase 0, paso 2: adjuntos polimórficos

Continuación del núcleo compartido. Sin cambios visibles: los adjuntos de tickets, tareas y proyectos se ven y se comportan igual.

- **Un solo modelo de adjunto.** `TicketAttachment`, `TaskAttachment` y `ProjectAttachment` se unifican en `Attachment`, identificado por `entityType` + `entityId`.
- **Se normalizan tres convenciones distintas** para distinguir un enlace de un archivo, que era la causa de que cada módulo tuviera su propia lógica: los tickets no tenían enlaces, los proyectos usaban la columna `type`, y **las tareas marcaban el enlace con el centinela `storagePath = "link"`**. Ahora manda `type` y `storagePath` es `null` en los enlaces.
- **Nuevo `src/lib/attachments.ts`**: `listAttachments`, `addFileAttachments`, `addLinkAttachments`, `deleteAttachment`, `reorderAttachments` y `deleteAttachmentsFor`. Sustituye a cinco bloques de subida repartidos entre `attachment.actions.ts`, `project-attachment.actions.ts`, `ticket.actions.ts` y `task.actions.ts` (dos en este último).
- **`position` para todos.** Solo los proyectos tenían orden manual. Tickets y tareas reciben su posición a partir del orden de visualización actual, así que el orden no cambia pero queda la base para reordenarlos.

#### Endurecimiento de permisos

Tres acciones aceptaban un id de adjunto sin comprobar a qué entidad pertenecía. Ahora todas van acotadas:

- `reorderProjectAttachments` no verificaba nada: un id de otro proyecto colado en la petición alteraba su orden. El `updateMany` va acotado por `entityType` + `entityId`.
- El borrado de adjuntos al editar una tarea (`deletedAttachmentIds`) no comprobaba que el adjunto fuera de esa tarea.
- `deleteAttachment` de ticket tampoco lo comprobaba.

#### ⚠️ Borrado en cascada, igual que con los comentarios

`deleteAttachmentsFor()` se añadió a `deleteTicket`, `deleteTask` y `deleteProject`, en la misma transacción que ya limpiaba los comentarios. Se borran **solo los registros**: los objetos en R2 se quedan, que es exactamente lo que ocurría antes cuando la cascada de la base eliminaba las filas.

#### Migración `20260811100000_add_shared_attachment_kernel` (con datos)

- Copia los 355 adjuntos conservando los ids, traduce el centinela de tareas a `type='link'` con `storagePath` nulo y genera `position` por orden de creación.
- Los prefijos en R2 no cambian (incluido el heredado `tickets/projects/…` de los archivos de proyecto), así que las URLs existentes siguen resolviendo.
- **Las tablas viejas no se eliminan**, igual que en 1.43.0.
- Verificada en base desechable con las tres convenciones representadas; `prisma migrate diff` no detecta diferencias.

---

## [1.43.0] — 2026-08-10

### Fase 0 del núcleo compartido: comentarios polimórficos

Primer paso para convertir la app en una plataforma de módulos. Sin cambios visibles para el usuario: el hilo de comentarios, los adjuntos, las reacciones y las menciones funcionan igual. Lo que cambia es que dejan de estar duplicados por entidad.

- **Un solo modelo de comentario.** `TicketComment` + `TaskComment` (y sus adjuntos y reacciones — seis modelos) se unifican en `Comment`, `CommentAttachment` y `CommentReaction`, identificados por `entityType` + `entityId`. Nuevo enum `EntityType` (`TICKET`, `TASK`, `PROJECT`): agregar comentarios a una app futura es añadir un valor, no seis modelos.
- **Nuevo `src/lib/comments.ts`** con la implementación compartida: `listComments`, `countCommentsByEntity`, `withCommentCounts`, `deleteCommentsFor`, `findEditableComment` y la extracción de menciones, que antes estaba copiada en dos archivos de acciones.
- **`uploadCommentFile` se movió a `src/lib/s3.ts`.** `task-comment.actions.ts` tenía su propio cliente S3 y su propia subida a R2, duplicando lo que ya hacía `lib/s3.ts`. Las rutas en R2 no cambian, así que los archivos existentes siguen resolviendo.
- **Los `_count.comments` de tarea** ya no vienen por relación (la tabla es compartida): se calculan con `withCommentCounts` en el listado de tareas, el detalle de proyecto y el detalle de usuario. Los componentes reciben la misma forma `_count: { comments }` que antes.
- **`src/lib/task-access.ts` reescrito.** El acceso del cliente a una tarea depende de que lo mencionen en un comentario, y se resolvía con un filtro anidado `comments: { some: ... }` sobre la relación de `Task`, que ya no existe. Ahora el alcance (no borrador + proyecto de su empresa) se evalúa primero y la mención después, contra la tabla compartida. `canClientAccessTask` pasa a delegar en la versión por lotes, así que hay una sola implementación de la regla.

#### ⚠️ Borrado en cascada: ahora es responsabilidad del código

Al no haber clave foránea sobre `entityId`, **la base de datos ya no borra los comentarios de un ticket o tarea eliminados**. Se añadió `deleteCommentsFor()` dentro de una transacción en `deleteTicket`, `deleteTask` y `deleteProject` (este último recoge los ids de las tareas *antes* de que caigan en cascada, o quedarían inidentificables). Cualquier camino nuevo que borre una entidad comentable debe llamarlo.

#### Migración `20260810120000_add_shared_comment_kernel` (con datos)

- Crea las tres tablas y **copia los comentarios, adjuntos y reacciones existentes conservando los ids originales**, de modo que las relaciones se mantienen.
- **Las tablas viejas no se eliminan.** `ticket_comments`, `task_comments` y las cuatro asociadas quedan intactas, sin uso, hasta verificar la lectura nueva en producción. El `DROP` va en una migración posterior.
- ⚠️ Sigue vigente el aviso de 1.42.1: `migrate deploy` aplica **todas** las migraciones pendientes y la carpeta está desfasada. Verificar con `select migration_name from _prisma_migrations;` y marcar las faltantes con `prisma migrate resolve --applied <folder>` **antes** de desplegar, o el job se cortará.
- Verificada en una base desechable: los conteos de las seis tablas coinciden con los de las tres nuevas, `is_internal` y los adjuntos inline heredados se preservan, no quedan huérfanos, y `prisma migrate diff` no detecta diferencias entre el SQL escrito a mano y el esquema.

---

## [1.42.1] — 2026-08-06

### El deploy aplica las migraciones de base de datos
- El workflow de GitHub Actions ahora corre `prisma migrate deploy` **después del build y antes de subir el bundle**: si una migración falla, el job se corta y no se despliega código que la base no soporta. Antes el deploy solo compilaba, copiaba y reiniciaba PM2, así que cada cambio de esquema había que aplicarlo a mano.
- Corre en el runner, no en el servidor, porque el bundle standalone no incluye la carpeta `prisma/`.
- ⚠️ `migrate deploy` aplica **todas** las migraciones pendientes. La carpeta `prisma/migrations` está desfasada (varias tablas se crearon con `db push` y no tienen migración), así que si alguno de esos folders no está registrado en `_prisma_migrations` el deploy fallará al intentar recrear tablas existentes. Verificar con `select migration_name from _prisma_migrations;` y marcar los faltantes con `prisma migrate resolve --applied <folder>`.

---

## [1.42.0] — 2026-08-06

### Varios checklists con título por ticket y por tarea
- Un ticket o una tarea ahora puede tener **varios checklists**, cada uno con su **título editable** (clic sobre el nombre para renombrarlo). Antes solo existía una lista plana.
- Los checklists se **reordenan arrastrando** por su cabecera, y un **ítem se puede mover de un checklist a otro** arrastrándolo.
- La cabecera del panel muestra el **avance global** (todos los ítems de todos los checklists) y cada checklist muestra el suyo.
- Los **formularios de creación** (nuevo ticket, nueva tarea) y las **plantillas** (ticket, tarea y recurrente) también permiten definir varios checklists con título, que se crean tal cual al generar el ticket/tarea.
- **Modelo de datos:** nuevos modelos `TicketChecklist` y `TaskChecklist`; los ítems pasan a colgar del checklist (`checklist_id`) en vez del ticket/tarea. El campo `checklist` de las tres plantillas pasa de `String[]` a `Json` con la forma `[{ title, items: [] }]`.
- **Migración `20260806120000_add_checklist_groups` (con datos).** Los ítems y las plantillas que ya existían se agrupan en un checklist llamado **«Checklist»**, conservando su orden. ⚠️ No aplicar con `prisma db push`: hay que ejecutar el SQL de la migración, que preserva los datos.
- Acciones nuevas: `addTicketChecklist`, `renameTicketChecklist`, `deleteTicketChecklist`, `reorderTicketChecklists` y sus equivalentes de tarea. El reordenamiento viaja como un único *layout* (checklists + ítems), así que una sola acción cubre reordenar listas, reordenar ítems y moverlos entre listas. Las acciones de ítem ahora **validan que el ítem pertenezca al ticket/tarea**.
- Nuevos helpers `src/lib/checklist.ts` (normalización del JSON de plantillas, tolerante al formato antiguo) y `src/lib/checklist-dnd.ts` (lógica de arrastre compartida entre el panel y el editor en borrador).
- El **asistente IA** y el **planificador** siguen agregando ítems: van al primer checklist de la tarea, y lo crean si no hay ninguno.

---

## [1.41.0] — 2026-08-06

### Los ítems del checklist se editan, se reordenan arrastrando y van numerados
- **Numeración:** cada ítem muestra su número de orden (`1.`, `2.`, `3.`…), tanto en el checklist de tickets y tareas como en los que se arman al crear un ticket/tarea o una plantilla.
- **Edición en línea:** clic sobre el texto de un ítem lo convierte en campo editable. **Enter** o salir del campo guarda; **Escape** cancela. Antes el título solo se podía fijar al crear el ítem: para corregir una errata había que borrarlo y volverlo a escribir.
- **Reordenar arrastrando:** cada ítem tiene una manija (aparece al pasar el mouse en el detalle) para moverlo a otra posición. El nuevo orden se guarda de inmediato y de forma optimista, con el mismo patrón que ya usaban los adjuntos de proyecto.
- El reordenamiento **reescribe `position` de 0 en adelante**, así que también cierra los huecos que dejaban los ítems eliminados.
- **Alcance:** aplica al checklist del **detalle de ticket** y del **detalle de tarea**, y a los checklists en borrador de **nuevo ticket**, **nueva tarea**, **plantillas de ticket**, **plantillas de tarea** y **tareas recurrentes**.
- **Permisos sin cambios:** editar, eliminar y reordenar siguen la misma regla que ya tenía eliminar (admin en tickets, staff en tareas). Los clientes con acceso a una tarea la siguen viendo en **solo lectura**: ven la numeración, no la manija ni la edición.
- Nuevas acciones `updateTicketChecklistItem`, `reorderTicketChecklistItems`, `updateTaskChecklistItem` y `reorderTaskChecklistItems`; las de reordenar ignoran ids que no pertenezcan al ticket/tarea. Nuevo componente compartido `src/components/ui/draft-checklist.tsx`, que reemplaza las cinco copias del checklist en borrador de los formularios. **Sin migración de base de datos.**

---

## [1.40.0] — 2026-08-05

### Los clientes acceden al detalle de las tareas donde los involucran
- Un **cliente** ahora puede abrir el **detalle de una tarea** cuando el staff lo involucró de forma deliberada: lo **mencionó en un comentario** (`@[Nombre](id)`) o lo puso como **revisor** de la tarea.
- Se exige además que la tarea pertenezca a un **proyecto de su empresa**, para que una mención accidental en el proyecto de otro cliente no filtre nada. Un **proyecto privado no bloquea**: la mención pesa más, pero el acceso se limita a esa tarea y no al proyecto.
- Cierra un flujo que ya estaba a medias: las **notificaciones y correos de mención** a clientes y el aviso **«Pendiente de tu revisión»** a los revisores ya enlazaban al detalle de la tarea, pero la página los expulsaba. Ahora el enlace funciona.
- En el **listado de tareas del proyecto** (vista de cliente), las tareas accesibles vuelven a ser **enlaces**; el resto sigue como texto plano.
- **Qué puede hacer el cliente:** leer la tarea y **comentar y reaccionar** (con menciones y adjuntos). No ve el temporizador ni los registros de tiempo, no cambia el estado, no edita/mueve/elimina, ve el **checklist en solo lectura** y no ve la sección **«Configuración del proyecto»** (bóveda y adjuntos del proyecto).
- **Endurecimiento de permisos:** `addTaskComment`, `getTaskComments` y `toggleTaskCommentReaction` exigían solo estar autenticado — ahora validan acceso a la tarea. Las cuatro acciones de **checklist de tarea** quedan restringidas al staff.
- **Corrección:** las notificaciones y correos de comentarios en tareas **sin proyecto** generaban un enlace roto (`/proyectos/null/tareas/…`); ahora apuntan a `/tareas/[id]`.
- Nuevo helper `src/lib/task-access.ts` (`canClientAccessTask`, `getClientAccessibleTaskIds`, `canInteractWithTask`). **Sin migración de base de datos.**

---

## [1.39.0] — 2026-07-09

### Los clientes ven las tareas de los proyectos de su empresa
- En el detalle de un proyecto, los **clientes** ahora ven el **listado de tareas con su estado** (antes la sección de tareas estaba oculta para clientes).
- Es una lista de **solo lectura**: sin botón «Nueva tarea», sin cambio de vista (Kanban/Calendario) y sin enlaces al detalle de cada tarea (el detalle de tarea sigue siendo de uso interno). El staff conserva la experiencia completa.
- `TaskList` gana una prop `readOnly` que renderiza las filas como texto en vez de enlaces.

## [1.38.0] — 2026-07-09

### Foto de perfil + página de perfil a ancho completo
- **Foto de perfil para todos los usuarios** (staff y clientes): cada usuario puede subir, cambiar y quitar su foto desde `/perfil`. Se sube a R2 (JPG, PNG, WebP o GIF · máx. 5 MB); la foto anterior se borra automáticamente.
- La foto aparece en la **barra superior** (reemplaza el ícono genérico) y en las **tarjetas de agendamiento** (`/agendar` y las embebidas en proyecto/ticket). Si no hay foto, se muestra la inicial del nombre o un ícono.
- **`/perfil` rediseñado a ancho completo:** cabecera con avatar + identidad; en staff, «Perfil público» (designaciones + biografía) y «Cambiar contraseña» en dos columnas, y los links de agendamiento a todo el ancho. Antes todo estaba comprimido en una columna angosta.
- **Creación de tickets y tareas a ancho completo:** los formularios de «Nuevo ticket» y «Nueva tarea» (global y dentro de un proyecto) ahora aprovechan todo el ancho del contenedor (antes limitados a ~42 rem y 64 rem).
- **Modelo de datos:** `User` gana `avatar_url` y `avatar_storage_path`. Nuevo helper `validateAvatar`/`uploadAvatar` en `src/lib/s3.ts` y acciones `updateMyAvatar`/`removeMyAvatar` en `src/actions/profile.actions.ts`. Migración `20260709140000_add_user_avatar` (aditiva).

---

## [1.37.0] — 2026-07-09

### Colaboradores agendables por clientes (Gestor de proyectos / Agente de soporte)
- Los usuarios staff pueden designarse como **Gestor de proyectos** y/o **Agente de soporte** (marcas independientes). Los designados son visibles para los clientes.
- Cada colaborador puede tener **links de agendamiento de llamadas** (Google Calendar, Calendly, etc.), cada uno con **título**, **descripción** opcional y **URL**. El agendamiento ocurre directamente en el link externo.
- Los links se dividen por **categoría**: **Proyectos** (tareas) o **Soporte** (tickets).
- Cada colaborador puede incluir una **Biografía** visible para los clientes.
- **Gestión doble:** el administrador edita designaciones, biografía y links en `/admin/users/[id]/edit`; además cada colaborador edita su propia biografía y links desde su perfil (`/perfil`, ahora editable para staff).
- **Acceso al perfil:** en la barra superior, el avatar y el nombre del usuario ahora son un enlace a «Mi perfil» (antes el acceso era un ícono de llave poco descubrible); el avatar es visible y clicable también en móvil.
- **Visibilidad para clientes en dos lugares:**
  - Nueva página **«Agendar»** (`/agendar`, en el menú de todos los roles) con dos secciones: *Gestión de proyectos* y *Soporte*, cada una con las tarjetas de los colaboradores (bio + links).
  - Tarjetas **integradas**: en el detalle de proyecto aparece el gestor del proyecto (links de Proyectos) y en el detalle de ticket, el agente asignado (links de Soporte). Solo se muestran si el usuario está designado y tiene bio o links.
- **Soporte con paquete activo:** para los clientes, el agendamiento de **Soporte** (la sección en `/agendar` y la tarjeta del agente en el detalle de ticket) solo está disponible si tienen un **plan/paquete activo**; si no, se muestra un aviso. El staff no tiene esta restricción, y el agendamiento de Proyectos sigue disponible sin plan.
- **Modelo de datos:** `User` gana `bio`, `is_project_manager`, `is_support_agent`; nueva tabla `scheduling_links` (título, descripción, url, categoría, posición) y enum `SchedulingLinkCategory {PROYECTOS, SOPORTE}`. Migración `20260709120000_add_collaborator_scheduling` (aditiva).

---

## [1.36.0] — 2026-07-09

### Tiempo estimado de tareas en horas + minutos
- El **tiempo estimado** de las tareas ahora se ingresa con dos campos: **horas** y **minutos** (p. ej. `2h 30m`), en lugar de un único campo de horas decimales.
- Internamente se sigue guardando como horas decimales (`estimatedHours`, `Float`), por lo que **no requiere migración** de base de datos ni afecta los datos existentes.
- Aplica a los tres formularios que usan tiempo estimado: **nueva/editar tarea** (`task-form`), **plantilla de tarea** (`task-template-form`) y **tarea recurrente** (`recurring-task-form`).
- Nuevo helper `src/lib/estimated-time.ts` con `splitEstimatedHours` (dividir en horas/minutos), `combineEstimatedTime` (combinar a horas decimales) y `formatEstimatedTime` (mostrar como `2h 30m`).
- La lectura del valor ahora se muestra con el formato `Xh Ym` en el detalle de la tarea, los reportes de proyecto y el contexto del asistente.
- Las **tablas de tareas** (`task-list`) muestran una nueva columna **Estimado** (con el formato `Xh Ym`), tanto en la vista de escritorio como en las tarjetas mobile.
- En la lista global de tareas (`/tareas`) la columna **Estimado** es **ordenable**: al ordenar, las tareas sin estimación quedan al final (`nulls: "last"`).
- Los tickets **no** cambian: siguen sin campo de tiempo estimado.

---

## [1.35.1] — 2026-07-08

### Fix: clientes no podían crear tickets con archivos grandes
- Los clientes recibían un error al crear tickets al adjuntar archivos: el request se cortaba con `Error: Unexpected end of form`.
- **Causa:** el request de `/tickets/new` pasa por el middleware de NextAuth, que trunca el body a **10 MB** por defecto (`middlewareClientMaxBodySize`) antes de que llegue al Server Action. Como `validateFile` permite video hasta 100 MB e imágenes/docs hasta 10 MB, cualquier adjunto que superara los 10 MB rompía el multipart.
- **Fix:** en `next.config.ts` se alinean los límites con lo que la app ya permite — `experimental.middlewareClientMaxBodySize` y `serverActions.bodySizeLimit` se suben a **110 MB** (100 MB del video más overhead del multipart y campos del formulario).

---

## [1.35.0] — 2026-07-07

### Correo al cliente en cada cambio de estado del ticket
- Ahora, cada vez que un ticket **cambia de estado**, se envía un **correo al cliente** asociado avisándole del nuevo estado (Por asignar, Abierto, En progreso, En revisión, Cerrado).
- Nueva plantilla `sendTicketStatusChangedEmail` en `src/lib/email.ts` (estilo consistente con los demás correos, badge con el estado).
- Cableado en las tres acciones que modifican el estado: `updateTicketStatus`, `updateTicket` y `configureTicket`. El correo solo se envía cuando el estado **realmente cambia** y el ticket tiene cliente.
- El estado **Cerrado** conserva su plantilla dedicada (`sendTicketClosedEmail`); en `configureTicket` se evita duplicar el correo cuando el cambio coincide con el de asignación (`sendTicketAssignedEmail`).
- Envío *fire-and-forget* (`.catch(console.error)`): un fallo de correo no interrumpe la actualización del ticket.

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
