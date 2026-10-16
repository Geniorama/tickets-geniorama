# Hooks y API — integrar Geniorama desde fuera

Guía operativa de las dos piezas que sustituyen al agente de WhatsApp
(disponibles desde la v1.66.0).

## Por qué

Hasta la v1.65.0 el bot de WhatsApp vivía dentro de la aplicación: su prompt, su
memoria de conversación, sus permisos y su forma de crear tickets eran código de
este repositorio. Funcionaba, pero cada canal nuevo —Slack, Telegram, un CRM—
significaba construir otro agente aquí dentro, y cambiar cualquier detalle del
bot obligaba a desplegar la plataforma entera.

Ahora la plataforma hace solo dos cosas y las hace bien:

- **Cuenta lo que pasa** por *hooks* salientes (`ticket.created`,
  `task.status_changed`, …).
- **Deja escribir** por una API REST con llaves (`/api/v1`).

Con eso, WhatsApp se rehace fuera —en n8n, en Make, en un servicio propio— y la
plataforma no se entera de que existe.

---

## 1. Hooks (salida)

### Alcances

| Alcance | Dónde se configura | Qué recibe |
|---|---|---|
| **Organización** | Administración → Integraciones del equipo | Todo: tickets, tareas, proyectos y comentarios |
| **Proyecto** | Ficha del proyecto → Hooks | Solo lo de ese proyecto (tareas, comentarios, el proyecto mismo) |

Dos reglas que conviene tener claras:

- **Los tickets no llegan a un hook de proyecto.** Un ticket es soporte: cuelga
  de un plan y de un sitio, no de un proyecto. Por eso su selector de eventos no
  los ofrece.
- **Los proyectos privados no salen al alcance de organización.** Sus eventos
  llegan únicamente a los hooks de ese proyecto. Es el mismo criterio que ya
  aplicaba el canal de equipo en Google Chat.

### Catálogo de eventos

```
ticket.created            ticket.updated         ticket.status_changed
ticket.assigned           ticket.deleted

task.created              task.updated           task.status_changed
task.assigned             task.completed         task.deleted

project.created           project.updated        project.status_changed
project.deleted

comment.created
```

También se puede consultar en vivo: `GET /api/v1/events`.

Notas:

- Los **borradores** no disparan nada. Un ticket o una tarea en borrador es
  privado de su autor; el evento `*.created` sale cuando se publica.
- `task.completed` llega **además** de `task.status_changed`. Está duplicado a
  propósito: es el disparador más pedido y no debería obligar a leer `changes`.
- Las **notas internas** no generan `comment.created`. Si un cliente no las ve
  en el hilo, tampoco deben aparecer en un canal externo.

### El envío

```http
POST <tu-url>
Content-Type: application/json
User-Agent: Geniorama-Hooks/1.0
X-Geniorama-Event: ticket.status_changed
X-Geniorama-Delivery: evt_9f2c…
X-Geniorama-Timestamp: 2026-08-20T15:04:05.000Z
X-Geniorama-Signature: sha256=<hmac-sha256 del cuerpo con el secreto del hook>

{
  "id": "evt_9f2c…",
  "event": "ticket.status_changed",
  "occurredAt": "2026-08-20T15:04:05.000Z",
  "actor": { "id": "ckx…", "name": "Ana Ruiz" },
  "changes": { "status": { "from": "ABIERTO", "to": "CERRADO" } },
  "data": {
    "id": "ckt…",
    "code": "ACM-42",
    "title": "Se cayó el sitio",
    "status": "CERRADO",
    "priority": "ALTA",
    "url": "https://app.geniorama.co/tickets/ckt…",
    "createdBy":  { "id": "…", "name": "…", "email": "…" },
    "assignedTo": { "id": "…", "name": "…", "email": "…" },
    "client":     { "id": "…", "name": "…", "email": "…" }
  }
}
```

- `changes` solo viaja cuando el evento tiene un antes y un después.
- `actor` es quien provocó el cambio; es `null` si lo provocó el propio sistema
  (una tarea recurrente, un vencimiento).
- **Verifica la firma** antes de fiarte del cuerpo. En n8n, un nodo *Crypto* en
  modo HMAC SHA-256 sobre el cuerpo crudo y una comparación contra la cabecera.
- **Usa `X-Geniorama-Delivery`** para descartar duplicados: cada destino recibe
  su propio id, y un reintento repite el mismo.

### Reintentos y diagnóstico

Un `5xx` o un fallo de red se reintenta **una vez**, un segundo después. Un `4xx`
no se reintenta: es una decisión del destino, no un problema pasajero. El tiempo
máximo de espera por intento es de 8 segundos.

