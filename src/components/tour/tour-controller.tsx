"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { getWelcomeTour, getPageTour, type TourDef } from "@/lib/tours";
import type { Role } from "@/generated/prisma";

const STORAGE_KEY = "geniorama:tours-seen";

function seenSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

function markSeen(key: string) {
  try {
    const s = seenSet();
    s.add(key);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
  } catch {
    /* ignorar */
  }
}

/** ¿El elemento existe y está visible dentro del viewport horizontal?
 *  (descarta, p. ej., el sidebar móvil desplazado fuera de pantalla). */
function isVisible(selector: string): boolean {
  const el = document.querySelector(selector);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth;
}

function runTour(tour: TourDef, onDone?: () => void) {
  const steps = tour.steps.filter((s) => !s.selector || isVisible(s.selector));
  if (steps.length === 0) {
    onDone?.();
    return;
  }
  const d = driver({
    showProgress: true,
    allowClose: true,
    overlayColor: "rgba(0,0,0,0.55)",
    nextBtnText: "Siguiente",
    prevBtnText: "Atrás",
    doneBtnText: "Listo",
    progressText: "{{current}} de {{total}}",
    steps: steps.map((s) => ({
      element: s.selector,
      popover: {
        title: s.title,
        description: s.description,
        side: s.side ?? "bottom",
        align: s.align ?? "start",
      },
    })),
    onDestroyed: () => onDone?.(),
  });
  d.drive();
}

export function TourController({ role }: { role: Role }) {
  const pathname = usePathname();

  // Tour de bienvenida — una sola vez (primer ingreso)
  useEffect(() => {
    if (seenSet().has("welcome")) return;
    const t = setTimeout(() => runTour(getWelcomeTour(role), () => markSeen("welcome")), 800);
    return () => clearTimeout(t);
  }, [role]);

  // Tour por página — al entrar a cada módulo por primera vez (tras la bienvenida)
  useEffect(() => {
    const seen = seenSet();
    if (!seen.has("welcome")) return; // no apilar sobre la bienvenida
    const tour = getPageTour(pathname);
    if (!tour || seen.has(tour.key)) return;
    const t = setTimeout(() => runTour(tour, () => markSeen(tour.key)), 700);
    return () => clearTimeout(t);
  }, [pathname, role]);

  // Lanzamiento manual desde el botón de ayuda
  useEffect(() => {
    function onStart(e: Event) {
      const which = (e as CustomEvent<string>).detail;
      if (which === "welcome") {
        runTour(getWelcomeTour(role), () => markSeen("welcome"));
      } else {
        const tour = getPageTour(pathname);
        if (tour) runTour(tour, () => markSeen(tour.key));
      }
    }
    window.addEventListener("geniorama:start-tour", onStart as EventListener);
    return () => window.removeEventListener("geniorama:start-tour", onStart as EventListener);
  }, [pathname, role]);

  return null;
}
