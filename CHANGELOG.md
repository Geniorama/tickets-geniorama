# Changelog — Geniorama Tickets

Todas las entregas notables de este proyecto. Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).
Versionado semántico: `MAJOR.MINOR.PATCH` — funciones nuevas incrementan MINOR, correcciones incrementan PATCH.

---

## [Unreleased]

---

## [1.90.0] — 2026-09-02

### Historial de acciones en todo

Hasta ahora, cuando alguien preguntaba «¿quién cambió esto?» no había dónde
mirar. La plataforma sabía contar lo que pasaba **hacia afuera** —los hooks
llevan meses avisando a n8n y compañía— pero no guardaba nada **hacia adentro**.

Ahora cada ficha tiene su **Historial**: quién hizo qué, cuándo, y de qué a qué.

- **Tickets, tareas y proyectos** — creación, cambios de estado, reasignaciones,
  ediciones, comentarios y borrados.
- **Facturación** — el módulo que no registraba nada. Cobros creados y editados,
  cambios de estado, abonos apuntados, **corregidos** y eliminados, comprobantes
  y etiquetas. Corregir un importe de $300.000 a $500.000 deja constancia de las
  dos cifras y de quién lo hizo.
- **CRM** — cuentas, contactos y oportunidades: etapas, valores, responsables.
- **Administración** — usuarios creados y desactivados, cambios de rol y de
  permisos, sitios, planes, servicios, hooks, llaves de API y ajustes.
- **Bóveda** — además de crear y editar, se registra **quién consultó una
  credencial**, que es lo que de verdad se le pregunta a una bóveda.

### Una pantalla para verlo todo junto

**Administración → Actividad** reúne el historial de la plataforma entera, con
filtros por módulo, acción, persona, fechas y nombre de la ficha. Los filtros
van en la URL, así que un hallazgo se comparte pegando el enlace.

### Lo que el historial no guarda

- **Contraseñas y secretos.** De la bóveda se registra que cambió, no a qué. De
  los ajustes, la clave que se tocó y ni una letra del valor. Una bitácora que
  copia secretos es una filtración con fecha.
- **El texto de los comentarios.** El hilo está en la misma ficha; tenerlo dos
  veces acaba con los dos diciendo cosas distintas.
- **Las descripciones enteras.** Que cambiaron sí; el texto no.

### Decisiones

- **Solo para el staff.** El cliente ve el hilo de comentarios, no la
  trastienda: reasignaciones internas y correcciones de importes generan
  preguntas que no le tocan.
- **Nadie lo edita ni lo borra**, tampoco un administrador. Una bitácora que se
  puede retocar no sirve para lo que se le pide.
- **Sobrevive a la ficha.** Borrar un cobro no se lleva el registro de quién lo
  borró — que es justo lo que se va a buscar después.
- **Una edición que no cambió nada no deja rastro**, para que el historial no se
  llene de «editó el ticket» cada vez que alguien mueve una tarjeta.

---

## [1.89.0] — 2026-09-01

### La ficha de un cobro deja de decir todo dos veces

El formulario de edición vivía siempre abierto debajo del detalle, repitiendo
el importe, el estado, las categorías, las fechas y las notas que ya estaban
arriba. Dos sitios diciendo lo mismo en la misma pantalla, y media página de
campos para quien solo venía a ver cuánto falta por cobrar.

Ahora **se edita en su propia pantalla**, con un botón «Editar» en la cabecera,
como ya se hacía con tickets y tareas. Al guardar se vuelve al cobro, en vez de
quedarse en el formulario dejando la duda de si guardó.

### Jerarquía

La cabecera dice de un vistazo las tres cosas por las que se entra: qué es, en
qué estado está y **cuánto falta por cobrar**, ahora en grande y a la derecha.

Debajo, dos columnas desiguales en vez de dos mitades: a la izquierda y más
ancho lo que se opera —el dinero, los abonos, las novedades—; a la derecha y
más estrecho lo que se consulta —etiquetas, recordatorios y la ficha con las
fechas—. Antes la columna izquierda se quedaba vacía a media página mientras la
derecha seguía sola con un formulario larguísimo.

### Arreglado

- En el editor de líneas el concepto no cabía: se leía «Cobrc» donde decía
  «Cobro prueba». Ahora ocupa el ancho que le queda libre, y en pantalla
  estrecha la línea se apila en vez de comprimirse hasta ser ilegible.

---

## [1.88.1] — 2026-09-01

### Cambiado

- La pantalla de Xubio da ahora la ruta exacta donde se sacan las credenciales
  —Configuración → Integraciones → API de Xubio → Nueva App Cliente— y avisa de
  que esa opción solo existe en los planes Emprendedor y Empresa. Antes decía
  «en la configuración de integraciones», que no basta cuando la opción
  directamente no aparece.

---

## [1.88.0] — 2026-09-01

### Conexión con Xubio: primera entrega

Pantalla nueva en **Facturación → Xubio**. Por ahora hace una cosa: poner en
correspondencia las empresas de aquí con los clientes de allá, que es el paso
sin el cual no se puede facturar nada. **Todavía no emite ninguna factura**;
eso va en la siguiente entrega y con un botón por cobro.

La correspondencia se busca en tres pasos, y el orden importa: primero el
vínculo ya guardado —porque alguien lo decidió—, luego el NIT —que es el
identificador de verdad, y se compara con y sin dígito de verificación—, y por
último el nombre, ignorando acentos, puntuación y la forma societaria: «Acme
S.A.S.» y «ACME SAS» son la misma empresa.

**Si el nombre encaja con más de un cliente, no se empareja sola.** Se marca y
espera a que alguien elija. Emparejar mal significa facturarle a otro cliente.

### Nada se crea sin que alguien lo pulse

Dar de alta un cliente en Xubio enseña antes exactamente qué se va a mandar,
NIT incluido, y espera confirmación. También se puede pegar a mano el
identificador de un cliente que ya exista allá.

El vínculo se guarda, y un mismo cliente de Xubio no puede quedar enlazado a
dos empresas de aquí —lo impide la base de datos—: sería facturar a nombre de
otro.

### Lo que hace falta configurar

En el `.env.local` del servidor: `XUBIO_CLIENT_ID` y `XUBIO_CLIENT_SECRET`. No
se guardan en la base de datos ni se muestran en pantalla; la aplicación solo
dice si están puestas. Mientras falten, la pantalla lo explica en vez de fallar.

---

## [1.87.0] — 2026-09-01

### Cada abono lleva su comprobante

Los soportes de pago colgaban del cobro entero. Con tres abonos eso son tres
comprobantes en un mismo montón, sin saber cuál corresponde a cuál. Ahora cada
abono tiene los suyos, adjuntos desde su propia línea.

Los del cobro siguen donde estaban, en «Novedades y soportes», para lo que es
del cobro y no de un pago concreto: el contrato, la orden de compra, la factura
en PDF.

No hicieron falta tablas nuevas. Los adjuntos viven desde la Fase 0 en una tabla
compartida identificada por entidad e id; dar de alta una entidad ahí es añadir
un valor al enum, que es para lo que se hizo así.

### Sin dejar archivos huérfanos

Las tablas compartidas no tienen clave foránea, así que la limpieza es a mano y
había dos sitios donde hacerla: al quitar un abono se va su comprobante, y al
borrar un cobro se van los de todos sus abonos —recogiendo sus identificadores
**antes** de que los abonos desaparezcan, o no habría forma de encontrarlos
después—.

---

## [1.86.0] — 2026-09-01

### Los abonos se pueden corregir

Hasta ahora un abono solo se podía quitar y volver a poner, que para arreglar un
importe mal tecleado es más trabajo del que debería. Ahora se corrigen en su
sitio: importe, fecha, cómo llegó y la nota.

Corregir recalcula igual que apuntar o quitar, así que subir un importe hasta
cubrir el total cierra el cobro, y bajarlo lo vuelve a abrir. El atajo de «poner
lo que falta» descuenta el abono que se está corrigiendo, para no proponer una
cifra que ya lo incluye.

Corregir pide el mismo permiso que apuntar. Podría parecer que tocar una cifra
guardada merece más, pero quien puede editar ya cambia el total del cobro
entero, que es un número más gordo; exigir más aquí solo conseguiría que un
importe mal escrito se quedara mal.

---

## [1.85.0] — 2026-09-01

### Los abonos pasan de ser un número a ser una lista

Se podía registrar **un** abono y ahí se acababa. Casi ningún cliente paga de
una vez —un anticipo, otro al entregar, el saldo a treinta días—, y el segundo
pago no cabía en ninguna parte: había que machacar el primero, perdiendo cuándo
entró y cuánto fue. Y como el tablero ignora que sueltes una tarjeta en la
columna donde ya está, en la práctica ni eso se podía.

Ahora cada abono se apunta con su importe, su fecha, cómo llegó y una nota, y
queda la lista completa en la ficha del cobro. Los abonos ya registrados se
conservaron: lo que hubiera cobrado se convirtió en su primer abono, con la
mejor fecha disponible.

### El estado lo decide el dinero, no al revés

Antes se arrastraba la tarjeta a «Abonado» y eso escribía un importe. Ahora se
apunta el dinero y la columna se coloca sola: al cubrir el total, el cobro pasa
a **Pagado** sin que nadie tenga que acordarse de moverlo; al quitar un abono,
retrocede. La fecha de pago es la del último abono, no la del día en que se
apuntó.

Soltar una tarjeta en «Pagado» con saldo pendiente registra ese saldo como un
abono más, para que la lista y la cifra digan lo mismo.

### Ya no se borra dinero en silencio

Devolver a «Facturado» un cobro con abonos ponía lo cobrado a cero sin avisar.
Ahora se niega y explica cuántos abonos estorban. De paso, el tablero **muestra
por qué** se niega a mover una tarjeta: hasta ahora la tarjeta volvía sola a su
sitio y nadie sabía la razón.

### Arreglado sobre la marcha

- Al registrar un abono, el formulario se cerraba como si todo hubiera ido bien
  pero la lista seguía igual hasta recargar la página: parecía que no se había
  guardado. Invalidar la caché del servidor no basta cuando la pantalla ya está
  pintada en el navegador; hay que volver a pedirla, y hacerlo fuera de la
  transición del formulario.

### Quién y cuándo

Cada abono guarda quién lo apuntó. Quitarlo pide permiso de gestión, como
borrar el cobro entero: cambia lo cobrado y puede mover el cobro de columna.

---

## [1.84.0] — 2026-09-01

### Categorías: qué se vendió, no solo cuánto

Cada línea de un cobro puede llevar ahora su categoría —**Hosting**,
**Desarrollo web** y **Marketing** vienen puestas— y se pueden crear más sin
desplegar. Va en la línea y no en el cobro a propósito: una misma factura mezcla
el hosting del año con un rediseño, y separar eso es exactamente lo que
contabilidad necesita.

En la ficha del cobro aparece el reparto cuando hay más de una categoría, y el
editor avisa si alguna línea se queda sin catalogar, antes de guardar.

### Qué se vendió

Pantalla nueva en **Facturación → Qué se vendió**: lo facturado en un periodo
repartido por categoría, con su peso en porcentaje. El periodo va en la URL, así
que se puede compartir o guardar. Y un **CSV con el detalle línea a línea**,
porque contabilidad no vive en esta aplicación: lo que necesita es pegarlo en su
libro, con los importes crudos para poder sumarlos.

Lo que nadie catalogó aparece como «Sin categoría» y siempre al final: es una
tarea pendiente, no una categoría.

### El reparto es sobre la base, sin IVA

No es una simplificación. El IVA se calcula por tarifa sobre la base acumulada
de toda la factura; trocearlo por categoría obligaría a redondear dentro de cada
trozo y la suma dejaría de dar el total —con tres líneas de 333.333 al 19 % da
189.999 donde la factura dice 190.000—. Además contabilidad cataloga servicios
por su valor neto: el IVA es una cuenta aparte. La suma del reparto es siempre
exactamente el subtotal de la factura.

### Retirar en vez de borrar

Una categoría que deja de usarse se retira: desaparece del desplegable pero los
cobros que ya la llevan siguen catalogados. Si se borrara, un informe cerrado
cambiaría de cifras meses después.

---

## [1.83.0] — 2026-09-01

### Correos de facturación por cliente

Los recordatorios de cobro iban al contacto principal del CRM, y eso no encaja
con cómo funcionan las empresas: el buzón que paga facturas suele ser
`facturacion@cliente.com` o el correo de su contador, no una persona de la
agenda. Ahora cada cliente tiene sus **correos de facturación** —pueden ser
varios— en su ficha del CRM.

Si están puestos, mandan ellos y el contacto no se usa: quien los rellena está
diciendo explícitamente a dónde van las facturas. Si están vacíos, se sigue
cayendo al contacto principal, igual que hasta ahora. Un efecto secundario útil:
con buzón puesto deja de importar que la cuenta tenga varios contactos sin
principal marcado, que era el caso en que antes no salía nada.

Cuando el destinatario es un buzón, `{{contacto}}` pasa a ser el nombre de la
empresa: «Hola Acme S.A.S.» en vez de saludar por su nombre de pila a un buzón
que no tiene ninguno.

### Se ve a quién le va a llegar

Cada cobro muestra ahora, antes de que salga nada, a qué correos le llegaría y
si vienen del buzón de facturación o del contacto principal —y si no le llegaría
a nadie, por qué y dónde arreglarlo—. La pregunta «¿esto a quién le llega?» se
hace antes del primer envío, no después.

### El remitente

Los recordatorios salen desde **administrativo@geniorama.co**, con `Reply-To` al
mismo buzón, en vez del `noreply` del resto de la aplicación. El mensaje invita
a responder y un remitente que no lee a nadie convertía esa invitación en una
mentira. El resto de correos de la app no cambian.

