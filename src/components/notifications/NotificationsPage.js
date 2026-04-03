// src/components/notifications/NotificationsPage.js
import React, { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import Topbar from "../shared/Topbar";
import { subscribeNotifications, markNotificationRead } from "../../firebase/services";
import { useAuth } from "../../contexts/AuthContext";

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeNotifications(user.uid, setNotifications);
    return unsub;
  }, [user]);

  const markAll = () => {
    notifications.filter((n) => !n.read).forEach((n) => markNotificationRead(n.id));
  };

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <Topbar title="Notifications" />
      <div className="page-body">
        <div className="page-header">
          <div>
            <h2 className="page-title">Notifications</h2>
            <p className="page-subtitle">{unread} unread</p>
          </div>
          {unread > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={markAll}>
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="tk-empty">
            <Bell size={40} />
            <p>No notifications yet</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                className="card"
                style={{
                  display: "flex", gap: 14, alignItems: "flex-start",
                  opacity: n.read ? 0.6 : 1,
                  cursor: n.read ? "default" : "pointer",
                  borderColor: n.read ? "var(--border)" : "var(--accent)",
                  padding: "14px 18px",
                }}
                onClick={() => !n.read && markNotificationRead(n.id)}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                  marginTop: 5,
                  background: n.read ? "var(--text-muted)" : n.type === "error" ? "var(--danger)" : n.type === "success" ? "var(--success)" : "var(--accent)",
                }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>{n.message}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 4 }}>
                    {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : "Just now"}
                  </p>
                </div>
                {!n.read && (
                  <span className="badge badge-pending" style={{ fontSize: "0.7rem" }}>New</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
