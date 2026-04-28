# Changelog — Geniorama Tickets

Todas las entregas notables de este proyecto. Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionado semántico: `MAJOR.MINOR.PATCH` — funciones nuevas incrementan MINOR, correcciones incrementan PATCH.

---

## [Unreleased]

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
