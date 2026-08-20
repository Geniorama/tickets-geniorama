import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/api/openapi";

/**
 * El contrato de la API, en OpenAPI 3.1.
 *
 * Va **sin llave** a propósito: no contiene datos ni secretos, solo la forma de
 * las peticiones, y pedirla autenticada obligaría a tener una llave antes de
 * poder leer cómo se usan las llaves. Es además lo que permite importarla de un
 * tirón en Postman, Insomnia o el nodo de n8n sin pelearse con credenciales.
 *
 *   GET /api/v1/openapi.json
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // La URL sale de la petición y no de `AUTH_URL`: así el «Try it out» de la
  // referencia apunta al servidor que está sirviendo la página —localhost en
  // desarrollo, el dominio real en producción— sin configurar nada.
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  // Sin caché: el documento se arma en memoria y no cuesta nada, mientras que
  // una copia guardada en el navegador significa ver la documentación de la
  // versión anterior justo después de desplegar — que es cuando más se mira.
  return NextResponse.json(buildOpenApiDocument(baseUrl), {
    headers: { "Cache-Control": "no-store" },
  });
}
