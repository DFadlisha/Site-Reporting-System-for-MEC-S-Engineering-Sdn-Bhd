// src/components/notifications/NotificationsPage.js
import React, { useEffect, useState } from "react";
import { Bell, CheckCheck, Info, CheckCircle, AlertTriangle, XCircle, BellOff } from "lucide-react";
import Topbar from "../shared/Topbar";
import { subscribeNotifications, markNotificationRead } from "../../firebase/services";
import { useAuth } from "../../contexts/AuthContext";

function timeAgo(date) {
  if (!date) return "Just now";
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

function getTypeConfig(type) {
  switch (type) {
    case "success": return { icon: CheckCircle, bg: "rgba(63,185,80,0.12)", color: "var(--success)", label: "Success" };
    case "error":   return { icon: XCircle,     bg: "rgba(248,81,73,0.12)",  color: "var(--danger)",  label: "Error" };
    case "warning": return { icon: AlertTriangle,bg: "rgba(210,153,34,0.12)",color: "var(--warning)", label: "Warning" };
    default:        return { icon: Info,         bg: "rgba(88,166,255,0.12)", color: "var(--info)",    label: "Info" };
  }
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("all"); // all | unread | read

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeNotifications(user.uid, setNotifications);
    return unsub;
  }, [user]);

  const markAll = () => {
    notifications.filter((n) => !n.read).forEach((n) => markNotificationRead(n.id));
  };

  const unread = notifications.filter((n) => !n.read).length;

  const filtered = notifications.filter(n => {
    if (filter === "unread") return !n.read;
    if (filter === "read")   return n.read;
    return true;
  });

  return (
    <div>
      <Topbar title="Notifications" />
      <div className="page-body">

        {/* Header bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 24, flexWrap: "wrap", gap: 12
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Bell size={20} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-primary)" }}>Notifications</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                {unread > 0 ? <><span style={{ color: "var(--accent)", fontWeight: 700 }}>{unread} unread</span> · {notifications.length} total</> : `${notifications.length} total`}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Filter tabs */}
            <div style={{ display: "flex", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 8, padding: 3, gap: 2 }}>
              {["all", "unread", "read"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: "0.78rem", fontWeight: 600, transition: "all 0.15s",
                  background: filter === f ? "var(--accent)" : "transparent",
                  color: filter === f ? "#fff" : "var(--text-secondary)",
                }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {unread > 0 && (
              <button onClick={markAll} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--bg-elevated)", color: "var(--text-primary)",
                fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
              }}>
                <CheckCheck size={14} color="var(--success)" /> Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Notification list */}
        {filtered.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "80px 20px", gap: 16
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%", background: "var(--bg-elevated)",
              border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <BellOff size={28} color="var(--text-muted)" />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)", marginBottom: 6 }}>
                {filter === "unread" ? "No unread notifications" : filter === "read" ? "No read notifications" : "You're all caught up!"}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                New notifications from your consultant will appear here.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 720 }}>
            {filtered.map((n) => {
              const cfg = getTypeConfig(n.type);
              const IconComp = cfg.icon;
              const ts = n.createdAt?.toDate ? n.createdAt.toDate() : null;

              return (
                <div
                  key={n.id}
                  onClick={() => !n.read && markNotificationRead(n.id)}
                  style={{
                    display: "flex", gap: 14, alignItems: "flex-start",
                    padding: "14px 18px", borderRadius: 12,
                    background: n.read ? "var(--bg-elevated)" : "var(--bg-card)",
                    border: `1px solid ${n.read ? "var(--border)" : cfg.color + "55"}`,
                    cursor: n.read ? "default" : "pointer",
                    transition: "all 0.15s",
                    opacity: n.read ? 0.75 : 1,
                    boxShadow: n.read ? "none" : "0 2px 8px rgba(0,0,0,0.12)",
                  }}
                >
                  {/* Icon chip */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: n.read ? "var(--bg-surface)" : cfg.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <IconComp size={18} color={n.read ? "var(--text-muted)" : cfg.color} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: "0.88rem", lineHeight: 1.55, margin: 0,
                      color: n.read ? "var(--text-secondary)" : "var(--text-primary)",
                      fontWeight: n.read ? 400 : 500,
                    }}>
                      {n.message}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <span style={{
                        fontSize: "0.72rem", fontWeight: 700, padding: "1px 7px", borderRadius: 20,
                        background: n.read ? "var(--bg-surface)" : cfg.bg,
                        color: n.read ? "var(--text-muted)" : cfg.color,
                        border: `1px solid ${n.read ? "var(--border)" : cfg.color + "44"}`,
                      }}>
                        {cfg.label}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        {ts ? timeAgo(ts) : "Just now"}
                      </span>
                    </div>
                  </div>

                  {/* Unread dot */}
                  {!n.read && (
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: cfg.color, marginTop: 6,
                      boxShadow: `0 0 6px ${cfg.color}`,
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