---

## [1.82.2] — 2026-08-31

### El historial de migraciones vuelve a poder construir la base desde cero

Durante meses no podía, y no se notaba. El proyecto empezó usando
`prisma db push`, que sincroniza el esquema contra la base sin dejar constancia
de cómo se llegó ahí; cuando después se adoptaron las migraciones, todo lo
creado hasta entonces quedó fuera del historial. Producción funcionaba porque su
base venía de aquella época, pero una base nueva era imposible de levantar:
`prisma migrate deploy` fallaba al tocar una tabla que, según los ficheros, no
existía.

Da igual mientras solo haya una base y nadie la pierda. Deja de dar igual el día
que haya que montar un entorno de pruebas o recuperarse de un desastre — que es
el peor día para enterarse.

Faltaban **siete tablas** (`app_settings`, `notifications`, `project_members`,
`recurring_task_templates`, `user_webhooks` y las dos de revisores), **dos tipos
enumerados**, **once columnas** repartidas por `users`, `projects`, `tickets` y
`tareas`, y un valor de `TicketStatus`. Se recrean en una migración nueva que
solo actúa sobre lo que no está: en producción no hace absolutamente nada.

Aparte, ocho tablas heredadas que se usaron y luego se borraron —las de
checklists, reacciones, plantillas y bóveda anteriores al núcleo compartido—
tenían migraciones de datos que daban por hecho que existían. Ahora van
condicionadas: si no hay tabla heredada, no hay nada que migrar.

### Un guardián para que no se repita

Un workflow nuevo comprueba en cada cambio de `prisma/` que el historial corre
sobre una base vacía **y** que lo que produce coincide con `schema.prisma`. Esa
segunda comprobación es la que pilla el `db push` a escondidas: si alguien toca
el esquema sin escribir su migración, salta ahí y no seis meses después.

---

## [1.82.1] — 2026-08-31

### Arreglado

- En el editor de reglas no se podía teclear un número de días negativo: el
  campo convertía el guion en un cero y «-5» acababa siendo «05». Justo el caso
  de avisar *antes* del vencimiento, que era media función.
- En un cobro todavía sin facturar, el panel de recordatorios mandaba a poner
  una fecha en un campo que aún no existe. Ahora dice lo que pasa de verdad:
  hasta que la factura no se emite, no se reclama nada.

---

## [1.82.0] — 2026-08-31

### Recordatorios de cobro automáticos

Cada mañana a las nueve se revisan las facturas emitidas que siguen sin
cobrarse y sale lo que toque. Las reglas las escribe quien gestiona
facturación desde **Facturación → Recordatorios**: cuántos días respecto al
vencimiento, por qué canal y con qué texto. En negativo avisa *antes* de que
venza, que evita la mitad de las moras.

El mensaje admite marcas —`{{contacto}}`, `{{factura}}`, `{{pendiente}}`,
`{{vencimiento}}`, `{{dias}}`…— y el editor avisa si se escribe una que no
existe, antes de que llegue así a un cliente.

### El vencimiento de la factura, en su propio campo

Hasta ahora una sola fecha significaba dos cosas: cuándo facturar y, si ya
estaba emitida, cuándo vencía. Una fecha con dos significados no sirve para
programar nada encima, así que se separó. A las facturas ya emitidas se les
traspasó su fecha; en lo que aún no se ha facturado, la de siempre sigue
queriendo decir lo que decía.

### Lo que no puede pasar

Escribirle a un cliente sobre su dinero no se deshace, así que hay tres frenos:

- **Nada se envía dos veces.** Un índice único en la base impide que una regla
  vuelva a escribir sobre el mismo cobro por el mismo canal, aunque el cron se
  dispare dos veces. Un envío fallido sí se reintenta al día siguiente.
- **Encender una regla no reclama lo atrasado.** Cuenta desde el día en que se
  activa. Sin esto, una regla de «a los 30 días» soltaría de golpe un mensaje
  por cada factura vencida del último año.
- **Si no está claro a quién escribir, no se escribe.** Va al contacto
  principal de la empresa; si hay varios y ninguno marcado, se omite y se avisa
  en vez de escribirle a cinco personas sobre una deuda.

Además, cada cobro se puede silenciar por su cuenta, y lo que sale queda
anotado en su hilo de novedades y en el registro de la pantalla de reglas.

### Canales

El **correo funciona**. **SMS y WhatsApp quedan preparados pero sin conectar**:
falta la cuenta del proveedor, no el sitio donde ponerla. Se pueden marcar en
una regla —la pantalla lo avisa— y quedan anotados como «sin salir» en vez de
romper el envío del correo. Para WhatsApp hará falta además que Meta apruebe
las plantillas, que es requisito suyo para escribir a quien no te ha escrito
en las últimas 24 horas.


---

## [1.81.0] — 2026-08-31

### Novedades, soportes y etiquetas en los cobros

Cada cobro tiene ahora un hilo donde dejar el comprobante de pago y lo que haya
pasado —«el cliente pidió plazo», «rebotó la transferencia»—. Texto y archivos
van juntos y no en dos pestañas: un soporte casi siempre viene con una frase que
lo explica, y separarlos obliga a contar la historia dos veces. En el tablero
cada tarjeta indica cuántas novedades tiene, para saber dónde mirar sin abrir.

No hicieron falta tablas nuevas. Comentarios y adjuntos viven desde la Fase 0 en
tablas compartidas identificadas por entidad e id; dar de alta un módulo ahí es
añadir un valor al enum, que es justo para lo que se hizo así.

Cada quien borra sus propias novedades; un administrador, cualquiera. Y todo va
acotado al cobro: un id suelto no puede tocar el hilo de otro, ni el de un
ticket, ni aunque coincida el identificador.

### Etiquetas

Vuelven las etiquetas que se usaban en Trello: **Por revisar** y **Por cobrar**
ya vienen puestas, y quien gestione facturación puede crear más sin esperar un
despliegue —si crearlas costara uno, acabarían metidas en el título del cobro—.

Son una dimensión aparte de la columna, no otra columna: un cobro «Facturado»
puede estar a la vez «Por revisar», así que se marcan varias. Se ven en la
tarjeta del tablero y en el detalle.

### Arreglado

- Borrar un cobro dejaba huérfanos sus comentarios y adjuntos. Las tablas
  compartidas no tienen clave foránea y hay que limpiarlas a mano, como ya se
  hacía en tareas y tickets.


---

## [1.80.1] — 2026-08-31

### Los importes se escriben con separadores de miles

Los totales ya se **mostraban** con puntos, pero al teclearlos no: había que contar ceros con el dedo para distinguir `1200000` de `12000000`. En un importe de factura, equivocarse en un cero no es un detalle.

Ahora el campo va poniendo los puntos mientras se escribe, en las líneas de un cobro, en el abono parcial y en el valor de una oportunidad del CRM.

Dos cosas que se cuidaron y se notan al usarlo:

- **El cursor no salta.** Al insertar un punto, el texto crece y el cursor se iría al final; se reposiciona contando **dígitos** en vez de caracteres, así que se puede corregir en medio de un número.
- **No hace falta un campo oculto.** Se envía el texto formateado y el servidor lo entiende, porque ya quitaba los puntos al leerlo. Un campo oculto en paralelo es una cosa más que puede desincronizarse de lo que se ve.

De paso, el CRM tenía **su propia copia** de la lectura de importes. Ahora usa la misma que Facturación: dos formas de interpretar los puntos de miles acaban discrepando justo cuando alguien compara una oportunidad con su cobro. Es la misma consolidación que ya se hizo con el formateo.

15 comprobaciones sobre el formateo y su ida y vuelta: que las letras se ignoran, que los ceros de la izquierda se van, que reformatear no rompe, y que las cuentas de un cobro cuadran partiendo del texto tecleado.

---

## [1.80.0] — 2026-08-31

### Un cobro se compone de varias líneas, cada una exenta o con IVA

Un cobro casi nunca es una sola cosa: hosting, dominio y una hora de soporte van en la misma factura, y cada concepto puede ir exento o gravado. Con un único importe había que decidir el impuesto para el cobro entero, que es justo lo que no se puede hacer.

Ahora el formulario tiene tantos conceptos como haga falta —cada uno con su importe y su **Exento / +19% IVA**— y muestra **subtotal, IVA y total** mientras se escribe. La ficha del cobro enseña el desglose línea a línea, que es lo que se compara contra la factura real cuando algo no cuadra.

#### El IVA se calcula como en una factura, no línea a línea

Esto lo cambió una prueba. Sumando el impuesto de cada línea por separado, tres conceptos de 333.333 al 19 % dan **189.999**; una factura declara «base gravada 19 %: 1.000.000, IVA: 190.000». El impuesto se calcula ahora **por tarifa sobre la base acumulada**, que es como se declara y evita que el redondeo se acumule. Un peso no rompe nada, pero es el peso que nadie sabe explicar cuando no cuadra.

El porcentaje se guarda **por línea** en vez de un booleano «lleva IVA», para que el día que aparezca un 5 % sea un dato y no una migración. Cero es exento.

#### Detalles

- **El total lo calcula siempre el servidor.** Lo que manda el navegador es para pintar; si el cliente pudiera fijar el total, un cobro podría decir cualquier cosa.
- **El desglose se enseña aunque todo vaya exento.** Ver «IVA $0» confirma que se eligió, en vez de dejar la duda de si se olvidó.
- **Los abonos y los pagos son contra el total con IVA**, no contra la base.
- `amount` pasa a ser el total y se guarda junto a `subtotal` y `taxAmount`: el tablero suma columnas enteras y la ficha de una empresa lista sus cobros, y unir las líneas en cada fila costaría en todas las pantallas. A cambio, solo se escribe al recalcular.

#### La migración

Cualquier cobro que ya existiera conserva su importe como total y gana una línea con ese mismo importe, **exenta**: nadie había declarado IVA todavía y suponerlo cambiaría cifras que alguien ya miró. Probado con un cobro de la forma anterior — mantiene su total, gana su línea y el desglose cuadra.

#### Comprobado

18 comprobaciones sobre el cálculo y su recorrido: todo exento, todo gravado, la mezcla de ambos en el mismo cobro, sin líneas, el agrupado por tarifa que no mezcla exentas con gravadas, que no quedan centavos sueltos, y que un abono deja pendiente el resto **del total con IVA**.

---

## [1.79.0] — 2026-08-31

### Módulo de Facturación

Sustituye el tablero de Trello, con las mismas cinco listas: **Backlog → Por facturar → Facturado → Abonado → Pagado**.

#### «Abonado» es lo que define el modelo

Un abono parcial solo significa algo contra un importe, así que una tarjeta aquí no es una tarea: es un **cobro con dinero**. Y el dinero va en dos campos —lo que se factura y lo que ya entró—, porque uno solo obligaría a elegir entre saber cuánto se facturó o cuánto se ha recibido, y en un abono hacen falta los dos.

Al soltar una tarjeta en «Abonado» se pregunta cuánto entró: es la única columna que no se puede deducir del movimiento. La tarjeta muestra entonces lo abonado y **lo que falta**, que es la cifra que se busca.

#### El estado manda sobre el dinero y las fechas

Un cobro va hacia adelante y hacia atrás: una factura se anula, un pago se devuelve. Cada sello se pone al entrar en su estado y **se quita al salir** — volver a «Por facturar» borra la fecha de pago, la de facturación, lo abonado y el número de factura. Sin eso quedan cobros «por facturar» con número de factura y fecha de pago, que es justo lo que hace que nadie vuelva a fiarse del tablero.

Esa lógica vive en `src/lib/billing/move.ts` como función pura, fuera de la Server Action, para poder comprobarla caso por caso. Toca dinero: misma separación que se hizo con el acceso al portal.

#### Detalles que se notan al usarlo

- **Las columnas suman lo que falta por cobrar**, no lo facturado. En «Abonado», sumar el total mentiría sobre la caja pendiente.
- **Los pagados se ocultan por defecto** y el tablero dice cuántos esconde, con la lección ya aprendida en el CRM.
- **El número de factura solo se pide cuando ya se emitió.** Pedirlo antes invita a inventárselo.
- **Backlog va primero**, no al final como en Trello: es lo que todavía no toca, y a la derecha está lo cobrado. Si estorba ahí, cambiarlo es una línea.
- El inicio muestra **cuánto hay por cobrar** en la tarjeta del módulo.

#### Permisos

Módulo nuevo en el catálogo, con niveles desde el primer día. **Ningún cliente puede tenerlo**: aquí está lo que se le cobra a todos, no solo a él. Borrar un cobro pide Gestor, porque borra el rastro de un dinero.

#### Por dentro

El formateo de importes se mudó de `lib/crm/deals.ts` a `lib/money.ts`: al llegar Facturación habría hecho falta una segunda copia, y dos formateadores de dinero acaban discrepando justo cuando alguien compara una oportunidad con su cobro.

El alta del módulo en el enum `AppKey` va en **su propia migración**. PostgreSQL deja añadir un valor a un enum dentro de una transacción pero no usarlo en esa misma transacción; separarlo evita que un día, al conceder permisos en la misma migración, falle solo en producción.

#### Comprobado

29 comprobaciones: las cinco listas y su orden, que un cliente no puede tener el módulo, que las rutas resuelven y no hay etiquetas duplicadas, la lectura de importes tecleados con puntos y signo de peso, y sobre todo el recorrido completo del tablero — facturar, abonar de más (se topa en el total), pagar, y **retroceder**, que es donde se ensucia todo.

---

## [1.78.2] — 2026-08-26

### La prueba de push ahora confirma que el aviso llegó al dispositivo

