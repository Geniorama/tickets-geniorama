/**
 * El ícono de GENIA: un genio que sale del pico de la lámpara, con un destello.
 * Trazo como los de lucide para que conviva con el resto de íconos; toma el
 * color de `currentColor`.
 *
 * El mismo dibujo va como texto en el widget para otros sitios
 * (`src/app/embed/widget.js/route.ts`, `GENIE_SVG_PATHS`): si cambia aquí,
 * cambia allá.
 */
export const GENIE_SVG_PATHS =
  '<path d="M2 18.6h10.5c0 1.6-2.35 2.8-5.25 2.8S2 20.2 2 18.6Z"/>' +
  '<path d="M2 19c-.8 0-1.3-.6-1.1-1.3"/>' +
  '<path d="M12.5 19c2.4 0 4-1 4.6-2.9"/>' +
  '<path d="M17.1 16.1c-.5-1.3-.4-2.2.4-2.8"/>' +
  '<path d="M12 12.8c.5-2.4 2.3-3.9 4.5-3.9s4 1.5 4.5 3.9"/>' +
  '<circle cx="16.5" cy="5.6" r="2.2"/>' +
  '<path d="M13.3 4.6c.3-1.9 1.6-3 3.2-3s2.9 1.1 3.2 3"/>' +
  '<path d="M6.5 6.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z"/>';

export function GenieIcon({
  style, className, strokeWidth = 1.8,
}: {
  style?: React.CSSProperties;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
      className={className}
      dangerouslySetInnerHTML={{ __html: GENIE_SVG_PATHS }}
    />
  );
}
