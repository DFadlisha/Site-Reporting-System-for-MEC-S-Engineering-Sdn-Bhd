// src/components/shared/Sidebar.js
import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, CheckSquare,
  AlertTriangle, Bell, LogOut, Building2, ChevronRight, Users, Activity
} from "lucide-react";
import { logoutUser } from "../../firebase/services";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";
import "./Sidebar.css";

const NAV = [
  { to: "/dashboard",  icon: LayoutDashboard, label: "Dashboard" },
  { to: "/reports",    icon: ClipboardList,   label: "Daily Reports" },
  { to: "/tasks",      icon: CheckSquare,     label: "Task Tracking" },
  { to: "/issues",     icon: AlertTriangle,   label: "Issues" },
  { to: "/notifications", icon: Bell,         label: "Notifications" },
];

export default function Sidebar() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  React.useEffect(() => {
    const handler = () => setMobileOpen(o => !o);
    window.addEventListener('toggle-sidebar', handler);
    return () => window.removeEventListener('toggle-sidebar', handler);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  const handleLogout = async () => {
    await logoutUser();
    toast.success("Logged out");
    navigate("/login");
  };

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={closeMobile} />}
      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Building2 size={20} />
        </div>
        {!collapsed && (
          <div className="sidebar-logo-text">
            <span className="sidebar-brand">SPRS</span>
            <span className="sidebar-brand-sub">MEC's Engineering</span>
          </div>
        )}
        <button className="sidebar-collapse-btn" onClick={() => setCollapsed(!collapsed)}>
          <ChevronRight size={14} style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "0.2s" }} />
        </button>
      </div>

      {/* Profile pill */}
      {!collapsed && profile && (
        <div className="sidebar-profile">
          <div className="sidebar-avatar">{profile.name?.[0]?.toUpperCase()}</div>
          <div className="sidebar-profile-info">
            <span className="sidebar-profile-name">{profile.name}</span>
            <span className="sidebar-profile-role">{profile.role}</span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={closeMobile}
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
          >
            <Icon size={18} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
        {profile?.role === "admin" ? (
          <>
            <NavLink
              to="/users"
              onClick={closeMobile}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            >
              <Users size={18} />
              {!collapsed && <span>User Management</span>}
            </NavLink>
            <NavLink
              to="/audit"
              onClick={closeMobile}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            >
              <Activity size={18} />
              {!collapsed && <span>Audit Logs</span>}
            </NavLink>
          </>
        ) : null}
      </nav>

      {/* Logout */}
      <button className="sidebar-logout" onClick={handleLogout}>
        <LogOut size={18} />
        {!collapsed && <span>Logout</span>}
      </button>
    </aside>
    </>
  );
}
