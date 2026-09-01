import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { estaConfigurado, loQueFalta } from "@/lib/xubio/client";
import { listarClientes } from "@/lib/xubio/clientes";
import { emparejar } from "@/lib/xubio/match";
import { XubioSync } from "@/components/billing/xubio-sync";

export const metadata = { title: "Xubio" };

export default async function XubioPage() {
  // Esto escribe en la contabilidad de la empresa: pide GESTOR.
  await requireCan("FACTURACION", "gestionar");

  const configurado = estaConfigurado();

  // Solo las empresas a las que se les cobra algo: la agenda entera incluye
  // prospectos del CRM a los que no hay nada que facturar todavía.
  const empresas = configurado
    ? await prisma.company.findMany({
        where: { isActive: true, billingItems: { some: {} } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, taxId: true, xubioClientId: true },
      })
    : [];

  const respuesta = configurado ? await listarClientes() : null;
  const parejas = respuesta?.ok ? emparejar(empresas, respuesta.datos.clientes) : [];

  return (
    <div>
      <Link
        href="/facturacion"
        style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", color: "var(--app-text-muted)", textDecoration: "none", marginBottom: "1rem" }}
      >
        <ArrowLeft style={{ width: "1rem", height: "1rem" }} />
        Volver
      </Link>

      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>Xubio</h1>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginTop: "0.25rem", maxWidth: "44rem" }}>
        Cada empresa de aquí tiene que corresponder con un cliente de allá para poder facturarle.
        Esta pantalla enseña cuáles ya se corresponden y cuáles no. Todavía no emite ninguna
        factura: eso viene después, y con un botón por cobro.
      </p>

      {!configurado ? (
        <div
          style={{
            display: "flex", gap: "0.6rem", alignItems: "flex-start", maxWidth: "44rem",
            backgroundColor: "#f59e0b14", border: "1px solid #f59e0b55",
            borderRadius: "0.75rem", padding: "0.95rem 1.1rem", marginTop: "1.5rem",
          }}
        >
          <AlertTriangle style={{ width: "1rem", height: "1rem", color: "#f59e0b", flexShrink: 0, marginTop: "0.15rem" }} />
          <div style={{ fontSize: "0.8125rem", color: "var(--app-nav-text)", lineHeight: 1.6 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Falta conectar la cuenta.</p>
            <p style={{ margin: "0.4rem 0 0" }}>
              En el <code>.env.local</code> del servidor hacen falta{" "}
              {loQueFalta().map((v, i) => (
                <span key={v}>
                  {i > 0 && " y "}
                  <code style={{ color: "var(--app-body-text)" }}>{v}</code>
                </span>
              ))}
              , y reiniciar la aplicación. Se sacan de Xubio, en la configuración de integraciones
              de la empresa.
            </p>
            <p style={{ margin: "0.4rem 0 0", color: "var(--app-text-muted)" }}>
              Las credenciales no se guardan en la base de datos ni se enseñan aquí; solo se dice
              si están puestas.
            </p>
          </div>
        </div>
      ) : !respuesta?.ok ? (
        <div
          style={{
            display: "flex", gap: "0.6rem", alignItems: "flex-start", maxWidth: "44rem",
            backgroundColor: "#dc262614", border: "1px solid #dc262655",
            borderRadius: "0.75rem", padding: "0.95rem 1.1rem", marginTop: "1.5rem",
          }}
        >
          <XCircle style={{ width: "1rem", height: "1rem", color: "#dc2626", flexShrink: 0, marginTop: "0.15rem" }} />
          <div style={{ fontSize: "0.8125rem", color: "var(--app-nav-text)", lineHeight: 1.6 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{respuesta?.error ?? "No se pudo hablar con Xubio"}</p>
            {respuesta && "detalle" in respuesta && respuesta.detalle && (
              <pre style={{ margin: "0.5rem 0 0", fontSize: "0.7rem", color: "var(--app-text-muted)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {respuesta.detalle}
              </pre>
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex", gap: "0.6rem", alignItems: "center", maxWidth: "44rem",
              backgroundColor: "#22c55e14", border: "1px solid #22c55e55",
              borderRadius: "0.75rem", padding: "0.75rem 1.1rem", margin: "1.5rem 0",
              fontSize: "0.8125rem", color: "var(--app-nav-text)",
            }}
          >
            <CheckCircle2 style={{ width: "1rem", height: "1rem", color: "#22c55e", flexShrink: 0 }} />
            Conectado. {respuesta.datos.clientes.length}{" "}
            {respuesta.datos.clientes.length === 1 ? "cliente" : "clientes"} en Xubio.
            {respuesta.datos.ilegibles > 0 &&
              ` ${respuesta.datos.ilegibles} no se pudieron leer.`}
          </div>

          <div style={{ maxWidth: "44rem" }}>
            <XubioSync parejas={parejas} muestra={respuesta.datos.muestra} />
          </div>
        </>
      )}
    </div>
  );
}
