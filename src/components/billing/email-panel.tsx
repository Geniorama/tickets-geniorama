"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Send, Clock } from "lucide-react";
import { renderPlantilla, type DatosCorreo } from "@/lib/billing/reminders/template";
import { saludoPara, type Direccion } from "@/lib/billing/emails/compose";
import { sendBillingEmail } from "@/actions/billing-emails.actions";
import { EmailLog, type CorreoRegistrado } from "@/components/billing/email-log";
import { Marcas } from "@/components/billing/email-templates";

/**
 * Los correos de este cobro: mandar uno —ahora o a una hora— y ver los que ya
 * salieron o esperan.
 *
 * La pantalla enseña dos cosas antes de dejar pulsar nada, porque un correo a
 * un cliente no se puede retirar: **a quién va** y **cómo queda** el texto con
 * los datos de este cobro ya puestos.
 */

export type PlantillaDisponible = {
  id: string;
  name: string;
  subject: string;
  body: string;
  onlyIfPending: boolean;
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.7rem", fontSize: "0.875rem",
  borderRadius: "0.5rem", border: "1px solid var(--app-border)",
  backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.8125rem", fontWeight: 600,
  color: "var(--app-body-text)", marginBottom: "0.3rem",
};

const HORAS = Array.from({ length: 24 }, (_, h) => h);