Que el servicio de push acepte el envío no significa que se vea. Entre «aceptado» y «lo estás viendo» quedan dos eslabones que la prueba no miraba: si el service worker recibió el aviso, y si el sistema operativo lo enseñó.

Ahora, tras enviar, el navegador comprueba durante tres segundos si el aviso llegó de verdad —consultando las notificaciones del propio service worker— y lo dice:

- **Llegó**: entonces el problema es que el sistema lo está ocultando, y se indica exactamente dónde mirar según el sistema (Ajustes del Sistema → Notificaciones en macOS, Configuración → Notificaciones y Asistente de concentración en Windows).
- **No llegó**: se distingue de lo anterior y se dice cuántos dispositivos lo aceptaron.

Es el paso que separa «falla el servidor» de «lo esconde el sistema». Sin él, una prueba que sale bien deja igual de a ciegas que una que no sale.

Es también el fallo más difícil de diagnosticar de todo esto: el permiso del sitio concedido, el push entregado, el service worker mostrándolo… y el sistema escondiéndolo porque el navegador entero no tiene permiso o hay un modo de concentración activo. Nadie lo adivina solo.

---

## [1.78.1] — 2026-08-26

### El botón de prueba de las push mentía

Decía «Enviado» aunque el servicio de push hubiera rechazado **todos** los dispositivos, y la tabla marcaba `lastUsedAt` en todas las suscripciones aunque no se hubiera entregado ninguna. Con eso, cuando las notificaciones no llegan, no hay forma de saber si falla el servidor, el navegador o el sistema operativo: todo dice que fue bien.

Ahora el envío devuelve lo que pasó de verdad —cuántos dispositivos aceptaron, cuántos fallaron y **qué contestó el servicio de push**— y el botón lo enseña: «Aceptado por 2 dispositivos» o el error concreto («invalid JWT», «key does not match»…). `lastUsedAt` solo se marca en los que aceptaron.

`notify()` sigue ignorando el resultado: un push que falla no puede tumbar la acción que lo provocó.

---

## [1.78.0] — 2026-08-25

### Las tareas recurrentes ya avisan

La v1.77.2 hizo que se generaran; faltaba que se supiera. **El cron era el único camino de creación de tareas que no avisaba a nadie**: creaba la tarea, avanzaba la plantilla y ahí terminaba. Ni Google Chat, ni la campana, ni el webhook personal, ni push. La tarea aparecía en silencio, y quien debía hacerla se enteraba si entraba a mirar.

Ahora hace lo mismo que la creación manual:

- **Al canal de tareas de Google Chat**, como «Nueva tarea recurrente» —distinguida a propósito de una creada a mano, porque en el canal importa saber que salió sola—, con proyecto, responsable y fecha de vencimiento.
- **A quien la recibe**: campana, su webhook personal y, desde la v1.77.0, el dispositivo si activó las notificaciones push.

Dos detalles que importan:

- **Lo privado sigue siendo privado.** Una tarea de un proyecto privado no se anuncia en el canal del equipo, igual que en la creación manual; su responsable sí recibe su aviso.
- **Se avisa después de confirmar la transacción**, nunca dentro. Anunciar en Google Chat una tarea que luego revierte es peor que no anunciarla.

#### Comprobado

12 comprobaciones sobre una base desechable con un Google Chat simulado: que el mensaje llega con nombre, proyecto, responsable y vencimiento; que el proyecto privado **no** sale al canal pero su responsable sí recibe la campana; que el enlace apunta a la tarea dentro de su proyecto; y que un segundo barrido no genera ni anuncia nada.

---

## [1.77.2] — 2026-08-25

### Las tareas recurrentes no se generaban: nadie llamaba al cron

El endpoint `/api/cron/recurring-tasks` está bien escrito —incluso se pone al día solo si estuvo caído varios ciclos—, pero **no había nada que lo invocara**. Se construyó esperando un programador externo (en su día, Vercel Cron) y al mudarse la app a un VPS con PM2 ese programador se quedó atrás. En el repositorio no había ningún cron, ni en el despliegue tampoco.

El síntoma en producción: una plantilla mensual activa con `nextRunAt` **diez días vencido**, `lastRunAt` en junio y **una sola tarea generada** en toda la vida de la función.

Ahora lo lanza GitHub Actions una vez al día, a las 06:00 de Colombia, para que las tareas del día estén antes de que empiece la jornada. Va en Actions y no en el crontab del servidor porque este repositorio ya despliega desde ahí: un solo sitio donde mirar cuándo corrió y qué contestó.

**Falla en voz alta.** Si el barrido no devuelve 200, el workflow se marca en rojo y dice qué mirar. Un cron que calla cuando algo va mal es exactamente cómo se llega a dos meses sin generar tareas. También se puede lanzar a mano desde la pestaña Actions sin esperar al día siguiente.

#### Dos cosas que quedan pendientes de configurar

- **`CRON_SECRET`.** Si está vacío en el servidor, `/api/cron/*` queda **abierto a internet**: cualquiera puede disparar la generación de tareas. Debe ponerse en el `.env.local` del servidor **y** como secreto del repositorio, con el mismo valor. Documentado en `.env.example`.
- **`/api/cron/overdue` sigue sin programar.** Está en la misma situación, pero encender ese de golpe mandaría a Google Chat un mensaje por cada elemento vencido —hoy son quince—, así que se deja fuera a propósito hasta decidirlo.

---

## [1.77.1] — 2026-08-25

### El service worker no se podía descargar

Al verificar la v1.77.0: `/sw.js` respondía **307 al login**. El middleware de sesión lo estaba interceptando, y un service worker se descarga **sin cookies**, así que el navegador nunca llegaba a registrarlo y las notificaciones no se habrían podido activar en ningún dispositivo.

Ahora está excluido del middleware, junto a los estáticos. No expone nada: solo escucha avisos, no lee datos.

---

## [1.77.0] — 2026-08-25

### Notificaciones push: cada quien las activa en su dispositivo

En **Mi perfil**, todo el mundo —equipo y clientes— tiene ahora un interruptor para recibir los avisos en el móvil o el escritorio aunque tenga la pestaña cerrada.

#### No hay un catálogo nuevo de avisos

Va enganchado a `notify()`, así que **lo que ya llegaba a la campana llega ahora al dispositivo**: asignaciones, menciones, comentarios, vencimientos. No hubo que tocar ninguno de los sitios que avisan, y no queda una segunda lista de «avisos push» que mantener en paralelo.

#### Se activa por dispositivo, no por cuenta

El navegador da una suscripción distinta en el móvil y en el portátil, y el permiso lo concede cada uno. Por eso la pantalla habla de «este dispositivo»: activarlo en el portátil no lo activa en el teléfono.

El permiso se pide **dentro del clic**, no al cargar la página: pedirlo al entrar hace que los navegadores lo ignoren, y molesta. Hay además un botón para **enviarse un aviso de prueba**, porque activar algo y no ver nunca nada deja la duda de si funcionó.

#### Lo que se cuidó

- **Un push que falla no tumba lo que lo provocó.** Igual que los hooks: asignar una tarea no depende de que el móvil de alguien esté accesible.
- **Las suscripciones se limpian solas.** Cuando el servicio de push responde que el endpoint ya no existe (404/410) —se limpió el navegador, se desinstaló— la fila se borra. Si no, cada aviso paga por dispositivos que ya nadie usa.
- **Un navegador que cambia de cuenta cambia de dueño.** El endpoint es único: si alguien inicia sesión con otro usuario en el mismo equipo, la suscripción se reasigna en vez de duplicarse. Sin esto, seguiría recibiendo los avisos del usuario anterior.
- **El service worker no cachea nada.** Solo escucha avisos. Un service worker que cachea rutas de una app con sesión es una forma conocida de enseñarle a alguien los datos de quien usó el navegador antes.

#### Falta un paso que no puedo dar yo

Las claves VAPID viven en el `.env.local` **del servidor**, que el despliegue excluye a propósito para no pisarlo. Mientras no estén, la app funciona igual: el interruptor dice que falta configurarlo y no se intenta enviar nada. Las instrucciones y las variables están en `.env.example`.

#### Comprobado

14 comprobaciones: que sin claves no se rompe nada y las notificaciones normales siguen creándose; que un endpoint no se duplica y se reasigna al nuevo dueño; que al borrar a alguien se van sus dispositivos; y, con claves puestas contra un servidor de push simulado por TLS, que **el cuerpo viaja cifrado y firmado con VAPID** y que el dispositivo que responde 410 se borra mientras el vivo se conserva.

---

## [1.76.3] — 2026-08-24

### Los tableros se quedaban con las tarjetas viejas al cambiar de filtro

**El diagnóstico de la v1.76.2 estaba equivocado y esta versión lo corrige.** Allí se culpó al caché y se marcaron cinco páginas del CRM como `force-dynamic`; no era eso, no arregló nada, y esos cinco marcados se revierten.

Lo que pasaba de verdad se vio pidiendo el payload del servidor a mano: **llegaba correcto, con la oportunidad ganada dentro**. El fallo estaba en el navegador.

`useState(props)` solo usa su valor inicial **la primera vez**. Al navegar dentro de la misma pantalla —pulsar «Ver cerradas», cambiar un filtro— React reutiliza el componente, así que las columnas nuevas se pintaban con las tarjetas de antes: seis columnas y las dos oportunidades de siempre. Recargando con otra URL sí salía, porque eso monta el componente de cero.

Arreglado con el patrón que documenta React para sincronizar estado con props: ajustar durante el render, no en un efecto, que causaría un parpadeo.

**El mismo fallo estaba en los tres tableros** —oportunidades, tickets y tareas—, porque el del CRM se escribió copiando el de tareas. Los tres quedan corregidos.

---

## [1.76.2] — 2026-08-24

### ~~La oportunidad ganada tampoco salía al mostrar las cerradas~~ (diagnóstico erróneo)

Se atribuyó al caché de navegación y se añadió `force-dynamic` a cinco páginas del CRM. **No era la causa y no lo arregló.** Ver la v1.76.3: era `useState` sin sincronizar con las props. Los `force-dynamic` de esta versión quedan revertidos.

---

## [1.76.1] — 2026-08-24

### El tablero dice lo que está escondiendo

Marcar una oportunidad como ganada la hacía **desaparecer del tablero sin decir a dónde**. El filtro era correcto —las ganadas y perdidas se acumulan sin límite y en unos meses taparían el pipeline— pero aplicarlo en silencio no: quien acaba de cerrar una venta va al tablero a verla y no está.

Ahora el tablero cuenta lo que deja fuera: **«1 cerrada oculta»** junto al resumen, enlazado, y el botón pasa a decir **«Ver cerradas (1)»**. El filtro no cambia; deja de ser invisible.

Una oportunidad cerrada sigue viéndose siempre en la ficha de su cuenta, atenuada, junto a las demás.

---

## [1.76.0] — 2026-08-24

### Teléfonos en formato internacional y correo obligatorio

Los dos cambios apuntan a lo mismo: que la lista de contactos sirva para **enviar una campaña** y no solo para consultarla.

#### El teléfono se guarda en E.164

Un teléfono sirve para llamar aunque esté escrito como sea; para una campaña no. WhatsApp, los SMS y cualquier pasarela quieren `+573001234567`. Si en la base pone «300 123 4567» hay que adivinar el país al exportar, y adivinar sobre miles de contactos sale mal.

Ahora el formulario tiene un **selector de indicativo** —Colombia por defecto, y once países más— junto al número, y se normaliza **al guardar**, no al enviar: así el error se ve en el formulario y no seis meses después en un envío fallido. Se acepta lo que la gente escribe de verdad: con espacios, guiones, paréntesis, con `00` delante en vez de `+`, o con el `0` de larga distancia, que no forma parte del número internacional.

En pantalla se lee agrupado (`+57 300 123 4567`); lo que se guarda y se exporta no lleva espacios.

No se añadió ninguna librería: E.164 cabe en unas pocas reglas —`+`, de 8 a 15 dígitos, indicativo delante— y lo que una librería aportaría de más, saber si el número existe en ese país, no lo sabe nadie hasta que se marca.

#### El correo pasa a ser obligatorio

Un contacto sin correo no entra en una campaña ni puede recibir acceso al portal, así que crearlo solo aplaza el problema. Es obligatorio en los formularios, en la API y **en la base**.

#### La migración se niega a inventar datos

El teléfono se arregla solo: se normaliza lo que hay y lo que no llegue a parecer un número se deja vacío, antes que guardar basura con pinta de válida.

El correo no se puede arreglar solo. Poner `NOT NULL` sobre una columna con nulos exige inventarse un valor, y un correo inventado en un CRM acaba en un envío a la nada. Así que si hay contactos sin correo **la migración se para y dice cuántos son y cómo listarlos**; se rellenan y se vuelve a lanzar. Fallar es peor que continuar en casi todo, menos en fabricar datos.

En producción los dos contactos que hay ya tenían correo y el teléfono en E.164, así que para ellos la migración no cambia nada.

#### Esto rompe la API

`POST /accounts/:id/contacts` **exige ahora `email`**. Es un cambio incompatible y va anunciado en la referencia. Hay una llave activa con permiso de escritura; si tiene un workflow que crea contactos sin correo, dejará de funcionar hasta que lo mande.

El campo `phone` sigue aceptándose escrito de cualquier forma y se guarda normalizado; se puede mandar `phoneDial` para los números sin indicativo.

#### Comprobado

29 comprobaciones: los siete formatos de entrada que se normalizan, los cuatro que se rechazan con su motivo, la ida y vuelta entre E.164 y pantalla, que la API rechaza sin correo y con teléfono imposible **sin dejar nada creado a medias**, y que el payload de los webhooks viaja en E.164.

