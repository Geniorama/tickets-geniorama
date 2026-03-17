"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export function SearchInput({ placeholder = "Buscar..." }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const isSelfPush = useRef(false);

  // Sync from URL only when changed externally (not by our own push)
  useEffect(() => {
    if (isSelfPush.current) return;
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  // Debounced URL push on typing
  useEffect(() => {
    const q = value.trim();
    const current = searchParams.get("q") ?? "";
    if (q === current) return;
    const timer = setTimeout(() => {
      isSelfPush.current = true;
      const next = new URLSearchParams(searchParams.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      next.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`);
        // Reset flag after navigation settles
        setTimeout(() => { isSelfPush.current = false; }, 600);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: "relative", minWidth: "220px", flex: 1, maxWidth: "360px" }}>
      <Search
        style={{
          position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)",
          width: "0.9375rem", height: "0.9375rem", color: "var(--app-text-muted)", pointerEvents: "none",
        }}
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box",
          paddingLeft: "2.25rem", paddingRight: value ? "2rem" : "0.75rem",
          paddingTop: "0.5rem", paddingBottom: "0.5rem",
          border: "1px solid var(--app-border)", borderRadius: "0.5rem",
          fontSize: "0.875rem", color: "var(--app-body-text)",
          backgroundColor: "var(--app-card-bg)", outline: "none",
        }}
      />
      {value && (
        <button
          onClick={() => setValue("")}
          style={{
            position: "absolute", right: "0.625rem", top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer",
            fontSize: "0.75rem", color: "var(--app-text-muted)",
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
