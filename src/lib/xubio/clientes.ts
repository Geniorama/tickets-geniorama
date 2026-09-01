import { xubio } from "./client";
import type { ClienteXubio } from "./match";

/**
 * Los clientes de Xubio.
 *
 * Su API devuelve los campos con nombres que no están documentados fuera del
 * explorador, y que además cambian entre países. En vez de dar por hecho una
 * forma concreta, se leen varios nombres posibles y se guarda el registro
 * crudo para poder mirarlo cuando algo no cuadre. Es fácil ajustarlo cuando se
 * vea la respuesta real; lo que no se puede es fallar en silencio.
 */

/** Primer valor no vacío de una lista de posibles nombres de campo. */
function primero(fila: Record<string, unknown>, claves: string[]): string | null {
  for (const k of claves) {
    const v = fila[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

const CLAVES_ID     = ["clienteid", "clienteId", "ID", "id", "codigo"];
const CLAVES_NOMBRE = ["nombre", "razonSocial", "razon_social", "descripcion"];
const CLAVES_NIT    = ["CUIT", "cuit", "identificacionTributaria", "numeroDocumento", "nit", "documento"];

export function aClienteXubio(fila: Record<string, unknown>): ClienteXubio | null {
  const id = primero(fila, CLAVES_ID);
  const nombre = primero(fila, CLAVES_NOMBRE);
  // Sin id no sirve de nada: no se podría enlazar ni facturar contra él.
  if (!id || !nombre) return null;
  return { id, nombre, nit: primero(fila, CLAVES_NIT) };
}

export type ListaClientes = {
  clientes: ClienteXubio[];
  /** Cuántos vinieron y no se pudieron leer, para no fingir que no pasó nada. */
  ilegibles: number;
  /** Un registro tal cual llegó, para ver los nombres reales de los campos. */
  muestra: unknown;
};

export async function listarClientes() {
  const r = await xubio<unknown>("clienteBean");
  if (!r.ok) return r;

  const filas = Array.isArray(r.datos)
    ? (r.datos as Record<string, unknown>[])
    : [];

  const clientes: ClienteXubio[] = [];
  let ilegibles = 0;
  for (const f of filas) {
    const c = aClienteXubio(f);
    if (c) clientes.push(c);
    else ilegibles++;
  }

  return {
    ok: true as const,
    datos: { clientes, ilegibles, muestra: filas[0] ?? null } satisfies ListaClientes,
  };
}

/** Lo que se le manda a Xubio para dar de alta un cliente. */
export function cuerpoParaCrear(empresa: { name: string; taxId: string | null }) {
  return {
    nombre: empresa.name,
    // Se manda tal cual está guardado: el formato lo decide Xubio, y
    // «arreglarlo» aquí es cómo se acaba mandando un NIT que no es.
    ...(empresa.taxId ? { CUIT: empresa.taxId, identificacionTributaria: empresa.taxId } : {}),
  };
}

export async function crearCliente(empresa: { name: string; taxId: string | null }) {
  const r = await xubio<Record<string, unknown>>("clienteBean", {
    method: "POST",
    body: JSON.stringify(cuerpoParaCrear(empresa)),
  });
  if (!r.ok) return r;

  const creado = r.datos && typeof r.datos === "object" ? aClienteXubio(r.datos) : null;
  if (!creado) {
    return {
      ok: false as const,
      error: "Xubio aceptó el cliente pero no devolvió su identificador",
      detalle: JSON.stringify(r.datos).slice(0, 300),
    };
  }
  return { ok: true as const, datos: creado };
}