La migración se probó dos veces sobre datos sucios: una con siete teléfonos mal escritos —todos normalizados o descartados— y otra con contactos sin correo, para ver que **se para sin perder nada** y que tras rellenarlos aplica bien.

---

## [1.75.1] — 2026-08-24

### La tarjeta de tareas vencidas estaba vacía teniendo 15

Salía al verificar la v1.75.0: la banda de arriba decía «15 tareas vencidas» y la tarjeta de abajo no mostraba ninguna.

Las vencidas no se consultaban: se sacaban **filtrando las 6 tareas más recientes**, así que bastaba con que ninguna de esas 6 lo estuviera para que la lista quedara vacía. Venía de antes del rediseño, pero ahí no se notaba porque la tarjeta simplemente no se pintaba; ahora que la banda anuncia la cifra, el hueco cantaba.

Ahora tienen su propia consulta, ordenadas por la más vencida primero.

---

## [1.75.0] — 2026-08-24

### El inicio, más limpio

El problema no era el estilo: era que **la misma cifra aparecía dos y tres veces**. «Tickets 101» estaba en la tarjeta del módulo y otra vez en un KPI. El 93 % de tareas completadas salía en «Estado de tareas» y de nuevo en «Resumen de productividad». Las 15 vencidas y los 32 proyectos activos, igual. Cuatro pantallas de scroll para decir lo mismo tres veces.

#### Lo urgente se dice una vez, arriba

Una banda de **«Requiere atención»** abre la página con lo que de verdad hay que mirar hoy —tareas vencidas, por vencer, planes vencidos, por vencer—, cada cifra enlazada a donde se resuelve. Lo de más abajo pasa a ser **el detalle de esa banda**, no una segunda cuenta en paralelo.

Si no hay nada urgente, no se pinta nada. Un aviso que sale siempre deja de leerse a la semana.

#### Fuera lo repetido

- **La fila de cuatro KPI desaparece.** Las tarjetas de módulo ya decían lo mismo y además llevan a alguna parte.
- **«Resumen de productividad» desaparece.** Sus cuatro cifras estaban las cuatro más arriba. Queda un enlace a Productividad, que es donde se analizan de verdad.
- **Las cuatro tarjetas de alerta se vuelven dos:** las de tareas juntas, las de planes juntas.

#### Y el hueco vacío

El grid de abajo estiraba todas las tarjetas a la misma altura, así que «Por vencer (1)» ocupaba una columna entera para una sola fila. Ahora cada tarjeta mide lo que ocupa.

#### Por dentro

La página pasa de **804 a 623 líneas**. Las cuatro alertas repetían el mismo marcado copiado cuatro veces; ahora hay un `AlertCard` que admite varias listas dentro. Y se cayó una consulta: el conteo de usuarios activos solo alimentaba el KPI que ya no existe, así que el inicio hace **una consulta menos** por carga.

---

## [1.74.1] — 2026-08-23

### Los contactos ya salen en el buscador ⌘K

Faltaba justo lo que más se busca por nombre: una persona. Ahora aparecen bajo CRM, junto a cuentas y oportunidades.

Se busca por nombre, apellido, correo y **también por teléfono** — que es como se llega a un contacto cuando entra una llamada de un número que no se reconoce. El resultado dice de qué empresa es, qué cargo tiene y si ya entra al portal, y lleva a la ficha de su cuenta, que es donde se hace algo con esa persona.

Se aplican las mismas reglas que al resto: sin el módulo CRM concedido la consulta ni se lanza, un cliente no los ve nunca, y los contactos dados de baja no aparecen.

---

## [1.74.0] — 2026-08-22

### Los contactos tienen nombre y apellidos separados

Un solo campo servía para apuntar, pero no para trabajar: no se puede ordenar la agenda por apellido, ni buscar solo por él, ni escribir «Hola Ana» en un correo sin adivinar dónde termina el nombre.

Ahora son dos campos. **El nombre es obligatorio y los apellidos no**: a veces se apunta a alguien en plena llamada sabiendo solo cómo se llama. El listado se ordena por apellido, como cualquier agenda, y la búsqueda mira los dos.

#### La migración no pierde nombres

La que genera Prisma para este cambio elimina `name` y añade `first_name NOT NULL` de golpe: sobre una tabla con filas **falla**, y si no fallara se llevaría los nombres por delante. Está escrita a mano en cuatro pasos —columnas nulables, reparto, obligatoria, borrado del campo viejo— para que no se pierda nada.

El corte es por el **primer** espacio: lo de antes es el nombre y lo de después son los apellidos. Es lo correcto en español, donde son dos: «Ana Pérez Gómez» da «Ana» + «Pérez Gómez». Cortar por el último dejaría «Ana Pérez» de nombre.

Probada sobre una copia con los casos que rompen: un nombre solo («Madonna» → sin apellidos), espacios de más («  Luis   Carlos  Ruiz  » → «Luis» + «Carlos Ruiz», ya normalizado), y un nombre en blanco, que en vez de romper la migración queda como «Sin nombre». En producción hay **0 contactos**, así que no había nada que repartir — pero la migración tiene que ser correcta igual.

#### La API no rompe a quien ya la usa

`POST /accounts/:id/contacts` acepta ahora `firstName` y `lastName`, **y sigue aceptando `name` entero**, que parte igual que la migración. Quitar un campo de una API pública rompe integraciones ajenas y aquí no hacía falta.

Lo mismo en los webhooks: el payload de un contacto **mantiene `name`** —compuesto, aunque en la base ya no exista esa columna— y añade `firstName` y `lastName`. Es la regla escrita en `payload.ts` desde el principio: añadir campos es seguro, quitarlos no.

#### Comprobado

22 comprobaciones: el reparto y sus casos raros, que los contactos migrados se leen enteros, que la API funciona por las dos vías y falla si no llega ninguna, que el payload conserva `name`, que la agenda ordena por apellido y busca por él, y que al dar acceso al portal el usuario se crea con la persona entera.

---

## [1.73.1] — 2026-08-21

### Solo una entrada del menú resaltada a la vez

Estando en Contactos u Oportunidades, **«Cuentas» seguía iluminada también**. Cada entrada comprobaba por su cuenta si la ruta empezaba por su enlace, y la raíz de un módulo —`/crm`— es prefijo de todo lo que cuelga de ella.

Ahora se resalta una sola: la del prefijo más largo que case. Venía de la v1.70.0, cuando el CRM dejó de tener una única sección.

---

## [1.73.0] — 2026-08-21

### Contactos: sección propia y paso a usuario del portal

#### Los contactos ya no viven escondidos

Se podían crear desde el primer día, pero solo entrando en la ficha de una cuenta. Buscar a alguien exigía recordar antes en qué empresa estaba, **y casi siempre se recuerda antes el nombre de la persona**.

Ahora el CRM tiene su sección **Contactos**: todas las personas en un listado, con buscador por nombre, correo, teléfono o empresa, y un filtro para ver solo quienes ya tienen acceso al portal. Desde ahí se crea un contacto eligiendo la cuenta, que es el camino inverso al de la ficha y el que se sigue cuando la persona llega antes que la empresa.

#### Un contacto puede convertirse en usuario

Es el puente entre las dos formas que tiene alguien de existir aquí: un contacto es de la agenda comercial y no entra a ningún sitio; un usuario sí. En vez de duplicar a la persona, **se enlazan** — por eso `Contact` lleva `userId` desde el primer día.

Con el correo puesto aparece «Dar acceso al portal» en la ficha de la cuenta. La contraseña no la pone nadie: se manda la misma invitación que usa Administración para que la persona la establezca.

**Qué no puede hacer esta puerta.** Crear credenciales es lo más delicado del CRM, así que está acotado por cuatro reglas, no por confianza:

- El usuario nace **siempre CLIENTE** y **siempre atado a la empresa de la cuenta**. No se puede elegir rol ni empresa, así que llevar el CRM no permite fabricarse un colaborador ni un administrador.
- Si ya existe un usuario con ese correo **no se crea otro**: se enlaza con quien ya está y se le suma la empresa. Duplicar personas por correo es como se corrompe una base de clientes.
- Si el correo es de **alguien del equipo**, se rechaza. Enlazarlo no le daría más poder —ya lo tiene—, pero ataría su cuenta a una empresa desde el CRM, y eso lo decide Administración.
- Un correo no puede reflejar a **dos contactos**.

Pide nivel **Gestor** en el CRM: no basta con poder editar.

Queda apuntado en el historial de la cuenta, con quién lo hizo y cuándo — dentro de seis meses alguien lo preguntará.

#### Por dentro

La lógica vive en `src/lib/crm/portal-access.ts` y no dentro de la Server Action, porque una función normal se puede probar de verdad y una Server Action arranca pidiendo sesión. **24 comprobaciones** sobre base desechable cubren las cuatro reglas y los rechazos: sin correo, contacto de otra cuenta, invitar dos veces, correo de staff, correo ya enlazado.

Una de esas pruebas cambió el diseño: en la primera versión, enlazar con la cuenta de un administrador **funcionaba**. No escalaba privilegios, pero dejaba a un miembro del equipo figurando como contacto-cliente y con una empresa atada desde el CRM. Ahora se rechaza.

---

## [1.72.2] — 2026-08-21

### El buscador ahora se ve

Como botón pequeño y apagado se perdía en una barra casi vacía. El problema era de forma, no de tamaño: **nadie busca un botón, se busca la caja donde escribir**.

Ahora es un campo de búsqueda: ancho, con fondo propio, el texto «Buscar tickets, tareas, proyectos…» a la vista y el atajo `⌘K` a la derecha. Se ilumina al pasar por encima. Al pulsarlo se abre la misma paleta de siempre, que es donde se escribe de verdad.

En móvil se queda como icono, donde el ancho hace falta para otras cosas.

---

## [1.72.1] — 2026-08-21

### Los estados del buscador, con sus tildes

Derivar el texto del enum (`EN_REVISION` → «En revision») se comía las tildes, y en un resultado de búsqueda se nota. Los estados ahora salen de `src/lib/status-labels.ts`, escritos como se leen. Las insignias de cada módulo conservan sus mapas porque además llevan color e icono; este es solo el texto, para quien únicamente necesita eso.

---

## [1.72.0] — 2026-08-21

### Buscador global ⌘K — cierra la Fase 2

Con la app partida en módulos, encontrar algo obligaba a acordarse primero de en cuál vivía. Ya no: se pulsa **⌘K** (Ctrl+K en Windows) desde cualquier pantalla, se escribe, y aparece lo que haya —tickets, tareas, proyectos, cuentas, oportunidades, sitios, empresas y usuarios— agrupado por módulo para no perder de vista dónde está cada cosa.

El atajo también está escrito en un botón de la barra superior y es un paso del tour. Un atajo que nadie ve no existe.

Se navega con ↑ ↓ y se abre con ↵. Busca a partir de tres letras: por debajo casi todo coincide y el resultado no ayuda.

#### El buscador no puede ser la rendija

Dos reglas lo sostienen:

- **Un módulo al que no tienes acceso no se busca.** Sus resultados no es que se oculten al pintarlos: la consulta ni se lanza.
- **La frontera de datos es la de siempre.** Un proyecto privado del que no eres miembro no aparece, el borrador de otro tampoco, y un cliente encuentra los tickets de su empresa pero ninguno de otra.

#### Las reglas de visibilidad ahora viven en un solo sitio

El buscador lee de seis sitios a la vez, y si la lista de proyectos y el buscador definieran por separado quién ve qué, tarde o temprano una de las dos se quedaría vieja y enseñaría de más. Las reglas se extrajeron a `src/lib/search/scopes.ts` y **las páginas de Proyectos y Tareas ahora las importan de ahí**, en vez de tener cada una su copia.

Se comprobó con 24 pruebas sobre una base desechable. Seis comparan, para administrador, colaborador y cliente, que las reglas extraídas devuelven **exactamente el mismo conjunto** que la lógica que estaba escrita a mano en cada página. El resto ataca la frontera desde fuera.

#### Dos cosas que las pruebas destaparon

- **Un módulo que aún no aplica niveles no se puede filtrar por nivel.** Tickets y Portal siguen decidiendo por rol (`enforced: false` en el registro), así que exigirles un nivel habría dejado el buscador **más cerrado que el propio módulo**: hay dos clientes sin perfil que ven sus tickets en pantalla y no habrían encontrado ninguno. Ahora el buscador usa el criterio de cada módulo, y cuando Tickets se migre, se ajustará solo.
- **Los borradores propios sí se buscan.** La regla que se reutilizó venía de la API, que se los niega al cliente; la página de tickets sí los muestra. Manda la página: cada quien encuentra sus propios borradores, y los de nadie más.

---

## [1.71.1] — 2026-08-21

### Textos de Integraciones al día

Dos frases se quedaron viejas al añadir el CRM: los hooks de organización decían recibir «tickets, tareas, proyectos y comentarios», y la introducción ponía «un CRM» como ejemplo de lo que se arma fuera de la plataforma — cuando ahora hay uno dentro. Los ejemplos son otros: avisar por WhatsApp, mandar una propuesta, facturar.

---

## [1.71.0] — 2026-08-21

### El CRM se conecta: API y webhooks

No se montó un sistema aparte. El CRM entra en la integración que ya existía —las mismas llaves `gnr_`, los mismos hooks, la misma firma— porque quien ya tenga un workflow contra los tickets no debería aprender dos APIs.

#### Trece eventos nuevos

`account.created`, `account.updated`, `account.stage_changed`; `contact.created/updated/deleted`; `deal.created`, `deal.updated`, `deal.stage_changed`, `deal.won`, `deal.lost`, `deal.deleted`; y `activity.logged`.

Aparecen solos en el selector de hooks: el catálogo vive en código, así que añadir un evento nunca fue una migración.

