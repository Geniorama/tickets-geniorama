/**
 * Configuración de las notificaciones push.
 *
 * Las claves VAPID viven en el `.env.local` **del servidor**, que el despliegue
 * excluye a propósito para no pisarlo. Mientras no estén puestas, todo esto
 * tiene que comportarse: la pantalla dice que falta configurarlo y no se
 * intenta enviar nada. Una función que revienta porque falta una variable de
 * entorno convierte un aviso en un error de la acción que lo provocó.
 */

export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";

/**
 * A quién reclamar si un envío se porta mal. Los servicios de push exigen un
 * contacto: un `mailto:` del que administra, no del usuario.
 */
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:soporte@geniorama.co";

export function isPushConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 0 && VAPID_PRIVATE_KEY.length > 0;
}
