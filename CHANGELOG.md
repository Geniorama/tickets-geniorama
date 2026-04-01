# Changelog — Geniorama Tickets

Todas las entregas notables de este proyecto. Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionado semántico: `MAJOR.MINOR.PATCH` — funciones nuevas incrementan MINOR, correcciones incrementan PATCH.

---

## [Unreleased]

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