Dos decisiones que se notan al integrar:

- **Ganar y perder mandan dos eventos.** El cambio de etapa, para quien sigue el pipeline entero, y `deal.won` / `deal.lost` aparte — así enganchar una venta cerrada a facturación no obliga a filtrar por etapa del otro lado.
- **Nada del CRM se ofrece en un hook de proyecto.** Una oportunidad es de una empresa, no de un proyecto; ofrecerla ahí solo generaría hooks mudos. Es el mismo criterio que ya se aplicaba a los tickets.

#### Seis endpoints

```
GET  POST   /api/v1/accounts
GET  PATCH  /api/v1/accounts/:id
GET  POST   /api/v1/accounts/:id/contacts
GET  POST   /api/v1/accounts/:id/activities
GET  POST   /api/v1/deals
GET  PATCH  /api/v1/deals/:id
```

Los dos que justifican todo esto:

- **`POST /accounts`** deja un lead desde un formulario web o un chatbot. **Un nombre repetido devuelve la cuenta que ya existe** en vez de fallar o duplicar: los formularios se envían dos veces todo el tiempo, y un duplicado en el CRM cuesta más que una llamada idempotente. Sin `stage`, entra como `LEAD` — nadie conecta un formulario para registrar clientes ya cerrados.
- **`POST /accounts/:id/activities`** apunta una llamada o un correo desde la centralita o el buzón. `occurredAt` es opcional porque un sistema que avisa en el momento no tiene que calcular la fecha.

`PATCH /deals/:id` con `stage` mueve la oportunidad igual que arrastrar la tarjeta: sella o borra `closedAt` y dispara los mismos eventos. Mover por API y mover en el tablero dejan exactamente lo mismo.

#### Una llave no es un permiso aparte

Hereda lo que su dueño puede hacer en el CRM, resuelto con el mismo `can()` que usan las pantallas: `read` exige nivel Lectura, `write` exige Miembro. Si a alguien se le retira el módulo, **sus llaves dejan de leer el CRM en la siguiente llamada**, sin revocar nada. Y como el rol es el techo, una llave de cliente no entra aunque tenga el perfil comercial.

El guardia va dentro de cada función y no en las rutas, para que una ruta nueva no pueda olvidarse de comprobarlo.

#### Comprobado

47 comprobaciones sobre una base desechable, centradas en la frontera:

- sin el módulo concedido no se lee; con Lectura se lee pero no se escribe; una llave de cliente no entra ni con perfil comercial;
- un contacto o una oportunidad de **otra cuenta** no cuela en ninguna de las tres rutas que los aceptan;
- cerrar sella la fecha, reabrir la borra junto con el motivo de pérdida, y `open=true` devuelve lo vivo;
- la documentación cubre las seis rutas, sin `operationId` repetidos.

### Un Postgres local sin TLS ya sirve para pruebas

`prisma.ts` forzaba SSL siempre, así que no había forma de apuntar a una base local: el adaptador intentaba negociar cifrado contra un servidor que no lo ofrece. Ahora SSL sigue activado por defecto —RDS lo exige— y solo se desactiva si la URL dice `sslmode=disable`. La URL de producción no lleva ese parámetro, así que para ella no cambia nada.

---

## [1.70.0] — 2026-08-21

### Fase 3, paso 2: el pipeline y el historial

El paso 1 dejó registrar **con quién** se habla. Este añade **qué se está vendiendo** y **qué ha pasado**.

#### Una oportunidad no es una cuenta

Son cosas distintas a propósito. La cuenta es la relación con la empresa; la oportunidad es una venta concreta, con su valor y su fecha de cierre. Por eso una misma empresa puede tener **varias abiertas a la vez**, y un cliente de años puede tener una oportunidad nueva sin dejar de ser cliente.

Etapas: Nueva → Contactada → Propuesta → Negociación, y dos terminales, Ganada y Perdida. Entrar en una terminal sella `closedAt`; **sacarla de ahí lo borra**, para que reabrir una oportunidad la devuelva de verdad al pipeline en vez de dejarla cerrada con otra etiqueta.

Marcarla como perdida **pide el motivo en el momento**, con un campo en línea. Preguntarlo después no funciona, y con los meses es el dato que más enseña del pipeline.

#### El tablero

`/crm/oportunidades` es un kanban con el mismo arrastrar de los tableros de tareas y tickets. Cada columna muestra **cuánto hay puesto en esa fase**, no solo cuántas tarjetas: es la pregunta que uno se hace al mirar un pipeline.

Por defecto solo se ven las abiertas. Las ganadas y perdidas se acumulan sin límite y en unos meses taparían lo vivo; se muestran con «Ver cerradas».

#### El historial

Llamadas, correos, reuniones, WhatsApps y notas, con **cuándo ocurrió de verdad** — que no es cuándo se apuntó. Se registra siempre contra la cuenta y, si la hubo, también contra la oportunidad: así la ficha de la cuenta enseña el historial completo sin unir dos listas, y la de la oportunidad solo lo suyo.

Se apunta en línea, sin salir de la ficha, porque se escribe justo después de colgar.

#### Qué se comprobó antes de desplegar

Migración puramente aditiva: **no toca ninguna tabla existente**. Probada sobre una copia del esquema anterior, y después 16 comprobaciones sobre los borrados, que es donde esto se rompe de verdad:

- Borrar un **contacto** deja la oportunidad viva y sin contacto — no se lleva la venta por delante.
- Borrar una **oportunidad** se lleva su actividad, y **no** la actividad suelta de la cuenta ni las demás oportunidades.
- Borrar una **cuenta** no deja oportunidades ni actividad colgando.

En producción: 33 migraciones registradas, 0 problemáticas, y nada de lo que la migración crea existía ya.

### La cifra del inicio ahora mira el pipeline

La tarjeta del CRM prioriza lo que está en curso: primero las oportunidades abiertas, luego los leads y prospectos en seguimiento, y el total de clientes solo como respaldo.

---

## [1.69.1] — 2026-08-21

### La tarjeta del CRM en el inicio ya dice algo

Era la única de las cinco sin cifra: las demás anuncian qué espera dentro («7 sin cerrar», «16 tareas vencidas») y el CRM solo repetía su descripción.

Ahora muestra **lo que pide seguimiento** — leads y prospectos sumados — y, cuando no hay ninguno abierto, el total de clientes. Misma prioridad que el resto del inicio: primero lo que está en curso, el total como respaldo.

La consulta (`groupBy` por etapa) solo se lanza si el usuario tiene el módulo concedido, así que para quien no tiene CRM el inicio no paga nada por esto.

### Verificado en producción (v1.69.0)

- La migración quedó aplicada: **43 empresas** pasaron a `CLIENTE` por el DEFAULT, tabla `contacts` creada.
- El selector de empresa de **Nuevo proyecto** sigue ofreciendo las mismas **43** — el filtro operativo no cambió nada de lo que ya funcionaba.
- El CRM aparece en el selector de módulos como módulo real, ya no como «Próximamente».

---

## [1.69.0] — 2026-08-20

### Fase 3: nace el CRM — cuentas y contactos

Primer paso del módulo. Se pueden registrar prospectos, seguir su etapa comercial y guardar sus contactos.

#### Un prospecto es una `Company`, no una entidad aparte

La decisión de diseño que sostiene todo lo demás: en vez de un modelo «Lead» separado, `Company` gana una **etapa** — Lead, Prospecto, Cliente o Inactivo.

Así, cuando un prospecto se gana **no hay conversión ni duplicado**: la misma empresa pasa a Cliente y conserva su historial, sus contactos y —desde ese momento— sus proyectos, tickets y planes. Un año después, quien atienda un ticket puede ver por qué se vendió lo que se vendió.

La ficha de cada cuenta muestra esa relación: cuántos proyectos, tickets, planes y sitios tiene ya.

#### Los leads no se cuelan donde no deben

Reutilizar `Company` tiene un riesgo: un lead no es cliente todavía, así que no debe aparecer al elegir «la empresa» de un proyecto, un plan o un sitio. Se añade un filtro único (`operationalCompanyWhere`) aplicado en **15 pantallas**: selectores de proyecto, plan, sitio, servicio, usuario y bóveda, más los desplegables de filtro de listados.

**Nada cambia hoy**: el backfill deja en Cliente todas las empresas existentes, así que los selectores siguen mostrando exactamente lo mismo. El filtro solo actúa sobre los leads que se creen de ahora en adelante.

#### Contactos

Personas de contacto por cuenta, con correo, teléfono y cargo, y una marca de contacto principal. No son usuarios del sistema: son la agenda comercial. El modelo ya prevé enlazarlos con un `User` si más adelante se les invita al portal.

#### El módulo deja de estar «Próximamente»

`CRM` pasa a construido en el registro de módulos y aparece activo en el selector, gobernado por la capa de permisos desde el primer día. Solo lo ven administradores y colaboradores con nivel concedido; el perfil **Comercial** ya lo traía en Gestor desde la v1.48.0.

#### Pendiente para el siguiente paso

El embudo de oportunidades (`Pipeline`, `Deal`) y la bitácora de actividad. Van en su propia migración para poder verificarlos por separado.

---

## [1.68.1] — 2026-08-20

### Corrige: la referencia de la API se veía mal en tema oscuro

Tres cosas, y la de fondo explica las otras dos.

**Los ajustes de tema no se aplicaban nunca.** Estaban colgados de `prefers-color-scheme`, la preferencia del **sistema operativo**, cuando el tema de la aplicación lo decide `next-themes` con una clase en `<html>` — y el oscuro es el predeterminado. Quien tuviera el sistema en claro y la app en oscuro, que es lo habitual, veía Swagger UI sin ningún ajuste. Ahora dependen del tema real de la app.

**El candado no se veía.** Su icono usa `fill="currentColor"` y el botón resolvía a negro: negro sobre azul oscuro. Ahora sigue el color del texto, y el candado cerrado se queda verde para que se distinga de un vistazo del abierto.

**El icono de copiar salía duplicado.** No era un icono sino dos capas: una imagen de fondo con el glifo y, encima, un `<svg>` con `fill="#ffffff"` fijo. Sobre fondo claro se leen como una sola pieza, pero en oscuro quedaban desalineadas. Ahora es una sola capa que sigue al color del texto, y se comprobó que se ve en los dos temas — quitar solo el fondo lo habría dejado invisible en el claro.

---

## [1.68.0] — 2026-08-20

### Documentación de la API al estilo Swagger

La guía de integración explica el porqué y da el paso a paso, pero no servía para responder «¿qué campos acepta exactamente este endpoint?». Ahora hay lo otro: el contrato, campo por campo.

**Referencia interactiva** en Administración → Integraciones del equipo → *Referencia interactiva*. Es Swagger UI sobre esta misma instalación: se pulsa *Authorize*, se pega el token de una llave y cada endpoint se puede lanzar de verdad con *Try it out*. Los 17 endpoints llevan descripción, ejemplos de cuerpo —incluido el caso «en nombre de un cliente»— y el detalle de cada código de error.

**Y el spec crudo** en `GET /api/v1/openapi.json`, sin llave. Es OpenAPI 3.0.3 válido, así que se importa tal cual en Postman, Insomnia o el nodo *HTTP Request* de n8n, y sirve para generar clientes.

El documento se arma en código a partir de los mismos enums que usa el servidor —permisos, estados, prioridades—, así que no puede desfasarse respecto a lo que la API acepta de verdad. Y Swagger UI se sirve desde la propia instalación, no desde un CDN: la pantalla funciona en una red cerrada y no le pide nada a terceros.

#### Corrige: `public/` quedaba detrás del inicio de sesión

Al montar esto salió a la luz que el middleware de sesión interceptaba también los archivos estáticos servidos desde `public/`: el navegador recibía un redirect a `/login` en vez del archivo. Solo se notaba con recursos nuevos —los `.png` ya estaban exceptuados—, pero era un problema esperando a la siguiente carpeta que se añadiera ahí.

---

## [1.67.0] — 2026-08-20

### Los tickets que entran por la API nacen «Por asignar»

Dos ajustes sobre `POST /api/v1/tickets`, que hasta ahora no dejaba decidir el estado y elegía uno discutible.

**El estado ya se puede mandar en el cuerpo**, con `status`. Acepta los cinco valores de siempre y sigue siendo cosa del equipo: si la llave actúa como cliente —por su cuenta o vía `onBehalfOf`—, mandar un estado distinto de `POR_ASIGNAR` devuelve un `403`, el mismo freno que aplica la interfaz.

**Y sin `status`, el ticket nace `POR_ASIGNAR`.** Antes solo salía así cuando lo abría un cliente; con una llave del equipo nacía `ABIERTO`, es decir, ya triado. Era un mal defecto: un ticket que llega desde WhatsApp o desde un formulario no tiene dueño todavía y tiene que pasar por la misma bandeja que el resto, no colarse como si alguien ya lo hubiera revisado.

---

## [1.66.1] — 2026-08-20

### Corrige: cuatro de cada diez llaves de API no servían

Regresión de la v1.66.0, el mismo día. El validador del token lo partía por **todos** los guiones bajos esperando exactamente tres trozos (`gnr_`, prefijo, secreto), pero el secreto se genera en base64url — un alfabeto que **sí incluye** `_`. Cerca del 40 % de las llaves nacían con uno dentro y quedaban rechazadas antes de llegar a la base.

El síntoma despistaba: la respuesta decía «Falta la cabecera Authorization», así que el problema parecía estar en quien llamaba —una cabecera mal puesta en Postman o en n8n— y no en la llave.

Ahora el corte es por los dos primeros guiones bajos y el mensaje distingue entre no mandar cabecera y mandar un token mal formado. **Las llaves ya creadas funcionan sin tocarlas**: el hash se calcula sobre el token entero, que nunca cambió.

