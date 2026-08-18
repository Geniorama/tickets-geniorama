# Conectar el agente de WhatsApp con n8n (Meta Cloud API)

Guía operativa para poner en producción el agente de tickets por WhatsApp
(`POST /api/integrations/whatsapp`, disponible desde la v1.62.0).

n8n es **el cartero**, no el agente: recibe el mensaje de Meta, lo reenvía a la
app y devuelve al cliente el texto que la app responde. La conversación entera
—memoria, identidad, propuestas pendientes— vive en la app, así que el workflow
es corto y no hay que tocarlo cuando cambia el comportamiento del bot.

```
Cliente → WhatsApp → Meta Cloud API ──► WhatsApp Trigger (n8n)
                                              │
                                              ▼
                          POST /api/integrations/whatsapp  ──►  App
                                              │                   │
                                              ◄─── { reply: "…" } ┘
                                              ▼
                                   Nodo WhatsApp → Cliente
```

Se usan los **nodos nativos de WhatsApp de n8n**: el *WhatsApp Trigger* se
encarga del registro y la verificación del webhook con Meta, y el nodo
*WhatsApp Business Cloud* de enviar la respuesta. Entre medias solo hace falta
un filtro, un pequeño Code y la llamada HTTP a la app. Son 5 nodos.

> Si no puedes crear la credencial OAuth del trigger (hace falta el **App
> Secret** de la app de Meta, no solo un token), existe una versión equivalente
> montada a mano con nodos Webhook + HTTP Request: ver el **apéndice** al final.

---

## 0. Lo que necesitas antes de empezar

| Requisito | Dónde se consigue |
|---|---|
| Cuenta de Meta Business verificada | [business.facebook.com](https://business.facebook.com) |
| App de Meta con el producto **WhatsApp** añadido | [developers.facebook.com/apps](https://developers.facebook.com/apps) |
| Número de teléfono en WhatsApp Business Platform | Panel de la app → WhatsApp → *API Setup* |
| n8n accesible por **HTTPS público** (Meta no acepta HTTP ni IPs) | n8n Cloud, o self-hosted detrás de un dominio con certificado |
| La app de tickets accesible **desde n8n** | Dominio público, red interna o túnel (paso 2) |

> **Una app de Meta, un webhook.** Meta solo admite **una** URL de callback por
> app. Si montas n8n de pruebas y n8n de producción sobre la misma app de Meta,
> el segundo que actives le roba los mensajes al primero. Para tener ambos,
> usa dos apps de Meta.

---

## 1. Datos de Meta que vas a copiar

En **developers.facebook.com → tu app**:

1. **App ID** y **App Secret** (Settings → Basic) — son el *Client ID* y el
   *Client Secret* de la credencial del **WhatsApp Trigger**.
2. En **WhatsApp → API Setup**:
   - **Phone number ID** — el número desde el que responde el bot. El workflow
     lo lee del propio webhook, así que no hay que pegarlo; anótalo para
     depurar.
   - **Token de acceso** — el que muestra esa pantalla **caduca en 24 horas**.
     Para producción crea uno permanente:

     > Business Settings → **Users → System users** → *Add* (rol Admin) →
     > **Add assets** → tu app, con permiso *Full control* →
     > **Generate new token** → elige la app y marca los permisos
     > `whatsapp_business_messaging` y `whatsapp_business_management` →
     > *Never expires* → **copia el token** (solo se muestra una vez).
   - **WhatsApp Business Account ID** — lo pide la credencial del nodo de envío.

> **Número de prueba vs. número real.** El número de prueba que regala Meta solo
> puede escribirle a un máximo de 5 destinatarios que registres a mano en
> *API Setup → To*. Sirve perfectamente para las pruebas del paso 6.

---

## 2. Deja la app alcanzable desde n8n

El endpoint que consume n8n es:

```
POST https://<tu-dominio>/api/integrations/whatsapp
```

Según dónde esté corriendo la app:

- **Ya desplegada en un dominio público** → usa ese dominio. Nada más que hacer.
- **n8n corre en la misma máquina o red que la app** → basta la URL interna
  (`http://localhost:3000/...` o `http://<nombre-del-contenedor>:3000/...`).
  Meta solo tiene que alcanzar a n8n, no a la app.
- **La app sigue en tu equipo (`localhost:3000`) y n8n está fuera** → levanta un
  túnel mientras pruebas:

  ```bash
  # Cloudflare Tunnel (sin cuenta, URL efímera)
  cloudflared tunnel --url http://localhost:3000

  # o ngrok
  ngrok http 3000
  ```

  Usa la URL `https://…` que imprima el túnel. Cada reinicio genera una URL
  nueva: hay que actualizarla en el workflow.

### Variables de entorno en el servidor de la app

```bash
INTEGRATION_WHATSAPP_TOKEN="una-cadena-larga-y-aleatoria"   # obligatoria
WHATSAPP_AI_PROVIDER="gemini"                               # gemini (por defecto) u openai
AUTH_URL="https://<tu-dominio>"                             # para que Integraciones muestre la URL correcta
```

`INTEGRATION_WHATSAPP_TOKEN` te lo inventas tú: es el secreto compartido entre
n8n y la app. Sin él, el endpoint responde **401 a todo**. Genera uno con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Comprueba en **Administración → Integraciones del equipo** que las dos primeras
filas del bloque *Agente de WhatsApp* estén en verde (token configurado y
proveedor de IA con su API key).

---

## 3. Crea las tres credenciales en n8n

**Credentials → New**, tres veces:

**a) WhatsApp OAuth account** — tipo *WhatsApp OAuth2 API*, la usa el trigger.

| Campo | Valor |
|---|---|
| Client ID | **App ID** de tu app de Meta |
| Client Secret | **App Secret** de tu app de Meta |

**b) WhatsApp account** — tipo *WhatsApp API*, la usa el nodo de envío.

