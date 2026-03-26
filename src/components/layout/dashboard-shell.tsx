"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { FloatingTimer } from "./floating-timer";
import type { Session } from "next-auth";
import type { Role } from "@/generated/prisma";

export function DashboardShell({
  role,
  user,
  unreadCount,
  children,
}: {
  role: Role;
  user: Session["user"];
  unreadCount: number;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen" style={{ backgroundColor: "var(--app-sidebar-bg)" }}>
      {/* Backdrop mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        role={role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Topbar
          user={user}
          unreadCount={unreadCount}
          onMenuClick={() => setSidebarOpen((v) => !v)}
        />
        <main
          className="flex-1 overflow-y-auto p-4 md:p-6"
          style={{ backgroundColor: "var(--app-content-bg)" }}
        >
          {children}
        </main>
      </div>

      <FloatingTimer />
    </div>
  );
}