---

## [1.66.0] — 2026-08-20

### Las integraciones se hacen por fuera: hooks y API

Hasta ahora, conectar la plataforma con un canal significaba construir ese canal **dentro** del producto. Es lo que era el agente de WhatsApp: su prompt, la memoria de cada conversación, la vinculación teléfono→usuario y su forma de crear tickets vivían en este repositorio. Funcionaba, pero cada canal nuevo —Slack, Telegram, un CRM— pedía otro agente aquí dentro, y cambiar el tono de una respuesta obligaba a desplegar la aplicación entera.

A partir de esta versión la plataforma hace dos cosas y las hace bien: **cuenta lo que pasa** y **deja escribir**. Lo que se haga con eso se decide fuera.

#### Hooks salientes

Un hook es un destino externo suscrito a eventos con nombre —`ticket.created`, `task.status_changed`, `comment.created`— que llegan como un POST firmado con HMAC SHA-256.

- **Dos alcances.** Los de **organización** (Administración → Integraciones del equipo) reciben todo; los de **proyecto** (ficha del proyecto → Hooks), solo lo suyo.
- **Los proyectos privados no se filtran.** Sus eventos llegan únicamente a los hooks de su propio proyecto, nunca a los de organización — el mismo criterio que ya aplicaba el canal de equipo en Google Chat.
- **Se puede depurar.** Cada tarjeta guarda las últimas entregas con su código HTTP, su error y su duración. Antes, una integración que fallaba en silencio no dejaba dónde mirar.
- Un `5xx` se reintenta una vez; un `4xx` no, porque es una decisión del destino y no un problema pasajero.

Los borradores no disparan nada y las notas internas tampoco: si un cliente no lo ve en el hilo, no sale de la plataforma.

#### API de entrada

`/api/v1` con llaves que se administran desde el panel. Permite listar y crear tickets, tareas y comentarios, y consultar proyectos y usuarios.

- **Una llave escribe en nombre de un usuario**, no como un superusuario anónimo. Ve exactamente lo que esa persona vería en la plataforma, y lo que crea queda con su autor.
- **`onBehalfOf`** atribuye lo creado a otra persona —por su id o su correo— para bots que atienden a varios clientes. Exige el permiso `act_as`.
- **`externalRef` hace idempotente la creación de tareas**: si el workflow reintenta, devuelve la que ya creó en vez de duplicarla.
- El token se muestra **una sola vez**; en la base solo queda su hash.

Se conserva el contrato de negocio de la interfaz: un cliente sin plan activo no abre tickets, un cliente no asigna ni cierra, y los avisos que salen son los mismos que si el ticket se hubiera abierto desde el navegador.

#### Se retira el agente de WhatsApp

Desaparecen el endpoint, el agente, el editor de instrucciones, la vinculación por código y el campo de teléfono del usuario. **Es un cambio con pérdida de datos**: la migración borra las conversaciones guardadas, los números vinculados y el prompt personalizado.

Lo que hacía el bot se rehace fuera con lo de arriba, y la guía (Administración → Integraciones del equipo → *Ver la guía de hooks y API*) explica cómo, paso por paso. A cambio, cambiar de proveedor de WhatsApp, de modelo o de tono deja de ser un despliegue, y el mismo montaje sirve para Telegram o Slack sin escribir una línea aquí.

Los webhooks personales de **Mis integraciones** no cambian: siguen mandando *tus* notificaciones a *tus* apps.

---

## [1.65.0] — 2026-08-19

### El inicio muestra tus módulos

Completa la Fase 2. Desde la v1.59.0 el inicio es el punto neutro desde el que se elige dónde trabajar, pero la única forma de cambiar de módulo era abrir el selector del menú. Ahora los módulos están a la vista, cada uno con una cifra que responde «¿qué me espera ahí?» antes de entrar.

- **Tickets** — cuántos hay sin cerrar.
- **Proyectos** — proyectos activos, o **tareas vencidas en rojo** si las hay: lo que pide atención manda sobre lo que solo informa.
- **Administración** — planes vencidos, cuando los hay.

Solo aparecen los módulos concedidos, y el CRM no se ofrece mientras no esté construido.

#### Las estadísticas del inicio ya respetan los niveles

Las tarjetas de Tickets, Proyectos, Tareas y Usuarios se decidían **solo por el rol**, así que no reflejaban los niveles introducidos en la Fase 1. Ahora dependen del módulo concedido: quitarle a alguien el acceso a un módulo también le quita su tarjeta del inicio, en lugar de dejarle una cifra sobre algo que no puede abrir.

---

## [1.64.2] — 2026-08-19

### Corrige: el tour de bienvenida había perdido la mitad de sus pasos

Regresión introducida en la v1.59.0 con el menú contextual. El tour explicaba los módulos señalando sus enlaces en el menú lateral —Tickets, Proyectos, Tareas, y los tres del portal del cliente—, pero esos enlaces solo están visibles cuando su módulo está activo, y el tour arranca en el inicio, donde no hay ninguno.

No fallaba de forma visible: el tour descarta en silencio los pasos cuyo elemento no existe. Simplemente **dejaba de explicar los módulos**, que era su parte más útil. Un cliente nuevo perdía 3 de sus pasos.

Ahora un único paso señala el **selector de módulos** y nombra los que esa persona verá según su rol: al cliente se le habla de Tickets, Proyectos y Portal; al administrador, también de Infraestructura y Administración.

El tour pasa de 15 a 12 pasos para el equipo y a 9 para clientes — más corto y, sobre todo, correspondiéndose con lo que se ve en pantalla.

Se añade una comprobación que verifica, para los tres roles, que cada paso apunte a un elemento que realmente se renderiza. Es la que faltaba: sin ella, un selector obsoleto vuelve a pasar desapercibido.

---

## [1.64.1] — 2026-08-19

### Los nombres del menú dejan de repetirse

Continuación de la v1.59.1, que desambiguó las dos «Integraciones». Con el menú contextual, entradas que antes se distinguían por su posición en la jerarquía quedaron con el mismo nombre en módulos distintos:

| Antes | Ahora |
|---|---|
| Tickets → Reportes | **Reportes de tickets** |
| Proyectos → Reportes | **Reportes de proyectos** |
| Tickets → Plantillas | **Plantillas de ticket** |
| Proyectos → Plantillas | **Plantillas de tarea** |

Las páginas de plantillas y la de reportes de proyectos ya se titulaban así; solo el menú las igualaba. La de reportes de tickets decía «Reportes» a secas y ahora también dice «Reportes de tickets», en el encabezado y en el título de la pestaña.

Se añadió una comprobación de etiquetas duplicadas al conjunto de pruebas de navegación: fue la que destapó lo de «Plantillas», que había pasado desapercibido.

---

## [1.64.0] — 2026-08-18

### Las instrucciones del agente de WhatsApp se editan desde el panel

Cambiar el tono del bot, añadirle una regla del negocio o afinar cómo recoge un
ticket exigía tocar código y desplegar. Ahora **Administración → Integraciones
del equipo → Agente de WhatsApp** trae el desplegable **«Instrucciones del
agente»** con el prompt completo, editable.

- **Se aplica en la siguiente respuesta.** Guardar surte efecto en el próximo
  mensaje que conteste el agente: no hay que reiniciar ni volver a desplegar.
- **Se puede volver atrás.** El botón **Restaurar el original** devuelve el
  texto de fábrica, y una etiqueta indica siempre si lo que rige son las
  instrucciones *personalizadas* o el *texto original*.
- **Con un aviso que no se puede plegar.** Los bloques QUÉ SABES y REGLAS DURAS
  no son estilo: describen cómo se comporta el código. Borrar «nunca afirmes que
  creaste algo si no llamaste a la función» abre la puerta a que el agente le
  diga a un cliente que le abrió un ticket que no existe.

#### Lo que sigue viviendo en el código

No se edita desde el panel lo que depende de cada conversación o sostiene una
garantía: el aviso de **cliente sin plan activo** —que prohíbe abrir tickets—,
el de **propuesta pendiente de confirmar**, las descripciones de las tres
herramientas y los **mensajes de confirmación**, que redacta el código
precisamente para que no puedan salir alucinados.

#### Por dentro

- `src/lib/whatsapp/prompt.ts` — nuevo módulo con `DEFAULT_AGENT_PROMPT` (el
  texto de fábrica, idéntico al que había), la clave `whatsapp_agent_prompt` y
  el tope de 8.000 caracteres. Sin dependencias de servidor, para que el editor
  —que es cliente— pueda importar el texto por defecto.
- `src/lib/whatsapp/agent.ts` — `systemInstruction()` recibe el prompt en vez de
  tenerlo dentro; `loadAgentPrompt()` lee la fila en cada mensaje y cae al texto
  de fábrica si está vacía o si la consulta falla.
- `src/actions/whatsapp-agent.actions.ts` — guardar y restaurar tras
  `requireCan("ADMIN")`, con la validación en el servidor: un prompt vacío
  dejaría al modelo sin ninguna instrucción frente a un cliente.
- Se reutiliza `app_settings`, así que **no hay migración**.

---

## [1.63.0] — 2026-08-18

### La guía para conectar el agente de WhatsApp ya vive dentro de la plataforma

El agente de WhatsApp llegó en la v1.62.0, pero conectarlo seguía siendo un
trabajo de arqueología: había que saber qué manda Meta, qué espera la app y
cómo se ata todo en n8n. Ese conocimiento no estaba en ningún sitio consultable.

Ahora **Administración → Integraciones del equipo** tiene un acceso directo a
**«Cómo conectar n8n con Meta Cloud API»**, una página con la guía completa:

- **El workflow, listo para llevárselo.** Un botón lo copia al portapapeles —n8n
  crea los nodos si lo pegas sobre el lienzo con Ctrl+V— y otro lo descarga como
  archivo para *Import from File*.
- **Dos versiones.** La recomendada usa los **nodos nativos de WhatsApp de n8n**:
  son 5 nodos y el *WhatsApp Trigger* se encarga solo del registro y la
  verificación del webhook con Meta, así que no hay que pegar ninguna callback
  URL ni inventar un *verify token*. La alternativa, montada con Webhook + HTTP
  Request, queda para quien no tenga el *App Secret* de la app de Meta, que es
  lo que pide la credencial OAuth del trigger.
- **Los pasos que se olvidan.** Dónde sacar el token permanente (el que muestra
  *API Setup* caduca en 24 horas), por qué hay que suscribir el campo `messages`
  —el fallo más común: el webhook queda verificado pero no llega nada— y por qué
  el flujo necesita descartar los acuses de estado, o el bot se respondería a sí
  mismo en bucle.
- **Una tabla de síntomas.** Qué mirar cuando la app responde 401, cuando el
  cliente no recibe nada o cuando el bot contesta que tuvo un problema.

#### Por dentro

- `docs/n8n-whatsapp-meta-cloud.md` y `docs/n8n/*.workflow.json` — la guía y los
  dos workflows. La página los **lee de ahí**, no los duplica: lo que ve el
  equipo en la plataforma y lo que lee quien toca el código son el mismo
  archivo. `next.config.ts` mete `docs/**` en el bundle standalone para que
  también existan en producción.
- `src/app/(dashboard)/admin/integraciones/whatsapp/page.tsx` — la página, tras
  `requireCan("ADMIN")`.
- `src/components/ui/markdown-renderer.tsx` — se le añadieron estilos de tabla
  (GFM), que hasta ahora salían sin bordes.
- El desplegable de la tarjeta de WhatsApp pasa a llamarse **«Contrato del
  endpoint»**: sigue siendo la referencia rápida de URL, cabecera y payload,
  ahora que el paso a paso tiene su propio sitio.

---

## [1.62.0] — 2026-08-18

### Los clientes ya pueden abrir y seguir sus tickets por WhatsApp

Hasta ahora, abrir un ticket exigía entrar a la plataforma. Para muchos clientes el primer impulso es escribir por WhatsApp, así que esas solicitudes llegaban al chat de un colaborador y alguien tenía que transcribirlas a mano — o se perdían.

Ahora hay un **agente de WhatsApp**. El cliente escribe al número del equipo y el asistente conversa con él en español, con el contexto real de su cuenta:

- **Abre tickets.** Recoge qué necesita, dónde y desde cuándo; le muestra un resumen y **solo lo crea cuando el cliente confirma**. El ticket entra como *Por asignar*, con su código, su plan y las mismas notificaciones que si lo hubiera abierto desde la plataforma.
- **Consulta el estado de sus tickets.** Cuáles tiene abiertos, en qué estado están, quién los lleva, la fecha límite y los últimos comentarios públicos del equipo.
- **Consulta su plan.** Tipo de plan, horas consumidas y disponibles, cuándo vence y cuántos días faltan.
- **Comenta en sus tickets.** «En el ACM-12, agrega que ya probamos desde otro navegador» deja el comentario en el hilo y le llega la notificación al responsable.

#### Nadie ve nada sin estar vinculado

Un número desconocido no obtiene ni un dato. El bot le pide el correo con el que entra a la plataforma y le manda un **código de 6 dígitos a ese correo**: así, quien intente atar la cuenta de otro a su propio teléfono se topa con que el código le llega al titular. El código caduca en 10 minutos y tras 5 intentos fallidos el número queda bloqueado media hora.

Como alternativa, un administrador puede registrar el número directamente en la ficha del usuario (**Usuarios → Editar → WhatsApp**) y el bot lo reconoce sin pedir código.

#### Lo que el agente no hace

No cierra tickets, ni cambia estados, prioridades o fechas: eso sigue siendo del equipo. Si el cliente lo pide, el agente le ofrece dejarlo como comentario. Y un cliente sin plan activo puede consultar, pero no abrir tickets — el mismo freno que aplica la plataforma.

