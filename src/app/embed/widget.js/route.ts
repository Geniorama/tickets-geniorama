/**
 * El script que se pega en otros sitios para mostrar el asistente:
 *
 *   <script src="https://app.geniorama.co/embed/widget.js" defer></script>
 *
 * Pone un botón flotante y, al pulsarlo, abre el chat en un iframe servido
 * desde la plataforma (`/embed/asistente`). Todo lo sensible —el inicio de
 * sesión, el token, la conversación— vive dentro del iframe, en el dominio de
 * la plataforma; el sitio anfitrión no puede leerlo.
 *
 * Opcionales en la etiqueta: `data-color="#fd1384"`, `data-position="left"` y
 * `data-label="¿Necesitas ayuda?"` (el texto del botón al pasar el ratón).
 */

import { GENIE_SVG_PATHS } from "@/components/ui/genie-icon";

const APP_ORIGIN = new URL(process.env.AUTH_URL ?? "http://localhost:3000").origin;

const script = (origin: string) => `(function () {
  if (window.__genioramaAgentWidget) return;
  window.__genioramaAgentWidget = true;

  var APP = ${JSON.stringify(origin)};
  var tag = document.currentScript || {};
  var data = tag.dataset || {};
  var color = /^#[0-9a-fA-F]{3,8}$/.test(data.color || "") ? data.color : "#fd1384";
  var side = data.position === "left" ? "left" : "right";
  var label = data.label || "GENIA";
  var Z = 2147483000;

  var CHAT = ${JSON.stringify(`<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GENIE_SVG_PATHS}</svg>`)};
  var CLOSE = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  var button = document.createElement("button");
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = CHAT;
  var b = button.style;
  b.position = "fixed"; b.bottom = "20px"; b[side] = "20px"; b.zIndex = String(Z);
  b.width = "56px"; b.height = "56px"; b.borderRadius = "9999px"; b.border = "none";
  b.display = "flex"; b.alignItems = "center"; b.justifyContent = "center"; b.cursor = "pointer";
  b.background = color; b.color = "#ffffff"; b.boxShadow = "0 12px 28px rgba(0,0,0,0.25)";
  b.padding = "0"; b.margin = "0";

  var frame = null;
  var open = false;
  var mobile = window.matchMedia("(max-width: 480px)");

  function place() {
    if (!frame) return;
    var f = frame.style;
    if (mobile.matches) {
      f.top = "0"; f.left = "0"; f.right = "0"; f.bottom = "0";
      f.width = "100%"; f.height = "100%"; f.borderRadius = "0";
    } else {
      f.top = "auto"; f.left = side === "left" ? "20px" : "auto"; f.right = side === "right" ? "20px" : "auto"; f.bottom = "88px";
      f.width = "380px"; f.height = "min(620px, calc(100vh - 108px))"; f.borderRadius = "16px";
    }
    b.display = open && mobile.matches ? "none" : "flex";
  }

  function setOpen(next) {
    open = next;
    if (open && !frame) {
      frame = document.createElement("iframe");
      frame.src = APP + "/embed/asistente";
      frame.title = label;
      // El origen de esta página tiene que llegar a la plataforma para
      // comprobar que el sitio está autorizado, aunque el sitio lo oculte.
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.allow = "clipboard-write";
      var f = frame.style;
      f.position = "fixed"; f.zIndex = String(Z); f.border = "0"; f.background = "#ffffff";
      f.boxShadow = "0 24px 48px rgba(0,0,0,0.22)"; f.colorScheme = "light";
      document.body.appendChild(frame);
    }
    if (frame) frame.style.display = open ? "block" : "none";
    button.innerHTML = open ? CLOSE : CHAT;
    button.setAttribute("aria-expanded", open ? "true" : "false");
    place();
  }

  button.addEventListener("click", function () { setOpen(!open); });
  window.addEventListener("message", function (e) {
    if (e.origin !== APP || !e.data || e.data.type !== "geniorama-widget-close") return;
    setOpen(false);
  });
  if (mobile.addEventListener) mobile.addEventListener("change", place);

  function mount() { document.body.appendChild(button); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
`;

export function GET() {
  return new Response(script(APP_ORIGIN), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
