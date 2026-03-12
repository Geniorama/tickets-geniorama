"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  type NotificationItem,
} from "@/actions/notification.actions";

function timeAgo(date: Date | string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export function NotificationBell({ initialUnreadCount }: { initialUnreadCount: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Polling del contador cada 60 segundos
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isOpen) {
        const count = await getUnreadCount();
        setUnreadCount(count);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [isOpen]);

  async function handleToggle() {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening) {
      const data = await getNotifications();
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.isRead).length);
      setLoaded(true);
    }
  }

  async function handleItemClick(n: NotificationItem) {
    if (!n.isRead) {
      await markAsRead(n.id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setIsOpen(false);
    if (n.link) router.push(n.link);
  }

  function handleMarkAll() {
    startTransition(async () => {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    });
  }

  const badge = Math.min(unreadCount, 99);

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Botón campana */}
      <button
        onClick={handleToggle}
        title="Notificaciones"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "2rem",
          height: "2rem",
          borderRadius: "0.5rem",
          border: "none",
          background: "none",
          cursor: "pointer",
          color: isOpen ? "#fd1384" : "var(--app-icon-color)",
        }}
      >
        <Bell style={{ width: "1.125rem", height: "1.125rem" }} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              transform: "translate(35%, -35%)",
              backgroundColor: "#fd1384",
              color: "#fff",
              fontSize: "0.6rem",
              fontWeight: 700,
              lineHeight: 1,
              padding: "0.2rem 0.28rem",
              borderRadius: "9999px",
              minWidth: "1rem",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            {badge}{unreadCount > 99 ? "+" : ""}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 0.625rem)",
            right: 0,
            width: "22rem",
            maxHeight: "30rem",
            backgroundColor: "var(--app-card-bg)",
            border: "1px solid var(--app-border)",
            borderRadius: "0.75rem",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Cabecera */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.875rem 1rem",
              borderBottom: "1px solid var(--app-border)",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--app-body-text)" }}>
              Notificaciones
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={isPending}
                style={{
                  fontSize: "0.75rem",
                  color: "#fd1384",
                  background: "none",
                  border: "none",
                  cursor: isPending ? "not-allowed" : "pointer",
                  opacity: isPending ? 0.5 : 1,
                  fontWeight: 500,
                  padding: 0,
                }}
              >
                Marcar todo como leído
              </button>
            )}
          </div>

          {/* Lista */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {!loaded ? (
              <p
                style={{
                  padding: "2rem 1rem",
                  textAlign: "center",
                  fontSize: "0.875rem",
                  color: "var(--app-text-muted)",
                }}
              >
                Cargando…
              </p>
            ) : notifications.length === 0 ? (
              <div style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
                <Bell
                  style={{
                    width: "1.75rem",
                    height: "1.75rem",
                    color: "var(--app-text-muted)",
                    margin: "0 auto 0.625rem",
                    display: "block",
                  }}
                />
                <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
                  Sin notificaciones
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "0.75rem 1rem",
                    border: "none",
                    borderBottom: "1px solid var(--app-border)",
                    cursor: "pointer",
                    backgroundColor: n.isRead ? "transparent" : "rgba(253,19,132,0.05)",
                    display: "flex",
                    gap: "0.625rem",
                    alignItems: "flex-start",
                  }}
                >
                  {/* Punto no leído */}
                  <span
                    style={{
                      width: "0.5rem",
                      height: "0.5rem",
                      borderRadius: "9999px",
                      backgroundColor: n.isRead ? "transparent" : "#fd1384",
                      flexShrink: 0,
                      marginTop: "0.3125rem",
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: n.isRead ? 400 : 600,
                        color: "var(--app-body-text)",
                        marginBottom: "0.125rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {n.title}
                    </p>
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--app-text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {n.message}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      color: "var(--app-text-muted)",
                      flexShrink: 0,
                      marginTop: "0.125rem",
                    }}
                  >
                    {timeAgo(n.createdAt)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