#### Cómo se conecta

n8n hace de cartero: recibe el mensaje de WhatsApp, lo reenvía a la app y devuelve al cliente el texto que responde el agente. Toda la conversación —memoria, identidad, propuestas pendientes— vive en la app, así que cambiar de proveedor de WhatsApp no obliga a rehacer el agente. Las instrucciones del workflow, con el payload de ejemplo y el estado de la configuración, están en **Administración → Integraciones del equipo**.

#### Por dentro

- `prisma/migrations/20260818120000_add_whatsapp_agent` — columna `users.whatsapp_phone` (única) y tabla `whatsapp_conversations`, que guarda la memoria del hilo, la propuesta pendiente y el estado de vinculación.
- `src/app/api/integrations/whatsapp/route.ts` — endpoint autenticado con `INTEGRATION_WHATSAPP_TOKEN` (comparación en tiempo constante) e idempotente por `messageId`: un reintento de n8n devuelve la misma respuesta en vez de volver a crear el ticket.
- `src/lib/whatsapp/identity.ts` — resolución de identidad y verificación por código. Deterministic a propósito: no pasa por el modelo, y responde igual exista o no el correo para no revelar qué direcciones tienen cuenta.
- `src/lib/whatsapp/context.ts` — contexto precalculado (plan + tickets visibles) que además hace de lista blanca: una llamada del modelo a un ticket que no esté ahí se descarta.
- `src/lib/whatsapp/agent.ts` — orquestación y herramientas (`crear_ticket`, `comentar_ticket`, `confirmar_accion`). Los mensajes de confirmación los redacta el código, no el modelo.
- `src/lib/whatsapp/write.ts` — escrituras sin sesión, conservando prefijo por empresa, consecutivo transaccional y avisos al equipo.
- `src/lib/ai.ts` se reutiliza tal cual: el proveedor se elige con `WHATSAPP_AI_PROVIDER` (`gemini` por defecto u `openai`).

---

## [1.61.0] — 2026-08-18

### Duplicar una tarea o un ticket ahora puede llevarse el checklist

Duplicar copiaba el título, la descripción, la prioridad, la categoría y el responsable, pero dejaba fuera los checklists. En trabajos que se repiten —una publicación mensual, un mantenimiento— eso obligaba a reescribir a mano cada ítem en la copia.

Ahora el diálogo de **Duplicar** —tanto en tareas como en tickets— incluye la casilla **«Copiar los checklists»**, con el total de ítems que se llevaría. Viene marcada por defecto.

- **Se conserva la estructura.** Los checklists llegan a la copia con sus títulos y en el mismo orden, y los ítems dentro de cada uno también.
- **Los ítems llegan sin marcar.** La copia arranca de cero, igual que su estado (Pendiente en tareas, Por asignar en tickets).
- **Solo aparece si hay algo que copiar.** Si la tarea o el ticket no tiene checklists, el diálogo se ve como siempre.

#### Por dentro

- `src/lib/checklists.ts` — nueva función `copyChecklists(from, to, userId, client)`, que clona checklists e ítems entre dos entidades dentro de la misma transacción.
- `duplicateTask` y `duplicateTicket` aceptan el parámetro `includeChecklists` y hacen la copia dentro de la transacción que crea la tarea o el ticket.
- `ConfirmDialog` acepta `children`, para colocar opciones entre el mensaje y los botones.
- `src/components/ui/duplicate-checklists-option.tsx` — la casilla compartida por ambos diálogos.

---

## [1.60.1] — 2026-08-14

### Los formularios de plantilla no decían qué campos son obligatorios

Al crear o editar una plantilla —de tarea o de ticket— no había forma de saber qué hacía falta rellenar hasta que el formulario devolvía el error al guardar.

Ahora **nombre, título, descripción y prioridad** llevan el asterisco rojo de obligatorio, y **categoría, tiempo estimado y checklist** dicen «(opcional)». Es la misma convención que ya usaban los formularios de sitios y de tareas.

---

## [1.60.0] — 2026-08-14

### Las plantillas se pueden generar con IA

Crear una plantilla obligaba a escribir a mano el título, la descripción, la categoría, el tiempo estimado y cada ítem del checklist. Ahora, encima del formulario —tanto en plantillas de **tarea** como de **ticket**— hay un panel **«Generar plantilla con IA»**: se describe el trabajo en una o dos frases y la IA rellena todos los campos.

#### Qué hace

- **Un solo campo de entrada.** «Publicación mensual de Instagram para un cliente de retail: briefing, diseño, copys, aprobación y programación» basta para obtener nombre, título, descripción en Markdown, prioridad, categoría, estimación de tiempo (en tareas) y un checklist por fases.
- **Nada se guarda solo.** El resultado prellena el formulario como un borrador: se revisa, se ajusta lo que haga falta y se guarda con el botón de siempre. La IA propone, no decide.
- **Pensado para plantillas, no para casos sueltos.** El prompt le pide explícitamente que no invente clientes ni fechas: cuando hace falta un dato variable usa marcadores como `[Cliente]` o `[Mes]`.
- **Categorías reales.** Solo puede elegir entre las categorías del selector; si devuelve cualquier otra cosa, se descarta y queda «Sin categoría». Lo mismo con la prioridad.
- **Gemini u OpenAI.** El mismo selector de modelo que ya usa el planificador, con los mismos permisos que exige crear la plantilla a mano.

Al **editar** una plantilla existente el panel arranca plegado y avisa de que generar reemplaza lo que ya hay en el formulario.

#### Por dentro

- `src/actions/template-ai.actions.ts` — acción `generateTemplateDraft`, que reusa `runStructuredJson` (salida JSON con esquema) y no toca base de datos.
- `src/components/ui/ai-template-generator.tsx` — el panel, compartido por los dos formularios.
- `src/lib/ticket-categories.ts` — las categorías de ticket dejan de estar escritas dentro del formulario para poder ofrecérselas también a la IA.

---

## [1.59.1] — 2026-08-12

### Corrige: las dos «Integraciones» eran indistinguibles

Tras la v1.59.0 no se encontraba la configuración de n8n. Hay dos pantallas distintas que se llamaban igual:

- `/integraciones` — los webhooks personales de cada usuario.
- `/admin/integraciones` — Google Chat y el enrutamiento de briefs de n8n.

En el menú anterior estaban anidadas (una colgaba de la otra como «Equipo»), así que se distinguían por la jerarquía. Al reorganizar en menú contextual quedaron en sitios separados con el mismo nombre, y la de Herramientas —la personal— es la que se ve siempre.

Ahora se llaman **«Mis integraciones»** y **«Integraciones del equipo»**, tanto en el menú como en el encabezado de cada página, que también decían «Integraciones» a secas.

La de n8n vive en el módulo **Administración**, donde corresponde por ser configuración de administrador.

---

## [1.59.0] — 2026-08-12

### Fase 2: selector de módulos y menú contextual

El menú lateral deja de ser una lista plana de 18 ítems. Ahora hay un **selector de módulos** arriba, las **secciones del módulo activo** en medio y las **herramientas transversales** abajo. El menú ya no crece al añadir una app: crece el selector.

#### Qué cambia al usar la app

- **Selector de módulos.** Se abre centrado en pantalla, con tarjetas grandes que incluyen icono, nombre y descripción — dentro del menú, en 240px de ancho, resultaban ilegibles. Muestra solo lo concedido: lo que no aparece es porque no se tiene acceso, nunca en gris ni con candado. El CRM sí aparece, señalado como «Próximamente», porque está declarado pero sin construir.
- **El inicio es la casa.** En `/dashboard` no hay módulo activo: es el punto neutro desde el que se elige a dónde ir. Volver ahí no deja el menú «pegado» al último sitio visitado.
- **Menú contextual.** Estando en Proyectos se ven sus secciones (proyectos, tareas, plantillas, recurrentes, reportes) y no las de Tickets. De 18 ítems planos se pasa a 5–6 por módulo.
- **Herramientas siempre visibles.** Inicio, Panel, Asistente, Bóveda, Agendar, Integraciones y Novedades no pertenecen a ningún módulo. Entrar a la Bóveda desde Proyectos **no** cambia el módulo activo: se puede volver sin pasar por el selector.

#### Nota técnica: por qué el selector va en un portal

El `<aside>` aplica un `transform` para deslizarse en móvil, y eso crea un contexto de apilamiento propio: cualquier panel dentro queda confinado, por alto que sea su `z-index`. El selector se renderiza con `createPortal` a `document.body`, fuera de ese contexto, así que se superpone correctamente a todo el contenido.

#### El menú respeta los niveles, no solo el rol

Cada sección declara el nivel que necesita. Sin eso, alguien con nivel Lectura en Proyectos vería «Plantillas» y al pulsarlo acabaría en el dashboard. Ahora esos enlaces sencillamente no se ofrecen.

#### Consecuencia conocida: el tour pierde pasos

El tour guiado apunta a rutas del menú (`/tickets`, `/tareas`, `/mis-empresas`…) que ya no están visibles a la vez. No se rompe —filtra los pasos cuyo elemento no existe— pero muestra menos. Adaptarlo para que use el lanzador es trabajo aparte; el lanzador ya expone `data-tour-id="app-launcher"` para ello.

#### Fuera de alcance

El buscador global ⌘K y el inicio unificado del plan original quedan para más adelante: son funciones nuevas, no reorganización de lo que ya existe.

---

## [1.58.0] — 2026-08-12

### Limpieza: se eliminan las 19 tablas del esquema antiguo

Cierra la Fase 0. Se eliminan las tablas que quedaron sin uso tras unificar el núcleo compartido (v1.43.0 – v1.47.0), y sus modelos desaparecen del esquema de Prisma.

`ticket_comments` · `task_comments` · `ticket_comment_attachments` · `task_comment_attachments` · `ticket_comment_reactions` · `task_comment_reactions` · `ticket_attachments` · `task_attachments` · `project_attachments` · `ticket_checklists` · `task_checklists` · `ticket_checklist_items` · `task_checklist_items` · `ticket_time_entries` · `task_time_entries` · `ticket_templates` · `task_templates` · `ticket_vault_entries` · `project_vault_entries`

#### ⚠️ Irreversible

Es la primera migración de la serie que destruye datos. Antes de aplicarla se verificó en producción:

- **Ningún registro se pierde**: 19 comprobaciones cruzadas, cero filas en una tabla vieja que no estuviera ya en la nueva.
- **Las tablas nuevas están vivas**: todas tienen más filas que el backfill original — comentarios 810 (eran 799), adjuntos 365 (355), tiempo 690 (682), checklists 44 (43).
- **Las viejas están congeladas**: cero escrituras desde su respectiva migración.
- **Sin referencias en el código**: ninguna mención viva a los modelos eliminados.

#### Matiz sobre plantillas y vínculos de bóveda

`templates` y `vault_links` siguen con las mismas filas que el backfill (11 y 9): desde su migración nadie ha creado una plantilla ni vinculado una entrada de bóveda. Su camino de **lectura** está verificado en producción; el de **escritura** solo en pruebas locales. Es la única parte de esta limpieza que se apoya en verificación indirecta.

El esquema baja de 49 a 30 modelos.

---

## [1.57.0] — 2026-08-12

### Tickets: se migra lo que el modelo puede gobernar, y se documenta lo que no

Cuarto y último módulo, migrado **parcialmente y a propósito**.

Pasan a `requireCan("TICKETS", "gestionar")` los **5 puntos exclusivos de administrador**: editar ticket, asignar, borrar, actualizar desde el formulario y eliminar adjuntos.

#### Por qué las plantillas se quedan como estaban

Los **clientes tienen nivel Miembro** en Tickets, y lo necesitan: es lo que les permite abrir tickets. Eso los hace **indistinguibles de los colaboradores** con las capacidades `crear` y `editar`, y deja las plantillas de ticket sin una capacidad que las gobierne:

- con `editar`, entrarían los **30 clientes**;
- con `gestionar`, saldrían los **7 colaboradores** que hoy las usan.

Ninguna de las dos es aceptable, así que las tres páginas de plantillas siguen con `requireRole`. Es una limitación del modelo, no un descuido: el eje de niveles no distingue «equipo» de «cliente» cuando ambos comparten nivel dentro de un módulo.

Se resolverá cuando exista una capacidad intermedia —algo como `configurar`, entre Miembro y Gestor— para las pantallas internas de un módulo abierto a clientes. Es un cambio que afecta a toda la capa y no corresponde a esta entrega.

#### Sin migrar, por la misma razón

Las comprobaciones `isStaff` de `ticket.actions`, `comment.actions`, `time.actions` y `ticket-template.actions` separan equipo de cliente, que es justo lo que el nivel no puede hacer aquí. Se quedan.

Nadie gana ni pierde acceso.

---

## [1.56.0] — 2026-08-13

### El body de n8n se reduce a tres campos y un enlace

Llenar el payload en n8n era tedioso: había que mapear el cliente, cada respuesta del brief y los adjuntos. Ahora la tarea **no copia el brief, lo enlaza**.

El body queda así:

```json
{
  "projectId": "...",
  "briefType": "sitio-web",
  "briefUrl": "https://docs.google.com/forms/.../respuesta",
  "externalRef": "{{ $execution.id }}"
}
```

- **`briefUrl` es obligatorio.** Sin él la tarea nacería vacía y el responsable no tendría nada que abrir. Aparece encabezando la descripción y además como **adjunto** de la tarea, que es donde se buscan las fuentes.
- **`title` es opcional.** Si no viene, la tarea se titula con el nombre de la regla y su consecutivo dentro del proyecto — *Brief de sitio web #12* —, que es único sin depender de que n8n mande nada.
- El responsable, la prioridad, la categoría y el plazo siguen saliendo de la regla, no del payload.

