import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk, readJson, readPagination, requireActor } from "@/lib/api/respond";
import { createAccountViaApi, isDenied, listAccounts } from "@/lib/api/crm";

/**
 * Cuentas del CRM.
 *
 *   GET  /api/v1/accounts?stage=&search=&limit=&cursor=
 *   POST /api/v1/accounts
 *
 * El POST es el que justifica todo esto: un formulario web, un anuncio o un
 * chatbot dejan el lead aquí y aparece en el CRM sin que nadie lo copie. Por eso
 * un nombre repetido devuelve la cuenta que ya existe en vez de fallar — los
 * formularios se envían dos veces todo el tiempo.
 */

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(160),
  stage: z.enum(["LEAD", "PROSPECTO", "CLIENTE", "INACTIVO"]).optional(),
  taxId: z.string().max(60).nullable().optional(),
  source: z.string().max(80).nullable().optional(),
  ownerId: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  const actor = await requireActor(req, "read");
  if (actor instanceof NextResponse) return actor;

  const url = new URL(req.url);
  const { limit, cursor } = readPagination(req);

  const result = await listAccounts(actor.user, {
    limit,
    cursor,
    stage: url.searchParams.get("stage") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
  });
  if (isDenied(result)) return apiError(result.error, result.status);

  return apiOk(result);
}

export async function POST(req: Request) {
  const actor = await requireActor(req, "write");
  if (actor instanceof NextResponse) return actor;

  const body = await readJson(req);
  if (body instanceof NextResponse) return body;

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("El cuerpo no valida", 400, { issues: parsed.error.issues });
  }

  const result = await createAccountViaApi(actor.user, parsed.data);
  if (!result.ok) return apiError(result.error, result.status);

  return apiOk({ account: result.value }, 201);
}
