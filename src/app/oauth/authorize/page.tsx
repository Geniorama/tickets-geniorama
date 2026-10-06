import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AUTHORIZE_FIELDS, checkAuthorizeRequest } from "@/lib/oauth/authorize";
import { OAUTH_SCOPE_LABELS } from "@/lib/oauth/config";

export const metadata = { title: "Autorizar aplicación" };
export const dynamic = "force-dynamic";

/**
 * Pantalla de consentimiento de OAuth. Llega aquí una app MCP (Claude, ChatGPT,
 * Cursor…) que quiere actuar como el usuario. Se muestra siempre, aunque ya la
 * hubiera autorizado antes: el registro de apps es abierto, así que el único
 * freno real es que la persona vea qué app es y a dónde vuelve.
 */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : null;
  };

  const session = await auth();
  if (!session?.user) {
    const qs = new URLSearchParams();
    for (const k of AUTHORIZE_FIELDS) {
      const v = get(k);
      if (v != null) qs.set(k, v);
    }
    redirect(`/login?callbackUrl=${encodeURIComponent(`/oauth/authorize?${qs}`)}`);
  }

  const check = await checkAuthorizeRequest(get);
  if (!check.ok && check.redirect) redirect(check.redirect);

  let returnHost = "";
  if (check.ok) {
    try {
      const u = new URL(check.request.redirectUri);
      returnHost = u.host || u.protocol.replace(/:$/, "");
    } catch {}
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#000a3d" }}>
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image
            src="https://i.imgur.com/pTemb33.png"
            alt="Geniorama"
            width={200}
            height={60}
            className="object-contain"
            priority
          />
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {!check.ok ? (
            <>
              <h1 className="text-lg font-semibold text-gray-900 mb-2">No se puede autorizar</h1>
              <p className="text-sm text-gray-600">{check.message}</p>
            </>
          ) : (
            <form method="POST" action="/api/oauth/authorize">
              {AUTHORIZE_FIELDS.map((k) => {
                const v = get(k);
                return v != null ? <input key={k} type="hidden" name={k} value={v} /> : null;
              })}

              <h1 className="text-lg font-semibold text-gray-900 mb-1">
                <span className="text-indigo-600">{check.request.clientName}</span> quiere acceder a tu cuenta
              </h1>
              <p className="text-sm text-gray-500 mb-5">
                Entrarás como <strong className="text-gray-700">{session.user.name}</strong> ({session.user.email}).
                La aplicación verá solo lo que tú ves en la plataforma.
              </p>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Podrá</p>
              <ul className="space-y-2 mb-5">
                {check.request.scopes.map((s) => (
                  <li key={s} className="text-sm border border-gray-200 rounded-lg px-3 py-2">
                    <span className="font-medium text-gray-900">{OAUTH_SCOPE_LABELS[s].label}</span>
                    <span className="block text-gray-500 text-xs mt-0.5">{OAUTH_SCOPE_LABELS[s].description}</span>
                  </li>
                ))}
              </ul>

              <p className="text-xs text-gray-500 mb-6">
                Al autorizar volverás a <strong className="text-gray-700 break-all">{returnHost}</strong>. Puedes
                desconectarla cuando quieras desde <em>Mis integraciones</em>.
              </p>

              <div className="flex gap-2">
                <button
                  type="submit"
                  name="decision"
                  value="deny"
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  name="decision"
                  value="approve"
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer"
                  style={{ backgroundColor: "#fd1384" }}
                >
                  Autorizar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