Cada intento queda registrado y se puede consultar desde la propia tarjeta del
hook («Últimas entregas»): código, error, duración e intentos. Se conservan
**14 días**.

---

## 2. API (entrada)

Base: `https://<tu-dominio>/api/v1`

### Llaves

Se crean en **Administración → Integraciones del equipo → Llaves de API**. Tres
decisiones al crearlas:

1. **En nombre de quién escribe.** La llave ve y escribe exactamente lo que vería
   esa persona en la plataforma. Para una integración del equipo, una cuenta de
   administrador; para una que solo deba tocar lo de un cliente, la de ese
   cliente. No hay superusuario anónimo.
2. **Permisos** — `read`, `write`, `act_as` y `agent` (este último solo para la
   llave del agente de atención; ver la sección 3).
3. **Vencimiento**, opcional.

El token se muestra **una sola vez**. En la base solo queda su SHA-256; si se
pierde, se revoca y se crea otra.

```http
Authorization: Bearer gnr_a1b2c3d4_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### `onBehalfOf`

Los `POST` aceptan `onBehalfOf` con el **id o el correo** de un usuario activo:
lo que se cree queda a nombre de esa persona, con su empresa, su plan y su
frontera de datos. Exige el permiso `act_as`.

Es la pieza que hace posible un bot multiusuario: el ticket lo abre el cliente
que escribió, no el robot.

Dos límites, para que suplantar no sirva para ascender: solo pueden hacerlo las
llaves atadas a una cuenta **del equipo** —una llave de cliente con `act_as`
igual recibe un `403`—, y nadie puede escribir en nombre de un administrador.

### Referencia interactiva

El contrato campo por campo está en **Administración → Integraciones del equipo →
Ver la guía → Referencia interactiva**: Swagger UI sobre esta misma instalación,
con *Authorize* para pegar el token y *Try it out* para lanzar llamadas reales
sin salir del panel.

El spec crudo se sirve en `GET /api/v1/openapi.json`, **sin llave** — no contiene
secretos, y pedirlo autenticado obligaría a tener una llave antes de poder leer
cómo se usan las llaves. Es OpenAPI 3.0.3, así que se importa tal cual en Postman
(*Import → Link*), Insomnia o el nodo *HTTP Request* de n8n, y sirve para generar
clientes.

Swagger UI se sirve desde la propia instalación (`public/swagger-ui/`, que se
copia desde `node_modules` en `predev`/`prebuild`), no desde un CDN: la pantalla
funciona en una red cerrada y no le pide nada a terceros.

### Endpoints

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/me` | — (solo llave válida) |
| `GET` | `/events` | `read` |
| `GET` | `/projects`, `/projects/:id` | `read` |
| `GET` | `/tickets`, `/tickets/:id` | `read` |
| `POST` | `/tickets` | `write` |
| `PATCH` | `/tickets/:id` | `write` |
| `GET` / `POST` | `/tickets/:id/comments` | `read` / `write` |
| `GET` | `/tasks`, `/tasks/:id` | `read` |
| `POST` | `/tasks` | `write` |
| `PATCH` | `/tasks/:id` | `write` |
| `GET` / `POST` | `/tasks/:id/comments` | `read` / `write` |
| `GET` | `/users?q=` | `read` (solo llaves del equipo) |
| `GET` | `/agent/client?phone=` | `agent` |
| `GET` | `/agent/context?client=` | `agent` |
| `POST` | `/agent/tickets` | `agent` |
| `GET` | `/agent/tickets/:id?client=` | `agent` |
| `POST` | `/agent/tickets/:id/comments` | `agent` |
| `GET` | `/agent/sites/:id/diagnose?client=` | `agent` |

Los listados paginan con `?limit=` (máx. 100) y `?cursor=`, y devuelven
`nextCursor: null` cuando no queda nada más.

Todas las respuestas llevan `ok`:

```json
{ "ok": true,  "ticket": { … } }
{ "ok": false, "error": "La llave no tiene el permiso \"write\"" }
```

### Ejemplos

Comprobar la llave:

```bash
curl https://<tu-dominio>/api/v1/me \
  -H "Authorization: Bearer $GENIORAMA_TOKEN"
```

Abrir un ticket en nombre de un cliente:

```bash
curl -X POST https://<tu-dominio>/api/v1/tickets \
  -H "Authorization: Bearer $GENIORAMA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "title": "Se cayó la web",
        "description": "El sitio devuelve 502 desde las 9am.",
        "priority": "ALTA",
        "onBehalfOf": "cliente@empresa.com"
      }'
```

