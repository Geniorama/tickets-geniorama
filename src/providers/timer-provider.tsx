"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ActiveTimer = {
  type: "ticket" | "task";
  resourceId: string;
  projectId?: string; // solo para tasks
  title: string;
  startedAt: string; // ISO — inicio de la sesión activa
};

type TimerContextType = {
  timers: ActiveTimer[];
  registerTimer: (timer: ActiveTimer) => void;
  unregisterTimer: (type: "ticket" | "task", resourceId: string) => void;
};

const TimerContext = createContext<TimerContextType>({
  timers: [],
  registerTimer: () => {},
  unregisterTimer: () => {},
});

export function useTimerContext() {
  return useContext(TimerContext);
}

export function TimerProvider({
  initialTimers,
  children,
}: {
  initialTimers: ActiveTimer[];
  children: React.ReactNode;
}) {
  const [timers, setTimers] = useState<ActiveTimer[]>(initialTimers);

  const registerTimer = useCallback((timer: ActiveTimer) => {
    setTimers((prev) => {
      const rest = prev.filter(
        (t) => !(t.type === timer.type && t.resourceId === timer.resourceId),
      );
      return [...rest, timer];
    });
  }, []);

  const unregisterTimer = useCallback(
    (type: "ticket" | "task", resourceId: string) => {
      setTimers((prev) =>
        prev.filter((t) => !(t.type === type && t.resourceId === resourceId)),
      );
    },
    [],
  );

  // Detener todos los timers al cerrar la pestaña o el navegador
  useEffect(() => {
    const pause = () => {
      if (timers.length > 0) {
        navigator.sendBeacon("/api/timer/pause-all");
      }
    };
    window.addEventListener("beforeunload", pause);
    window.addEventListener("pagehide", pause); // iOS / Safari
    return () => {
      window.removeEventListener("beforeunload", pause);
      window.removeEventListener("pagehide", pause);
    };
  }, [timers.length]);

  return (
    <TimerContext.Provider value={{ timers, registerTimer, unregisterTimer }}>
      {children}
    </TimerContext.Provider>
  );
}
