"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, Compass, MapPin } from "lucide-react";
import { hasPageTour } from "@/lib/tours";

function startTour(which: "welcome" | "page") {
  window.dispatchEvent(new CustomEvent("geniorama:start-tour", { detail: which }));
}

/** Botón de ayuda en la barra superior: relanza el tour de bienvenida o el de la sección actual. */
export function TourHelpButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const pageTour = hasPageTour(pathname);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative" data-tour-id="tour-help">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
        style={{ color: "var(--app-icon-color)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--app-body-text)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--app-icon-color)")}
        title="Ayuda y tour guiado"
        aria-label="Ayuda y tour guiado"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-30 rounded-lg shadow-xl py-1 min-w-[220px]"
          style={{ backgroundColor: "var(--dropdown-bg)", border: "1px solid var(--dropdown-border)" }}
        >
          <button
            type="button"
            onClick={() => { setOpen(false); startTour("welcome"); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm"
            style={{ color: "var(--dropdown-text)" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--dropdown-hover-bg)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
          >
            <Compass className="w-4 h-4 shrink-0" />
            Tour de bienvenida
          </button>
          {pageTour && (
            <button
              type="button"
              onClick={() => { setOpen(false); startTour("page"); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-sm"
              style={{ color: "var(--dropdown-text)" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--dropdown-hover-bg)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              <MapPin className="w-4 h-4 shrink-0" />
              Recorrido de esta sección
            </button>
          )}
        </div>
      )}
    </div>
  );
}