| Campo | Valor |
|---|---|
| Access Token | el token permanente del System User |
| Business Account ID | el WhatsApp Business Account ID |

**c) Geniorama Tickets — Bearer** — tipo *Header Auth*, la usa la llamada a la app.

| Campo | Valor |
|---|---|
| Name | `Authorization` |
| Value | `Bearer <INTEGRATION_WHATSAPP_TOKEN>` |

---

## 4. Importa el workflow

1. En n8n: **Workflows → ⋯ → Import from File** y elige
   `docs/n8n/whatsapp-meta-cloud.workflow.json`. También puedes copiar el JSON
   con el botón de arriba y pegarlo directamente en el lienzo de n8n (Ctrl+V).
2. Quedan 5 nodos:

   | Nodo | Qué hace |
   |---|---|
   | **WhatsApp Trigger** | Recibe los eventos `messages` de Meta |
   | **¿Es un mensaje entrante?** | Descarta los acuses de estado (`sent`, `delivered`, `read`) |
   | **Extraer mensaje** | Aplana el payload de Meta a `from`, `text`, `messageId` |
   | **Agente Geniorama** | `POST /api/integrations/whatsapp` |
   | **Responder por WhatsApp** | Devuelve `reply` al cliente |

3. Abre cada nodo con credencial (**WhatsApp Trigger**, **Agente Geniorama**,
   **Responder por WhatsApp**) y selecciona la que le toca: la importación las
   deja marcadas como «no encontrada», es normal.
4. En **Agente Geniorama**, reemplaza `TU-DOMINIO` en la URL.
5. En **Responder por WhatsApp**, el *Phone Number ID* viene como expresión
   (`{{ $('Extraer mensaje').item.json.phoneNumberId }}`) para que funcione con
   cualquier número de la cuenta. Si prefieres fijarlo, cambia el campo a modo
   fijo y elígelo del desplegable.

> **El filtro no es opcional.** El campo `messages` de Meta entrega también los
> acuses de estado de los mensajes que *tú* envías. Sin el nodo
> *¿Es un mensaje entrante?*, cada respuesta del bot volvería a disparar el
> flujo.

> **Por qué no hace falta responder 200 a mano.** Los triggers de n8n acusan
> recibo en cuanto arranca la ejecución, así que Meta no reintenta aunque el
> agente tarde unos segundos en contestar.

---

## 5. Activa el workflow

Pulsa el interruptor de **Active**. Al activarse, n8n registra su URL como
callback de la app de Meta usando la credencial OAuth: no hay que pegar ninguna
URL ni inventar un *verify token*.

Comprueba en **developers.facebook.com → tu app → WhatsApp → Configuration**
que el webhook aparece registrado y que el campo **`messages`** está suscrito.
Si no aparece, suscríbelo desde ahí (*Webhook fields → Manage*): sin esa
suscripción el webhook queda puesto pero no llega ni un mensaje.

---

## 6. Prueba de punta a punta

Escribe al número desde un WhatsApp **que no esté vinculado a ningún usuario**:

1. **«Hola»** → el bot pide el correo con el que entras a la plataforma.
   *Si no responde nada, revisa la suscripción a `messages` (paso 5).*
2. **Tu correo** → llega un código de 6 dígitos a esa dirección (mira spam).
   La respuesta es la misma exista o no la cuenta, a propósito.
3. **Los 6 dígitos** → queda vinculado. El código caduca a los 10 minutos y
   tras 5 intentos fallidos el número se bloquea 30 minutos.