Crear una tarea de forma idempotente:

```bash
curl -X POST https://<tu-dominio>/api/v1/tasks \
  -H "Authorization: Bearer $GENIORAMA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "projectId": "ckp…",
        "title": "Publicar el post de agosto",
        "description": "Sale del calendario de contenidos.",
        "externalRef": "n8n-exec-1234"
      }'
```

`externalRef` es único: si el workflow reintenta, la segunda llamada devuelve la
tarea que ya creó con `duplicate: true` en vez de duplicarla. Mándalo siempre que
tu origen tenga un identificador propio.

### El estado de un ticket nuevo

Sin `status`, un ticket creado por API nace **`POR_ASIGNAR`**, venga de la llave
que venga: lo que entra por una integración todavía no tiene dueño y pasa por la
misma bandeja de triaje que el resto.

Para elegirlo, mándalo en el cuerpo:

```json
{
  "title": "Revisión mensual del hosting",
  "description": "Programada.",
  "status": "EN_PROGRESO"
}
```

Valores: `POR_ASIGNAR`, `ABIERTO`, `EN_PROGRESO`, `EN_REVISION`, `CERRADO`.

Solo las llaves del equipo pueden elegirlo. Si la llave actúa como cliente —por
su propia cuenta o vía `onBehalfOf`— el ticket sale `POR_ASIGNAR` y mandar otro
estado devuelve un `403`, igual que en la interfaz.

Cerrar un ticket:

```bash
curl -X PATCH https://<tu-dominio>/api/v1/tickets/ckt… \
  -H "Authorization: Bearer $GENIORAMA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "CERRADO" }'
```

En `PATCH`, omitir un campo lo deja como estaba; mandarlo en `null` lo borra.

### Lo que la API no hace

- **No crea proyectos ni usuarios.** Son decisiones con empresa, plan y permisos
  detrás; se toman dentro de la plataforma.
- **No escribe notas internas.** La API es un canal externo. La única excepción
  es `POST /agent/tickets/:id/comments` con `internal: true`, que exige el
  permiso `agent` y firma la cuenta del equipo dueña de la llave.
- **Un cliente no puede asignar ni cambiar de estado**, igual que en la interfaz.
  Las llaves atadas a una cuenta de cliente solo abren tickets y comentan.
- **Los clientes necesitan plan activo** para abrir tickets. Sin él, la respuesta
  es un `422` con el motivo.

---

## 3. El agente de atención a clientes (WhatsApp)

El agente que conversa con los clientes vive **fuera**, en n8n, como todo lo
demás desde la v1.66. La plataforma pone los datos y los frenos; n8n pone el
canal, el modelo y el tono. Cambiar cualquiera de los tres no es un despliegue.

Lo que el agente sabe hacer con la API:

- **Informar.** Estado de sus tickets y proyectos, cuándo vence su plan y
  cuántas horas le quedan, sus servicios (dominio, hosting, SSL) y, si tiene
  autorizada *Mi facturación*, sus facturas pendientes con el link de pago.
- **Resolver lo que se puede resolver por chat.** «¿Cuándo vence mi plan?» sale
  de `/agent/context`. «¿Por qué no carga mi sitio?» sale de
  `/agent/sites/:id/diagnose`, que comprueba el sitio en vivo y lo cruza con los
  vencimientos y los tickets abiertos.
- **Escalar.** Si no puede resolverlo, abre un ticket a nombre del cliente
  (`POST /agent/tickets`), con lo que ya se descartó en el chat.
- **Dejar rastro para el equipo.** Comentarios públicos en los tickets del
  cliente y **notas internas** (`internal: true`) que el cliente no ve.

### Quién puede usarlo

Se activa **por plan**: *Administración → Planes → Editar → Agente IA por
WhatsApp*. Con un plan vigente que lo incluya, los clientes de esa empresa
pueden usarlo; sin él, `/agent/client` responde `agentEnabled: false` y el resto
de endpoints un `403` con `plan_sin_agente`.

El cliente se reconoce por el número que guardó en **Mis integraciones →
WhatsApp**. Un número sin cuenta da `404`; el bot debe pedirle que lo registre
ahí (o que lo haga el equipo). Si dos cuentas tienen el mismo número se rechaza
con `409` en vez de adivinar, y los administradores reciben un aviso (uno al día
por número) con las dos cuentas para que lo aclaren.