Los campos de enriquecimiento (`client`, `fields`, `summary`, `links`, `priority`, `category`, `dueDate`) **se siguen aceptando** y funcionan igual que antes, pero dejan de documentarse en la pantalla: quedan por si algún día conviene volcar el brief entero en la descripción.

**Cambio de contrato:** una llamada sin `briefUrl` ahora responde 400. El endpoint no había llegado a usarse en producción, así que no rompe nada en marcha.

---

## [1.55.0] — 2026-08-13

### Las reglas de brief definen el plazo de entrega

Hasta ahora una tarea creada desde un brief solo tenía fecha límite si n8n la mandaba en el payload. La regla ya podía decir *quién* y *con qué prioridad*, pero no *para cuándo*.

Cada regla gana dos campos: **plazo en días hábiles** y **hora límite**. Un brief que entra el viernes con plazo de 3 días vence el miércoles a las 18:00 — sábados y domingos no cuentan.

- El plazo se calcula sobre el calendario de **Bogotá**, no el del servidor: un brief que entra a las 23:00 hora local ya es el día siguiente en UTC y habría contado un día hábil de menos.
- La fecha se guarda como la medianoche de Bogotá en UTC y la hora aparte en `Task.endTime`, que es como el resto de la app almacena fecha y hora (misma convención que el cron de vencidas).
- Si n8n manda `dueDate`, esa gana; el plazo de la regla es el respaldo. La **hora** límite siempre sale de la regla: es el compromiso de entrega del equipo, no algo que decida el cliente.
- La respuesta del webhook devuelve `dueDate` y `dueTime` ya resueltos, para que n8n pueda confirmárselos al cliente. El aviso de Google Chat incluye el vencimiento.
- Ambos campos son opcionales: una regla sin plazo se comporta como hasta ahora.

**Limitación conocida:** el cálculo salta fines de semana pero **no festivos de Colombia**. Un brief junto a un puente vencerá un día hábil antes de lo que diría el calendario laboral real.

Migración aditiva `20260813000000_add_brief_routing_due`: dos columnas nullable, las reglas existentes se quedan sin plazo.

---

## [1.54.1] — 2026-08-12

### `.env.example` vuelve a versionarse

La regla `.env*` del `.gitignore` también tapaba la plantilla, así que `.env.example` nunca había estado en el repo: cada variable nueva quedaba documentada solo en la máquina de quien la añadía. Se añade la excepción `!.env.example`; los `.env` y `.env.local` reales siguen ignorados.

De paso, la plantilla documenta los dos tokens de integración que faltaban: `INTEGRATION_BRIEF_TOKEN` (briefs de n8n) e `INTEGRATION_HOSTING_TOKEN`, que existía en el código desde antes sin figurar en ningún sitio.

---

## [1.54.0] — 2026-08-12

### Los briefs de n8n entran como tareas y se asignan solos

Cuando un cliente diligencia un brief en n8n, el workflow ya puede volcarlo directamente en un proyecto de la app: llega como tarea, con el brief completo en la descripción, y **con responsable puesto**.

- **Nuevo endpoint `POST /api/integrations/brief`**, autenticado con `Authorization: Bearer <INTEGRATION_BRIEF_TOKEN>` (comparación en tiempo constante, igual que la integración de hosting). n8n manda el `projectId`; el proyecto no está fijado en el código.
- **Reglas de enrutamiento** en la nueva tabla `brief_routings`: cada `briefType` apunta a un responsable, con prioridad, categoría y horas estimadas por defecto. El responsable **no viaja en el payload** a propósito — así se reasigna un tipo de brief desde la app sin tocar el workflow de n8n.
- **Pantalla en `/admin/integraciones`** para crear, editar, desactivar y borrar esas reglas, con las instrucciones de conexión y un payload de ejemplo listo para copiar.
- **Idempotente**: si n8n manda `externalRef` (su id de ejecución) un reintento devuelve la tarea ya creada en vez de duplicarla. Nueva columna `tasks.external_ref` con índice único.
- La tarea se numera dentro del proyecto como cualquier otra, notifica al responsable y sale al canal de tareas de Google Chat (salvo en proyectos privados). Los adjuntos que mande el cliente se guardan como enlaces.
- Si el `briefType` no tiene regla activa, la respuesta es **422 con la lista de tipos válidos**, para que n8n pueda avisar en vez de perder el brief en silencio. Si el responsable configurado está inactivo, la tarea se crea igual pero sin asignar y la respuesta lo advierte.

Migración aditiva `20260812140000_add_brief_routing`: no toca ninguna columna existente.

---

## [1.50.2] — 2026-08-12

### Corrige: la edición de usuario redirigía al dashboard

Desde la v1.49.0, abrir `/admin/users/[id]/edit` devolvía al dashboard, así que la pantalla de acceso era inalcanzable.

La causa: `listAccessProfiles` estaba declarada como Server Action (`"use server"`) y la página la invocaba **durante el render**. Su guardia `requireCan("ADMIN")` fallaba en ese contexto y disparaba la redirección. Como la respuesta llegaba con estado 200 —el documento es un *shell* de streaming y la redirección viaja dentro—, ni el código HTTP ni la consola delataban el problema.

Pasa a ser un helper de servidor normal (`src/lib/access/profiles.ts`). Los Server Actions quedan para mutaciones invocadas desde el cliente, que es su cometido; usarlos como cargadores de datos al renderizar era el error.

---

## [1.50.1] — 2026-08-12

### La pantalla de acceso dice qué módulos ya obedecen al nivel

Asignar un perfil parecía no surtir efecto. Y en parte era cierto: solo Administración e Infraestructura se rigen por los niveles; Tickets, Proyectos y el Portal todavía deciden por el rol, así que ahí el nivel se guarda pero no manda. La pantalla no lo decía en ningún sitio.

- Cada módulo indica ahora **«El nivel aún no rige»** mientras siga gobernado por el rol, y **«Módulo aún no construido»** en el caso del CRM.
- Se aclara que los perfiles de acceso **no son lo mismo que las «designaciones»** del formulario de usuario, que solo deciden quién aparece en la página «Agendar» de los clientes. La coincidencia de nombre inducía a buscar el efecto en el sitio equivocado.
- La **ficha del usuario** muestra el perfil asignado y el nivel de cada módulo sin tener que entrar a editar.

Nuevo campo `enforced` en el registro de módulos: se irá poniendo en `true` conforme cada módulo migre a `can()`.

---

## [1.50.0] — 2026-08-12

### Infraestructura pasa a regirse por permisos

Segundo módulo migrado. **13 chequeos** de `requireRole(["ADMINISTRADOR", "COLABORADOR"])` pasan a `requireCan("INFRAESTRUCTURA", …)` en sitios y servicios.

#### El nivel importa aquí, y no era obvio

A diferencia de Administración —que era solo para administradores—, este módulo lo usan **también los colaboradores**, que tras el backfill tienen nivel Miembro, no Gestor. Usar `"gestionar"` como en el módulo anterior los habría dejado fuera de sitios y servicios.

Por eso el mapeo es deliberado:

| Qué | Capacidad | Nivel mínimo |
|---|---|---|
| Listados de sitios y servicios | `ver` | Lectura |
| Crear | `crear` | Miembro |
| Editar, borrar, duplicar | `editar` | Miembro |

Nadie gana ni pierde acceso: administradores (Gestor) y colaboradores (Miembro) siguen entrando a todo, y los clientes siguen fuera por rol.

#### Lo que ahora es posible

Un colaborador con nivel **Lectura** ve el inventario de sitios y servicios pero no puede modificarlo — un estado que antes no existía, porque el acceso era todo o nada.

#### Nota sobre el borrado

Borrar un sitio o un servicio sigue exigiendo Miembro, igual que hoy. Elevarlo a Gestor sería razonable, pero es un cambio de comportamiento y no algo que deba colarse en una migración de permisos.

Sin cambios de esquema.

---

## [1.49.0] — 2026-08-12

### El módulo de Administración pasa a regirse por permisos

Primer módulo migrado a la capa `can()`. **29 chequeos** de `requireRole(["ADMINISTRADOR"])` pasan a `requireCan("ADMIN")` en usuarios, empresas, planes, productividad, integraciones de equipo y ajustes.

Los chequeos de tareas recurrentes, tickets, proyectos, sitios y servicios **quedan intactos**: pertenecen a otros módulos y se migrarán cuando les toque.

#### Qué cambia en la práctica

Nada, para quien tiene su acceso: los tres administradores conservan nivel Gestor en Administración, así que entran igual.

Lo que se gana es poder **retirarlo**. Hasta ahora, ser `ADMINISTRADOR` implicaba administrar; a partir de aquí son dos cosas distintas. Se puede tener el rol —con su frontera de datos completa— sin gestionar usuarios, empresas ni planes. Es el primer caso real en que el nivel manda sobre el rol.

#### Dos salvaguardas contra quedarse fuera

Ahora que Administración depende del nivel, retirarlo mal deja el sistema sin quien conceda permisos. `updateUserAccess` rechaza:

- **Quitarse el acceso a uno mismo.** Se perdería la pantalla desde la que devolvérselo.
- **Dejar el sistema sin ningún administrador activo con nivel Gestor.**

#### Añadido

- `requireCan(app, capability)` en `src/lib/access/can.ts`: guardia para páginas y acciones, con la misma semántica de redirección que tenía `requireRole`.

---

## [1.48.0] — 2026-08-12

### Fase 1: permisos por módulo

Primer paso del modelo de accesos. **No cambia el comportamiento de nadie**: el backfill reproduce exactamente el acceso que cada usuario tiene hoy y los chequeos de rol existentes siguen mandando. La capa queda disponible para migrarlos módulo por módulo.

#### Dos ejes separados

Hasta ahora el rol decidía todo. A partir de aquí:

- El **rol** (`ADMINISTRADOR` / `COLABORADOR` / `CLIENTE`) delimita **qué registros** ve alguien. Es la frontera de datos y no cambia.
- El **nivel por app** (`SIN_ACCESO` / `LECTURA` / `MIEMBRO` / `GESTOR`) delimita **qué puede hacer** con lo que ya ve.

Regla dura: un nivel nunca amplía la frontera del rol. Cada módulo declara qué roles lo admiten, así que conceder «Administración» a un cliente no le da acceso — se ignora. Verificado con prueba.

#### Qué se añade

- **`AppKey`**: `TICKETS`, `PROYECTOS`, `INFRAESTRUCTURA`, `PORTAL`, `ADMIN` y `CRM`. Este último se declara para poder preparar perfiles; el registro de `src/lib/access/apps.ts` marca cuáles están construidos y la interfaz lo señala como pendiente.
- **`AppAccess`** (nivel explícito por usuario y módulo) y **`AccessProfile`** (perfil reutilizable). Lo explícito pisa al perfil.
- **`src/lib/access/can.ts`**: `getGrants`, `getAccessLevel`, `can(actor, app, capability)` y `getAccessibleApps` — esta última alimentará el lanzador de la Fase 2. Los permisos **no viven en el JWT** a propósito: quitar un acceso surte efecto de inmediato, no al siguiente inicio de sesión. Se resuelven una vez por request con `cache()` de React.
- **Pantalla de acceso** en la edición de usuario: se elige un perfil y se ajustan módulos sueltos. Solo se ofrecen los módulos que el rol admite.

#### Perfiles del sistema

Siete, todos disponibles desde el primer día: **Dirección**, **Equipo**, **Cliente**, **Project manager**, **Soporte**, **Diseño y desarrollo** y **Comercial**.

El backfill asigna solo los tres primeros —los que equivalen al acceso actual de cada rol—. Los otros cuatro reparten niveles distintos, así que asignarlos es una decisión consciente del administrador y no un efecto colateral de la migración.

#### Migración `20260812100000_add_app_access_and_profiles` (con datos)

- Crea los perfiles y concede a los 40 usuarios los niveles equivalentes a su acceso de hoy.
- Verificada en base desechable: cero discrepancias entre el perfil asignado y los niveles explícitos, en los tres roles.

---

## [1.47.0] — 2026-08-11

### Fase 0, paso 5 y último: plantillas y vínculos de bóveda

Cierra el núcleo compartido. Dos conceptos pequeños que se hacen juntos.

- **Plantillas.** `TicketTemplate` y `TaskTemplate` se unifican en `Template`. Aquí `entityType` no señala a qué entidad pertenece la plantilla sino **qué crea**, así que no lleva `entityId`. `estimatedHours` solo lo usan las de tarea y queda nulo en las de ticket. Nuevo `src/lib/templates.ts`.
- **Vínculos de bóveda.** `TicketVaultEntry` y `ProjectVaultEntry` se unifican en `VaultLink`. La relación con `VaultEntry` sigue siendo clave foránea real, así que borrar una entrada de la bóveda sigue arrastrando sus vínculos. Nuevo `src/lib/vault-links.ts` con los filtros `linkedTo()` / `notLinkedTo()`, que sustituyen a los seis `where: { tickets: { some } }` repartidos por las páginas.
- Las mutaciones de plantilla van acotadas por tipo: un id de plantilla de tarea no aplica sobre una de ticket.
- `deleteVaultLinksFor()` se añade a `deleteTicket` y `deleteProject`.

Con esto, los **nueve conceptos duplicados** que motivaron la Fase 0 quedan unificados: de 19 modelos a 9.

#### Migración `20260811200000_add_shared_template_and_vault_link_kernel` (con datos)

- Copia las 11 plantillas y los 9 vínculos conservando ids.
- Las tablas viejas no se eliminan.
- Verificada en base desechable, incluida la cascada desde `vault_entries`; `prisma migrate diff` no detecta diferencias.

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
