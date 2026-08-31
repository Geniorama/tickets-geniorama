"use client";

import { useRef } from "react";

/**
 * Campo de dinero con separadores de miles mientras se escribe.
 *
 * Sin ellos, «1200000» y «12000000» se distinguen contando ceros con el dedo,
 * y en un importe de factura equivocarse en un cero no es un detalle.
 *
 * Lo que se envía es el texto formateado —«1.200.000»—; el servidor ya lo
 * entiende, porque `parseAmount` quita los puntos. Así no hace falta un campo
 * oculto en paralelo que pueda desincronizarse del visible.
 */

/** Solo dígitos: en pesos colombianos no se teclean centavos. */
function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

function conSeparadores(digitos: string): string {
  if (!digitos) return "";
  // Se quitan los ceros de la izquierda para que «007» no quede como «007».
  const n = Number(digitos);
  return Number.isFinite(n) ? n.toLocaleString("es-CO") : "";
}

/** Acepta lo que venga guardado (un número) o lo ya tecleado (texto). */
export function formatearImporte(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  return conSeparadores(soloDigitos(String(valor)));
}

export function AmountInput({
  value,
  onValueChange,
  name,
  defaultValue,
  placeholder,
  required,
  style,
  ariaLabel,
  id,
}: {
  /** Controlado: el texto tal cual se muestra. */
  value?: string;
  /** Devuelve el texto ya formateado, listo para volver como `value`. */
  onValueChange?: (formateado: string) => void;
  name?: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  required?: boolean;
  style?: React.CSSProperties;
  ariaLabel?: string;
  id?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const antes = input.value;
    const caret = input.selectionStart ?? antes.length;

    // Cuántos dígitos había a la izquierda del cursor: es lo que hay que
    // conservar. Si solo se pusiera el cursor al final, editar en medio de un
    // número saltaría al final en cada tecla.
    const digitosAntesDelCaret = soloDigitos(antes.slice(0, caret)).length;

    const formateado = conSeparadores(soloDigitos(antes));
    onValueChange?.(formateado);

    // Se reposiciona tras el repintado, contando dígitos en vez de caracteres.
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      if (el.value !== formateado) el.value = formateado;

      let vistos = 0;
      let pos = formateado.length;
      for (let i = 0; i < formateado.length; i++) {
        if (/\d/.test(formateado[i])) vistos++;
        if (vistos === digitosAntesDelCaret) { pos = i + 1; break; }
      }
      if (digitosAntesDelCaret === 0) pos = 0;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <input
      ref={ref}
      id={id}
      name={name}
      // `inputMode` saca el teclado numérico en el móvil; `type="text"` y no
      // `number` porque los puntos no caben en un campo numérico.
      inputMode="numeric"
      autoComplete="off"
      required={required}
      placeholder={placeholder}
      aria-label={ariaLabel}
      style={style}
      {...(value !== undefined
        ? { value }
        : { defaultValue: formatearImporte(defaultValue) })}
      onChange={handleChange}
    />
  );
}
