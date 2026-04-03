// src/components/shared/Topbar.js
import React, { useState, useEffect } from "react";
import { Bell, Search, X, Moon, Sun, Menu } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { subscribeNotifications, markNotificationRead } from "../../firebase/services";
import "./Topbar.css";

export default function Topbar({ title }) {
  const { user } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeNotifications(user.uid, setNotifications);
    return unsub;
  }, [user]);

  const unread = notifications.filter((n) => !n.read).length;

  const handleMarkRead = (id) => {
    markNotificationRead(id);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button 
          className="topbar-icon-btn topbar-mobile-menu" 
          onClick={() => window.dispatchEvent(new Event('toggle-sidebar'))}
          aria-label="Toggle Sidebar"
        >
          <Menu size={18} />
        </button>
        <h1 className="topbar-title">{title}</h1>
      </div>
      <div className="topbar-right">
        <button className="topbar-icon-btn" onClick={toggleTheme} title="Toggle Theme">
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className="topbar-notif-wrapper">
          <button
            className="topbar-icon-btn"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <Bell size={18} />
            {unread > 0 && <span className="notif-badge">{unread}</span>}
          </button>

          {showDropdown && (
            <div className="notif-dropdown">
              <div className="notif-dropdown-header">
                <span>Notifications</span>
                <button onClick={() => setShowDropdown(false)}><X size={14}/></button>
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <p className="notif-empty">No notifications yet</p>
                ) : (
                  notifications.slice(0, 10).map((n) => (
                    <div
                      key={n.id}
                      className={`notif-item ${n.read ? "read" : "unread"}`}
                      onClick={() => handleMarkRead(n.id)}
                    >
                      <div className="notif-dot" />
                      <div>
                        <p className="notif-msg">{n.message}</p>
                        <p className="notif-time">
                          {n.createdAt?.toDate
                            ? n.createdAt.toDate().toLocaleString()
                            : "Just now"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
