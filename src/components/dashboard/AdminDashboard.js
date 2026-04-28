// src/components/dashboard/AdminDashboard.js
import React, { useEffect, useState, useMemo } from "react";
import {
  Users, Clock, FolderOpen, AlertTriangle, CheckCircle, XCircle,
  UserCheck, UserX, ArrowRight, Bell, TrendingDown, Megaphone,
  UserMinus, RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Topbar from "../shared/Topbar";
import {
  subscribeSystemUsers, subscribeProjects, subscribeIssues,
  subscribeNotifications, approveUser, rejectUser, markNotificationRead,
} from "../../firebase/services";
import { useAuth } from "../../contexts/AuthContext";
import { differenceInDays, parseISO, formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import "./AdminDashboard.css";

// ── Helpers ──────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts?.toDate) return "Just now";
  try { return formatDistanceToNow(ts.toDate(), { addSuffix: true }); }
  catch { return "Just now"; }
}

function projectStatus(p) {
  if (p.status === "completed" || p.progress >= 100) return "completed";
  if (!p.endDate) return "active";
  const days = differenceInDays(new Date(), parseISO(p.endDate));
  if (days > 0) return "delayed";
  if (days > -7) return "at-risk";
  return "on-track";
}

function statusLabel(s) {
  switch (s) {
    case "delayed":   return "Delayed";
    case "at-risk":   return "At Risk";
    case "on-track":  return "On Track";
    case "completed": return "Completed";
    default:          return "Active";
  }
}

export default function AdminDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [users,         setUsers]         = useState([]);
  const [projects,      setProjects]      = useState([]);
  const [issues,        setIssues]        = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [rejectModal, setRejectModal]   = useState({ open: false, user: null });
  const [rejectReason, setRejectReason] = useState("");
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    const u1 = subscribeSystemUsers(setUsers);
    const u2 = subscribeProjects(setProjects);
    const u4 = subscribeIssues(setIssues);
    let u5;
    if (user?.uid) u5 = subscribeNotifications(user.uid, setNotifications);
    return () => { u1(); u2(); u4(); if (u5) u5(); };
  }, [user]);

  // ── Derived stats ────────────────────────────────────────────
  const pendingUsers  = useMemo(() => users.filter(u => u.status === "pending"), [users]);
  const openIssues    = useMemo(() => issues.filter(i => i.status === "open").length, [issues]);
  const consultants   = useMemo(() => users.filter(u => u.role === "consultant" && u.status === "approved").length, [users]);
  const supervisors   = useMemo(() => users.filter(u => u.role === "supervisor" && u.status === "approved").length, [users]);
  const deactivated   = useMemo(() => users.filter(u => u.status === "deactivated").length, [users]);

  // Project audit rows
  const projectRows = useMemo(() =>
    projects.slice(0, 6).map(p => {
      const s = projectStatus(p);
      const days = p.endDate ? differenceInDays(new Date(), parseISO(p.endDate)) : null;
      return { ...p, _status: s, _daysOverdue: days };
    }), [projects]);

  // Recent notifications (last 5)
  const recentNotifs = useMemo(() => notifications.slice(0, 5), [notifications]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleApprove = async (u) => {
    try {
      await approveUser(u.id);
      toast.success(`${u.name} approved`);
    } catch { toast.error("Failed to approve"); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return toast.error("Provide a reason");
    setSaving(true);
    try {
      await rejectUser(rejectModal.user.id, rejectReason);
      toast.success("User rejected and notified");
      setRejectModal({ open: false, user: null });
      setRejectReason("");
    } catch { toast.error("Failed to reject"); }
    finally { setSaving(false); }
  };

  const STATS = [
    {
      label: "Total Users", value: users.length,
      icon: Users, color: "#58a6ff", bg: "rgba(88,166,255,0.12)",
    },
    {
      label: "Pending Approvals", value: pendingUsers.length,
      icon: Clock, color: "#f59e0b", bg: "rgba(245,158,11,0.12)",
      urgent: pendingUsers.length > 0,
    },
    {
      label: "Total Projects", value: projects.length,
      icon: FolderOpen, color: "#3fb950", bg: "rgba(63,185,80,0.12)",
    },
    {
      label: "Open Issues", value: openIssues,
      icon: AlertTriangle, color: "#f85149", bg: "rgba(248,81,73,0.12)",
    },
  ];

  return (
    <div>
      <Topbar title="Dashboard" />
      <div className="page-body">

        {/* ── Welcome ──────────────────────────────────────── */}
        <div className="adb-welcome">
          <div>
            <h2 className="adb-welcome-title">
              Welcome back, {profile?.name || "Admin"} 👋
            </h2>
            <p className="adb-welcome-sub">
              Administrator — here's your system overview.
            </p>
          </div>
          {pendingUsers.length > 0 && (
            <div className="adb-urgent-badge">
              <Clock size={14} />
              {pendingUsers.length} pending approval{pendingUsers.length > 1 ? "s" : ""} — action required
            </div>
          )}
        </div>

        {/* ── Top Stat Cards ───────────────────────────────── */}
        <div className="adb-stat-grid">
          {STATS.map(({ label, value, icon: Icon, color, bg, urgent }) => (
            <div
              key={label}
              className={`adb-stat-card ${urgent ? "adb-stat-urgent" : ""}`}
              style={{ borderColor: urgent ? color + "55" : undefined }}
            >
              <div className="adb-stat-icon" style={{ background: bg, color }}>
                <Icon size={22} />
              </div>
              <div>
                <div className="adb-stat-value" style={{ color: urgent ? color : undefined }}>
                  {value}
                </div>
                <div className="adb-stat-label">{label}</div>
              </div>
              {urgent && <div className="adb-stat-pulse" style={{ background: color }} />}
            </div>
          ))}
        </div>

        {/* ── Main Grid ────────────────────────────────────── */}
        <div className="adb-main-grid">

          {/* LEFT COLUMN */}
          <div className="adb-left">

            {/* Section 1 — Pending Registrations */}
            <div className="adb-card">
              <div className="adb-card-header">
                <div className="adb-card-title">
                  <Clock size={17} color="#f59e0b" />
                  Pending Registration Requests
                  {pendingUsers.length > 0 && (
                    <span className="adb-badge-warn">{pendingUsers.length}</span>
                  )}
                </div>
                <button className="adb-link-btn" onClick={() => navigate("/users")}>
                  View All <ArrowRight size={14} />
                </button>
              </div>

              {pendingUsers.length === 0 ? (
                <div className="adb-empty">
                  <CheckCircle size={20} color="var(--success)" />
                  No pending registrations — all caught up!
                </div>
              ) : (
                <div className="adb-pending-list">
                  {pendingUsers.slice(0, 5).map(u => (
                    <div key={u.id} className="adb-pending-row">
                      <div className="adb-pending-avatar">
                        {u.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="adb-pending-info">
                        <div className="adb-pending-name">{u.name}</div>
                        <div className="adb-pending-meta">
                          <span className={`adb-role-tag adb-role-${u.role}`}>{u.role}</span>
                          <span className="adb-time">{timeAgo(u.createdAt)}</span>
                        </div>
                        <div className="adb-pending-email">{u.email}</div>
                      </div>
                      <div className="adb-pending-actions">
                        <button
                          className="adb-btn adb-btn-success"
                          onClick={() => handleApprove(u)}
                        >
                          <UserCheck size={13} /> Approve
                        </button>
                        <button
                          className="adb-btn adb-btn-danger"
                          onClick={() => setRejectModal({ open: true, user: u })}
                        >
                          <UserX size={13} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2 — Project Progress Audit */}
            <div className="adb-card">
              <div className="adb-card-header">
                <div className="adb-card-title">
                  <TrendingDown size={17} color="var(--danger)" />
                  Project Progress Audit
                </div>
                <button className="adb-link-btn" onClick={() => navigate("/audit")}>
                  Full Audit <ArrowRight size={14} />
                </button>
              </div>

              {projectRows.length === 0 ? (
                <div className="adb-empty">No projects yet</div>
              ) : (
                <div className="adb-table-wrap">
                  <table className="adb-table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Expected End</th>
                        <th>Days Delayed</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectRows.map(p => (
                        <tr key={p.id}>
                          <td><strong>{p.name}</strong></td>
                          <td style={{ color: "var(--text-secondary)", fontSize: "0.83rem" }}>
                            {p.endDate || "—"}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {p._daysOverdue !== null && p._daysOverdue > 0
                              ? <span style={{ color: "var(--danger)" }}>{p._daysOverdue}d</span>
                              : <span style={{ color: "var(--success)" }}>—</span>}
                          </td>
                          <td>
                            <span className={`adb-status-badge adb-status-${p._status}`}>
                              {p._status === "delayed"   ? "🔴" :
                               p._status === "at-risk"   ? "🟡" :
                               p._status === "on-track"  ? "🟢" :
                               p._status === "completed" ? "✅" : "🔵"}{" "}
                              {statusLabel(p._status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section 3 — Recent Notifications */}
            <div className="adb-card">
              <div className="adb-card-header">
                <div className="adb-card-title">
                  <Bell size={17} color="var(--accent)" />
                  Recent Notifications
                </div>
                <button className="adb-link-btn" onClick={() => navigate("/notifications")}>
                  View All <ArrowRight size={14} />
                </button>
              </div>

              {recentNotifs.length === 0 ? (
                <div className="adb-empty">
                  <Bell size={20} color="var(--text-muted)" /> No notifications yet
                </div>
              ) : (
                <div className="adb-notif-list">
                  {recentNotifs.map(n => (
                    <div
                      key={n.id}
                      className={`adb-notif-row ${!n.read ? "unread" : ""}`}
                      onClick={() => !n.read && markNotificationRead(n.id)}
                    >
                      <div className="adb-notif-dot" style={{
                        background: n.type === "success" ? "var(--success)"
                          : n.type === "error" ? "var(--danger)"
                          : n.type === "warning" ? "var(--warning)"
                          : "var(--accent)"
                      }} />
                      <div className="adb-notif-body">
                        <p className="adb-notif-msg">{n.message}</p>
                        <span className="adb-time">{timeAgo(n.createdAt)}</span>
                      </div>
                      {!n.read && <div className="adb-unread-dot" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN — Side Panel */}
          <div className="adb-right">

            {/* User Overview */}
            <div className="adb-card">
              <div className="adb-card-header">
                <div className="adb-card-title">
                  <Users size={17} color="var(--info)" />
                  User Overview
                </div>
              </div>
              <div className="adb-user-overview">
                <div className="adb-overview-row">
                  <div className="adb-overview-icon" style={{ background: "rgba(245,158,11,0.12)", color: "var(--warning)" }}>
                    <UserCheck size={16} />
                  </div>
                  <span className="adb-overview-label">Consultants</span>
                  <span className="adb-overview-value">{consultants}</span>
                </div>
                <div className="adb-overview-row">
                  <div className="adb-overview-icon" style={{ background: "rgba(88,166,255,0.12)", color: "var(--info)" }}>
                    <Users size={16} />
                  </div>
                  <span className="adb-overview-label">Supervisors</span>
                  <span className="adb-overview-value">{supervisors}</span>
                </div>
                <div className="adb-overview-row">
                  <div className="adb-overview-icon" style={{ background: "rgba(107,114,128,0.12)", color: "var(--text-muted)" }}>
                    <UserMinus size={16} />
                  </div>
                  <span className="adb-overview-label">Deactivated</span>
                  <span className="adb-overview-value">{deactivated}</span>
                </div>
                <div className="adb-overview-row">
                  <div className="adb-overview-icon" style={{ background: "rgba(245,158,11,0.12)", color: "var(--warning)" }}>
                    <Clock size={16} />
                  </div>
                  <span className="adb-overview-label">Pending</span>
                  <span className="adb-overview-value" style={{ color: pendingUsers.length > 0 ? "var(--warning)" : undefined }}>
                    {pendingUsers.length}
                  </span>
                </div>
              </div>
              <button className="adb-full-btn" onClick={() => navigate("/users")}>
                <Users size={14} /> Manage Users
              </button>
            </div>

            {/* Quick Links */}
            <div className="adb-card">
              <div className="adb-card-header">
                <div className="adb-card-title">
                  <ArrowRight size={17} color="var(--accent)" />
                  Quick Actions
                </div>
              </div>
              <div className="adb-quick-links">
                <button className="adb-quick-link" onClick={() => navigate("/users")}>
                  <div className="adb-ql-icon" style={{ background: "rgba(88,166,255,0.12)", color: "var(--info)" }}>
                    <Users size={16} />
                  </div>
                  <div>
                    <div className="adb-ql-label">User Management</div>
                    <div className="adb-ql-sub">Approve, edit, manage accounts</div>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--text-muted)", marginLeft: "auto" }} />
                </button>
                <button className="adb-quick-link" onClick={() => navigate("/audit")}>
                  <div className="adb-ql-icon" style={{ background: "rgba(239,68,68,0.12)", color: "var(--danger)" }}>
                    <TrendingDown size={16} />
                  </div>
                  <div>
                    <div className="adb-ql-label">Progress Audit</div>
                    <div className="adb-ql-sub">Check delays, reports & issues</div>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--text-muted)", marginLeft: "auto" }} />
                </button>
                <button className="adb-quick-link" onClick={() => navigate("/admin-notify")}>
                  <div className="adb-ql-icon" style={{ background: "rgba(63,185,80,0.12)", color: "var(--success)" }}>
                    <Megaphone size={16} />
                  </div>
                  <div>
                    <div className="adb-ql-label">Send Notification</div>
                    <div className="adb-ql-sub">Broadcast to users or roles</div>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--text-muted)", marginLeft: "auto" }} />
                </button>
                <button className="adb-quick-link" onClick={() => navigate("/notifications")}>
                  <div className="adb-ql-icon" style={{ background: "rgba(88,166,255,0.12)", color: "var(--accent)" }}>
                    <Bell size={16} />
                  </div>
                  <div>
                    <div className="adb-ql-label">Notifications</div>
                    <div className="adb-ql-sub">View all system alerts</div>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--text-muted)", marginLeft: "auto" }} />
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── REJECT MODAL ───────────────────────────────────── */}
      {rejectModal.open && (
        <div className="adb-overlay">
          <div className="adb-modal">
            <div className="adb-modal-header">
              <h4><XCircle size={18} color="var(--danger)" /> Reject Registration</h4>
              <button className="adb-close" onClick={() => { setRejectModal({ open: false, user: null }); setRejectReason(""); }}>✕</button>
            </div>
            <div className="adb-modal-body">
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 12 }}>
                Rejecting <strong style={{ color: "var(--text-primary)" }}>{rejectModal.user?.name}</strong>.
                They will be notified with your reason.
              </p>
              <label className="adb-label">Reason <span style={{ color: "var(--danger)" }}>*</span></label>
              <textarea
                className="adb-textarea"
                rows={3}
                placeholder="e.g. Not a registered MEC'S employee."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />
            </div>
            <div className="adb-modal-footer">
              <button className="adb-btn adb-btn-ghost" onClick={() => { setRejectModal({ open: false, user: null }); setRejectReason(""); }}>Cancel</button>
              <button className="adb-btn adb-btn-danger" onClick={handleReject} disabled={saving}>
                {saving ? "Rejecting…" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
