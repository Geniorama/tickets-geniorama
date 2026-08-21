import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { globalSearch } from "@/lib/search/global";

/**
 * Lo que consulta el buscador ⌘K.
 *
 * Va aparte de `/api/v1` a propósito: aquella es la API pública, se autentica
 * con llave y es un contrato que no se puede romper. Esta es interna, se
 * autentica con la cookie de sesión y puede cambiar de forma cuando al buscador
 * le convenga.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q") ?? "";
  const results = await globalSearch(session.user, q);

  return NextResponse.json({ ok: true, results });
}