`/agent/client` devuelve un **`clientToken`** y el resto de endpoints solo
acepta eso en `client`: ni id ni correo. Lo firma la plataforma, solo vale con
la llave que lo pidió y vence a las 6 h. Así, aunque el cliente le diga al
modelo «mi correo es otro@…», no hay forma de leer lo de otro. Si vence a mitad
de una conversación la respuesta es `403` con `client_token_invalido`: basta
con volver a llamar a `/agent/client`.

### La llave

Una sola llave, atada a una **cuenta del equipo** creada para el agente (p. ej.
«Asistente Geniorama»: es quien firma sus comentarios), con el permiso `agent`.
No necesita `read`, `write` ni `act_as`: los endpoints `/agent` ya leen y
escriben en nombre del cliente que se atiende, y recortan todo a lo que él vería
en la plataforma. Una llave de cliente no puede tener `agent`.

### El canal

**Zoho CPaaS no sirve para esto**: solo envía plantillas aprobadas y avisa de
entregas, no recibe los mensajes del cliente. El agente necesita la **Meta Cloud
API** (o un proveedor que entregue los mensajes entrantes), con su propio
número o con el mismo número si se migra. Dentro de las 24 h desde el último
mensaje del cliente se le puede responder con texto libre, que es lo que hace
el agente.

### El workflow en n8n

1. **WhatsApp Trigger** (campo `messages`). Descarta los acuses de estado o el
   bot se responderá a sí mismo.
2. **HTTP Request** → `GET /api/v1/agent/client?phone={{from}}`.
   - `404` → «No encuentro tu número en Geniorama. Regístralo en Mis
     integraciones o escríbenos a soporte.»
   - `409` → «Hay un problema con tu número; el equipo ya fue avisado.»
   - `agentEnabled: false` → «El asistente no está incluido en tu plan.»
3. **AI Agent** con memoria por número (Window Buffer Memory, clave = `from`) y
   estas herramientas, todas *HTTP Request Tool* con la credencial de la llave y
   `client` fijado al `clientToken` del paso 2 —nunca lo decide el modelo—:

   | Herramienta | Llamada |
   |---|---|
   | `contexto_cliente` | `GET /agent/context?client=…` |
   | `ver_ticket` | `GET /agent/tickets/{codigo}?client=…` |
   | `diagnosticar_sitio` | `GET /agent/sites/{siteId}/diagnose?client=…` |
   | `abrir_ticket` | `POST /agent/tickets` |
   | `comentar_ticket` | `POST /agent/tickets/{codigo}/comments` |

4. **WhatsApp → Send message** con la respuesta del agente.
5. Opcional: un **hook** de organización suscrito a `ticket.status_changed` y
   `comment.created` que le avise al cliente por WhatsApp cuando el equipo
   mueva su ticket.

### Instrucciones de partida para el agente

```text
Eres el asistente de soporte de Geniorama. Hablas con {{nombre}}, cliente de
{{empresas}}. Responde en español, breve y claro, como en un chat de WhatsApp.

- Al empezar, llama a contexto_cliente. Responde solo con datos que vengan de tus
  herramientas; si no lo sabes, dilo.
- «¿Cuándo vence mi plan?» → plans[].expiresAt, daysLeft y horas disponibles.
- «Mi sitio no carga» → identifica el sitio en sites[] (pregunta si hay varios),
  llama a diagnosticar_sitio y explica findings en lenguaje sencillo. Si
  looksHealthy es true, sugiere borrar caché, probar otra red o navegador.
- Nunca des accesos, contraseñas o datos técnicos sensibles: si el cliente los
  pide, ofrece abrir un ticket para que el equipo lo atienda.
- Si no puedes resolverlo, ofrece abrir un ticket. Muéstrale el resumen y ábrelo
  solo cuando confirme. Después deja una nota interna (internal: true) con lo
  que se revisó en el chat.
- Si ya hay un ticket abierto sobre lo mismo, no abras otro: comenta en ese.
- No prometas fechas ni cambies estados, prioridades o responsables.
- Facturas: solo si billing.available es true. Para pagar, comparte payUrl.
```

---

## Seguridad

- El **secreto del hook** se genera solo, es distinto por hook y no se puede
  elegir a mano. Verifica siempre la firma.
- Las **llaves** son credenciales de escritura: guárdalas en el gestor de
  credenciales de tu herramienta, nunca en un nodo con el valor a la vista.
- Revocar una llave surte efecto en la siguiente petición. Revocar deja el
  rastro de uso; eliminar lo borra también.
- Si un hook apunta a una URL que ya no controlas, **desactívalo**: sigue
  mandando datos hasta que alguien lo pare.