export function EmailPanel({
  billingItemId,
  plantillas,
  direcciones,
  porDefecto,
  empresa,
  empresaId,
  datos,
  correoListo,
  correos,
  abrirCon,
}: {
  billingItemId: string;
  plantillas: PlantillaDisponible[];
  /** A quién se le puede escribir: lo que hay en la ficha del cliente. */
  direcciones: Direccion[];
  porDefecto: string[];
  empresa: string;
  empresaId: string;
  /** Los datos del cobro, para enseñar el texto ya sustituido. */
  datos: DatosCorreo;
  /** Si el servidor puede mandar correo. Sin esto, todo fallaría al pulsar. */
  correoListo: boolean;
  correos: CorreoRegistrado[];
  /**
   * Id de una plantilla con la que el formulario nace ya abierto. Lo usa el
   * botón «Enviar al cliente» del link de pago: lleva hasta aquí con el correo
   * preparado, pero quien lo manda sigue viendo a quién va y cómo queda.
   */
  abrirCon?: string | null;
}) {
  const inicial = abrirCon ? plantillas.find((p) => p.id === abrirCon) ?? null : null;
  const [abierto, setAbierto] = useState(inicial !== null);
  const [plantillaId, setPlantillaId] = useState(inicial?.id ?? "");
  const [asunto, setAsunto] = useState(inicial?.subject ?? "");
  const [cuerpo, setCuerpo] = useState(inicial?.body ?? "");
  const [elegidas, setElegidas] = useState<string[]>(porDefecto);
  const [programar, setProgramar] = useState(false);
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState(9);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const plantilla = plantillas.find((p) => p.id === plantillaId) ?? null;
  const sinSaldo = datos.pendiente <= 0;

  function abrir() {
    const primera = plantillas[0] ?? null;
    setPlantillaId(primera?.id ?? "");
    setAsunto(primera?.subject ?? "");
    setCuerpo(primera?.body ?? "");
    setElegidas(porDefecto);
    setProgramar(false);
    // Mañana por defecto. Se calcula al abrir y no al pintar: la fecha del
    // servidor y la del navegador pueden no coincidir.
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    setFecha(manana.toLocaleDateString("en-CA"));
    setHora(9);
    setError(null);
    setAviso(null);
    setAbierto(true);
  }

  function elegirPlantilla(id: string) {
    setPlantillaId(id);
    const p = plantillas.find((x) => x.id === id);
    // Cambiar de plantilla cambia el texto; «sin plantilla» deja lo escrito.
    if (p) {
      setAsunto(p.subject);
      setCuerpo(p.body);
    }
  }

  function alternarDireccion(email: string) {
    setElegidas((actuales) =>
      actuales.includes(email) ? actuales.filter((e) => e !== email) : [...actuales, email],
    );
  }

  // El refresco va fuera de una transición, como en los abonos: dentro, la
  // lista de abajo no se movía hasta recargar a mano.
  async function enviar() {
    setError(null);
    setIsPending(true);
    try {
      const r = await sendBillingEmail({
        billingItemId,
        templateId: plantilla?.id ?? null,
        subject: asunto,
        body: cuerpo,
        recipients: elegidas,
        cuando: programar ? { fecha, hora } : null,
      });
      if (r?.error) {
        setError(r.error);
      } else {
        setAbierto(false);
        setAviso(programar ? "Correo programado." : "Correo enviado.");
      }
      // También si falló: el intento queda apuntado en la lista de abajo.
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  const vista = { ...datos, contacto: saludoPara(direcciones, elegidas, empresa).contacto };
  const bloqueadoPorSaldo = plantilla?.onlyIfPending === true && sinSaldo;
  const puedeEnviar =
    correoListo && elegidas.length > 0 && asunto.trim() !== "" && cuerpo.trim() !== "" &&
    !bloqueadoPorSaldo && (!programar || fecha !== "");

  return (
    <div
      id="correos"
      style={{
        backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
        borderRadius: "0.75rem", padding: "1.25rem", scrollMarginTop: "1rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
          Correos al cliente
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/facturacion/correos" style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", textDecoration: "none" }}>
            Plantillas
          </Link>
          {!abierto && (
            <button
              type="button"
              onClick={abrir}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.35rem",
                fontSize: "0.8125rem", padding: "0.4rem 0.85rem", borderRadius: "0.5rem",
                border: "1px solid var(--app-border)", backgroundColor: "transparent",
                color: "var(--app-nav-text)", cursor: "pointer",
              }}
            >
              <Mail style={{ width: "0.85rem", height: "0.85rem" }} />
              Enviar correo
            </button>
          )}
        </div>
      </div>

      {aviso && !abierto && (
        <p style={{ fontSize: "0.8125rem", color: "#16a34a", margin: "0.75rem 0 0" }}>{aviso}</p>
      )}

      {abierto && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "1rem" }}>
          {!correoListo && (
            <p style={{ fontSize: "0.8125rem", color: "#b45309", margin: 0 }}>
              El servidor no tiene configurado el envío de correo, así que desde aquí no saldría nada.
            </p>
          )}

          <div>
            <label htmlFor="correo-plantilla" style={labelStyle}>Plantilla</label>
            <select
              id="correo-plantilla" style={inputStyle}
              value={plantillaId}
              onChange={(e) => elegirPlantilla(e.target.value)}
            >
              {plantillas.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="">Sin plantilla</option>
            </select>
            {bloqueadoPorSaldo && (
              <p style={{ fontSize: "0.75rem", color: "#b45309", marginTop: "0.3rem" }}>
                Esta plantilla es de cobranza y este cobro ya no debe nada.
              </p>
            )}
          </div>

          <div>
            <span style={labelStyle}>Para</span>
            {direcciones.length === 0 ? (
              <p style={{ fontSize: "0.8125rem", color: "#b45309", margin: 0 }}>
                {empresa} no tiene buzón de facturación ni contactos activos con correo.{" "}
                <Link href={`/crm/${empresaId}`} style={{ color: "#fd1384", textDecoration: "none" }}>
                  Añadirlo en la ficha del cliente
                </Link>
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {direcciones.map((d) => (
                  <label key={d.email} style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.8125rem", color: "var(--app-nav-text)" }}>
                    <input
                      type="checkbox"
                      checked={elegidas.includes(d.email)}
                      onChange={() => alternarDireccion(d.email)}
                    />
                    <span style={{ color: "var(--app-body-text)" }}>{d.email}</span>
                    <span style={{ color: "var(--app-text-muted)" }}>· {d.quien}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="correo-asunto" style={labelStyle}>Asunto</label>
            <input
              id="correo-asunto" style={inputStyle}
              value={asunto} maxLength={200}
              onChange={(e) => setAsunto(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="correo-cuerpo" style={labelStyle}>Mensaje</label>
            <textarea
              id="correo-cuerpo" rows={8} maxLength={4000}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
            />
            <Marcas />
          </div>

          {(asunto.trim() !== "" || cuerpo.trim() !== "") && (
            <div>
              <span style={labelStyle}>Así lo va a leer</span>
              <div
                style={{
                  border: "1px dashed var(--app-border)", borderRadius: "0.5rem",
                  padding: "0.75rem 0.9rem", fontSize: "0.8125rem", lineHeight: 1.55,
                }}
              >
                <p style={{ margin: 0, fontWeight: 600, color: "var(--app-body-text)" }}>
                  {renderPlantilla(asunto, vista)}
                </p>
                <p style={{ margin: "0.5rem 0 0", color: "var(--app-nav-text)", whiteSpace: "pre-wrap" }}>
                  {renderPlantilla(cuerpo, vista)}
                </p>
              </div>
              {programar && (
                <p style={{ fontSize: "0.7rem", color: "var(--app-text-muted)", marginTop: "0.3rem" }}>
                  Los importes y los días se vuelven a calcular en el momento de salir.
                </p>
              )}
            </div>
          )}

          <div>
            <span style={labelStyle}>Cuándo</span>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.8125rem", color: "var(--app-nav-text)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <input type="radio" name="correo-cuando" checked={!programar} onChange={() => setProgramar(false)} />
                Ahora
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <input type="radio" name="correo-cuando" checked={programar} onChange={() => setProgramar(true)} />
                Programar
              </label>
            </div>
            {programar && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.6rem", maxWidth: "22rem" }}>
                  <input
                    type="date" aria-label="Día" style={inputStyle}
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                  <select
                    aria-label="Hora" style={inputStyle}
                    value={hora}
                    onChange={(e) => setHora(Number(e.target.value))}
                  >
                    {HORAS.map((h) => (
                      <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </div>
                <p style={{ fontSize: "0.7rem", color: "var(--app-text-muted)", marginTop: "0.3rem" }}>
                  Hora de Colombia. Sale en los minutos siguientes a la hora elegida y se puede cancelar hasta entonces.
                </p>
              </>
            )}
          </div>

          {error && <p style={{ fontSize: "0.8125rem", color: "#b91c1c", margin: 0 }}>{error}</p>}

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button" onClick={enviar} disabled={isPending || !puedeEnviar}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                backgroundColor: "#fd1384", color: "#fff", border: "none", borderRadius: "0.5rem",
                padding: "0.5rem 1.1rem", fontSize: "0.875rem", fontWeight: 500,
                cursor: isPending ? "wait" : puedeEnviar ? "pointer" : "not-allowed",
                opacity: isPending || !puedeEnviar ? 0.6 : 1,
              }}
            >
              {programar
                ? <><Clock style={{ width: "0.9rem", height: "0.9rem" }} /> {isPending ? "Programando..." : "Programar envío"}</>
                : <><Send style={{ width: "0.9rem", height: "0.9rem" }} /> {isPending ? "Enviando..." : "Enviar ahora"}</>}
            </button>
            <button
              type="button" onClick={() => setAbierto(false)}
              style={{
                background: "none", border: "1px solid var(--app-border)", borderRadius: "0.5rem",
                padding: "0.5rem 0.9rem", fontSize: "0.875rem", color: "var(--app-text-muted)", cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {correos.length > 0 ? (
        <div style={{ marginTop: "1rem" }}>
          <EmailLog correos={correos} />
        </div>
      ) : (
        !abierto && (
          <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: "0.85rem 0 0" }}>
            Todavía no se le ha mandado ninguno por este cobro.
          </p>
        )
      )}
    </div>
  );
}
