/**
 * Emparejar empresas de aquí con clientes de Xubio.
 *
 * Todo esto es puro a propósito: decide si una empresa «ya existe» allá, y
 * equivocarse significa duplicar un cliente en la contabilidad o facturarle a
 * quien no era. Hay que poder probarlo sin credenciales y sin tocar nada.
 */

/** Solo los dígitos. «900.123.456-7» → «9001234567». */
export function soloDigitos(nit: string | null | undefined): string {
  return (nit ?? "").replace(/\D/g, "");
}

/**
 * Si dos identificaciones tributarias son la misma.
 *
 * En Colombia el NIT se escribe con o sin dígito de verificación —«900123456»
 * y «900123456-7» son la misma empresa— y cada sistema lo guarda a su manera.
 * Se comparan los dígitos y se acepta que a uno le sobre el último: es
 * exactamente el dígito de verificación.
 */
export function mismoNit(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = soloDigitos(a);
  const y = soloDigitos(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length === y.length + 1) return x.slice(0, -1) === y;
  if (y.length === x.length + 1) return y.slice(0, -1) === x;
  return false;
}

/**
 * Palabras que solo indican la forma societaria.
 *
 * Se quitan **ficha a ficha desde el final**, no como grupo: al limpiar la
 * puntuación, «S.A.S.» se convierte en tres letras sueltas —«s», «a», «s»— y
 * mirar solo las dos últimas dejaba «acme s a», que no empareja con «ACME SAS».
 */
const SUFIJOS = new Set([
  "s", "a", "l", "r", "u", "e", "c",
  "sas", "sa", "ltda", "limitada", "sac", "srl", "eu", "spa",
  "inc", "llc", "corp", "co", "cia", "compania",
]);

/**
 * El nombre de una empresa, comparable.
 *
 * Sin acentos, sin puntuación y sin la forma societaria: «Acme S.A.S.» y
 * «ACME SAS» son la misma empresa, y nadie las escribe igual dos veces.
 *
 * Nunca devuelve vacío: una empresa que se llame «SAS» conserva su nombre.
 */
export function normalizarNombre(nombre: string): string {
  const palabras = nombre
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  while (palabras.length > 1 && SUFIJOS.has(palabras[palabras.length - 1])) {
    palabras.pop();
  }
  return palabras.join(" ");
}

export type EmpresaLocal = { id: string; name: string; taxId: string | null; xubioClientId: string | null };
export type ClienteXubio = { id: string; nombre: string; nit: string | null };

export type Pareja = {
  empresa: EmpresaLocal;
  /** El cliente de Xubio, si se encontró. */
  cliente: ClienteXubio | null;
  /** Cómo se encontró, para poder explicarlo en pantalla. */
  por: "vinculo" | "nit" | "nombre" | null;
  /**
   * Más de un candidato con el mismo nombre. No se empareja sola: elegir mal
   * significa facturarle a otro cliente.
   */
  ambiguo: boolean;
};

/**
 * Empareja por vínculo guardado, luego por NIT, luego por nombre.
 *
 * El orden importa. El vínculo manda porque alguien ya lo decidió. El NIT es
 * el identificador de verdad. El nombre es el último recurso y el único que
 * puede confundirse, así que si hay más de un candidato se marca y no se
 * empareja: es preferible que una persona elija a facturarle a quien no era.
 */
export function emparejar(empresas: EmpresaLocal[], clientes: ClienteXubio[]): Pareja[] {
  const porId = new Map(clientes.map((c) => [c.id, c]));

  const porNombre = new Map<string, ClienteXubio[]>();
  for (const c of clientes) {
    const clave = normalizarNombre(c.nombre);
    if (!clave) continue;
    porNombre.set(clave, [...(porNombre.get(clave) ?? []), c]);
  }

  return empresas.map((empresa) => {
    if (empresa.xubioClientId) {
      const cliente = porId.get(empresa.xubioClientId) ?? null;
      // Vínculo guardado que ya no está allá: se avisa en vez de reemparejar a
      // ciegas, porque puede significar que alguien lo borró en Xubio.
      return { empresa, cliente, por: cliente ? "vinculo" : null, ambiguo: false };
    }

    if (empresa.taxId) {
      const porNit = clientes.filter((c) => mismoNit(c.nit, empresa.taxId));
      if (porNit.length === 1) return { empresa, cliente: porNit[0], por: "nit", ambiguo: false };
      if (porNit.length > 1) return { empresa, cliente: null, por: null, ambiguo: true };
    }

    const candidatos = porNombre.get(normalizarNombre(empresa.name)) ?? [];
    if (candidatos.length === 1) return { empresa, cliente: candidatos[0], por: "nombre", ambiguo: false };
    return { empresa, cliente: null, por: null, ambiguo: candidatos.length > 1 };
  });
}