4. **«¿Cómo va mi plan?»** → horas consumidas, disponibles y vencimiento.
5. **«Se cayó el formulario de contacto de la web»** → el agente recoge los
   datos, muestra un resumen y **solo crea el ticket cuando confirmas**.
6. **«En el ACM-12, agrega que ya probamos desde otro navegador»** → deja el
   comentario y notifica al responsable.

Atajo para saltarte la vinculación en las pruebas: carga el número en
**Administración → Usuarios → Editar → WhatsApp** (en E.164 sin `+`, p. ej.
`573001234567`) y el bot reconoce el número sin pedir código.

### Probar la app sin pasar por WhatsApp

```bash
curl -X POST https://<tu-dominio>/api/integrations/whatsapp \
  -H "Authorization: Bearer $INTEGRATION_WHATSAPP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"from":"573001234567","text":"hola","messageId":"test-001"}'
```

Repetir el mismo `messageId` devuelve la respuesta guardada con
`"duplicate": true`, sin volver a ejecutar el agente: así es como un reintento
de n8n no crea el ticket dos veces.

---

## 7. Cuando algo no funciona

| Síntoma | Causa habitual |
|---|---|
| El workflow no llega a ejecutarse | No está **activo**, o el campo `messages` no está suscrito en Meta |
| Dejó de llegar todo de golpe | Otra instancia de n8n se registró sobre la misma app de Meta (solo cabe un webhook por app) |
| n8n se ejecuta y la app responde **401** | `INTEGRATION_WHATSAPP_TOKEN` no coincide, o la credencial Header Auth no lleva el prefijo `Bearer ` |
| La app responde **400 «No pude interpretar el número»** | `from` llegó vacío o con formato raro; revisa el nodo *Extraer mensaje* |
| La app responde 200 pero el cliente no recibe nada | Falla el nodo de envío: token de Meta caducado (el de *API Setup* dura 24 h) o número destino fuera de la lista de prueba |
| El bot contesta «Tuve un problema al procesar tu mensaje» | Error del lado de la app: mira los logs del servidor, suele ser la API key del proveedor de IA |
| Responde «Por ahora solo entiendo mensajes de texto» | Llegó audio, imagen o sticker. Si quieres soportarlo, transcríbelo en n8n antes del nodo *Agente Geniorama* |
| El bot se responde a sí mismo en bucle | Falta o está mal el nodo *¿Es un mensaje entrante?* |

### Dónde mirar

- **n8n → Executions**: el payload exacto de Meta y la respuesta de la app.
- **Logs del servidor**: los errores del agente salen como `[whatsapp] Error procesando mensaje:`.
- **Administración → Integraciones del equipo**: estado del token, del proveedor
  de IA y cuántos usuarios tienen número vinculado.

---

## 8. Notas de operación

- **Ventana de 24 horas.** Meta solo permite mensajes de texto libres dentro de
  las 24 h siguientes al último mensaje del cliente. El agente siempre responde
  a un mensaje entrante, así que nunca sale de la ventana; pero si algún día se
  quiere que el bot escriba primero, hará falta una plantilla aprobada.
- **Un número, un usuario.** `users.whatsapp_phone` tiene índice único: un mismo
  teléfono no puede quedar atado a dos cuentas.
- **Lo que el agente no hace.** No cierra tickets ni cambia estados, prioridades
  o fechas. Un cliente sin plan activo puede consultar, pero no abrir tickets.

---

## Apéndice: versión sin nodos nativos

`docs/n8n/whatsapp-meta-cloud-http.workflow.json`
hace exactamente lo mismo con nodos genéricos: **Webhook** (GET + POST) →
IF de verificación → *Respond to Webhook* con el `hub.challenge` → acuse 200 →
filtro → Code → HTTP a la app → HTTP a `graph.facebook.com`.

Son 8 nodos en vez de 5 y hay que hacer a mano lo que el trigger hace solo
(registrar la callback URL en Meta, inventar un *verify token*, contestar el
`hub.challenge` y acusar recibo antes de llamar a la app). A cambio:

- **No necesita el App Secret**: le basta el token permanente en una credencial
  Header Auth (`Authorization: Bearer <token>`).
- **Fija la versión de la Graph API** (`v21.0` en la URL), útil si te preocupa
  que un cambio del nodo nativo altere el comportamiento.

Si eliges esta versión, la callback URL que se pega en
**WhatsApp → Configuration → Webhooks → Edit** es la *Production URL* del nodo
Webhook (`https://<tu-n8n>/webhook/geniorama-whatsapp`), **no** la de test, y el
workflow tiene que estar activo antes de pulsar *Verify and save*.
