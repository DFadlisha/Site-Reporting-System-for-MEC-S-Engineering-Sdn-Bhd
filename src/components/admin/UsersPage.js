// src/components/admin/UsersPage.js
import React, { useState, useEffect, useMemo } from "react";
import {
  Users, Shield, Calendar, Edit2, ShieldAlert, Trash2, UserX,
  UserCheck, Search, CheckCircle, XCircle, Clock, UserMinus,
  AlertCircle, X, Mail, KeyRound,
} from "lucide-react";
import Topbar from "../shared/Topbar";
import {
  subscribeSystemUsers, updateUserStatus, approveUser,
  rejectUser, deactivateUser, deleteUserDoc, updateUserDetails, resetUserPassword,
} from "../../firebase/services";
import toast from "react-hot-toast";
import { format } from "date-fns";
import "./UsersPage.css";

export default function UsersPage() {
  const [usersList, setUsersList]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab]   = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  // Modals
  const [rejectModal, setRejectModal] = useState({ open: false, user: null });
  const [editModal, setEditModal]     = useState({ open: false, user: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, user: null });
  const [rejectReason, setRejectReason] = useState("");
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "supervisor" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeSystemUsers((data) => {
      setUsersList(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const stats = useMemo(() => ({
    total:       usersList.length,
    pending:     usersList.filter(u => u.status === "pending").length,
    approved:    usersList.filter(u => u.status === "approved").length,
    rejected:    usersList.filter(u => u.status === "rejected").length,
    deactivated: usersList.filter(u => u.status === "deactivated").length,
    consultants: usersList.filter(u => u.role === "consultant").length,
  }), [usersList]);

  const filtered = useMemo(() => {
    return usersList.filter(u => {
      const matchTab =
        activeTab === "all"         ? true :
        activeTab === "pending"     ? u.status === "pending" :
        activeTab === "approved"    ? u.status === "approved" :
        activeTab === "rejected"    ? u.status === "rejected" :
        activeTab === "deactivated" ? u.status === "deactivated" : true;
      const matchRole   = roleFilter === "all" ? true : u.role === roleFilter;
      const matchSearch = !searchTerm ||
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchTab && matchRole && matchSearch;
    });
  }, [usersList, activeTab, roleFilter, searchTerm]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleApprove = async (user) => {
    try {
      await approveUser(user.id);
      toast.success(`${user.name} approved`);
    } catch { toast.error("Failed to approve user"); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return toast.error("Provide a rejection reason");
    setSaving(true);
    try {
      await rejectUser(rejectModal.user.id, rejectReason);
      toast.success("User rejected and notified");
      setRejectModal({ open: false, user: null });
      setRejectReason("");
    } catch { toast.error("Failed to reject user"); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async (user) => {
    const reactivate = user.status === "deactivated";
    try {
      await deactivateUser(user.id, reactivate);
      toast.success(reactivate ? "User reactivated" : "User deactivated");
    } catch { toast.error("Failed to update status"); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteUserDoc(deleteModal.user.id);
      toast.success("User deleted");
      setDeleteModal({ open: false, user: null });
    } catch { toast.error("Failed to delete user"); }
    finally { setSaving(false); }
  };

  const handleResetPassword = async (user) => {
    if (!user.email) return toast.error("No email address found for this user");
    try {
      await resetUserPassword(user.email);
      toast.success(`Password reset email sent to ${user.email}`);
    } catch { toast.error("Failed to send reset email"); }
  };

  const openEdit = (user) => {
    setEditForm({ name: user.name || "", email: user.email || "", role: user.role || "supervisor" });
    setEditModal({ open: true, user });
  };

  const handleEdit = async () => {
    setSaving(true);
    try {
      await updateUserDetails(editModal.user.id, editForm);
      toast.success("User updated");
      setEditModal({ open: false, user: null });
    } catch { toast.error("Failed to update user"); }
    finally { setSaving(false); }
  };

  // ── Helpers ───────────────────────────────────────────────────
  const getRoleCls = (role) => {
    switch (role?.toLowerCase()) {
      case "admin":      return "role-admin";
      case "consultant": return "role-consultant";
      default:           return "role-supervisor";
    }
  };

  const getStatusCfg = (status) => {
    switch (status?.toLowerCase()) {
      case "approved":    return { cls: "badge-success",   Icon: CheckCircle, label: "Approved" };
      case "pending":     return { cls: "badge-warning",   Icon: Clock,       label: "Pending" };
      case "rejected":    return { cls: "badge-danger",    Icon: XCircle,     label: "Rejected" };
      case "deactivated": return { cls: "badge-secondary", Icon: UserMinus,   label: "Deactivated" };
      default:            return { cls: "badge-secondary", Icon: Clock,       label: status || "Unknown" };
    }
  };

  const TABS = [
    { id: "all",         label: "All Users",   count: stats.total },
    { id: "pending",     label: "Pending",     count: stats.pending },
    { id: "approved",    label: "Approved",    count: stats.approved },
    { id: "rejected",    label: "Rejected",    count: stats.rejected },
    { id: "deactivated", label: "Deactivated", count: stats.deactivated },
  ];

  return (
    <div>
      <Topbar title="User Management" />
      <div className="page-body">
        <div className="users-container">

          {/* ── Stats Cards ─────────────────────────── */}
          <div className="um-stats-grid">
            <div className="um-stat-card">
              <div className="um-stat-icon" style={{ background: "rgba(88,166,255,0.15)", color: "var(--info)" }}>
                <Users size={20} />
              </div>
              <div>
                <div className="um-stat-value">{stats.total}</div>
                <div className="um-stat-label">Total Users</div>
              </div>
            </div>
            <div className="um-stat-card">
              <div className="um-stat-icon" style={{ background: "rgba(245,158,11,0.15)", color: "var(--warning)" }}>
                <Clock size={20} />
              </div>
              <div>
                <div className="um-stat-value">{stats.pending}</div>
                <div className="um-stat-label">Pending Approval</div>
              </div>
            </div>
            <div className="um-stat-card">
              <div className="um-stat-icon" style={{ background: "rgba(63,185,80,0.15)", color: "var(--success)" }}>
                <UserCheck size={20} />
              </div>
              <div>
                <div className="um-stat-value">{stats.approved}</div>
                <div className="um-stat-label">Active Users</div>
              </div>
            </div>
            <div className="um-stat-card">
              <div className="um-stat-icon" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
                <Shield size={20} />
              </div>
              <div>
                <div className="um-stat-value">{stats.consultants}</div>
                <div className="um-stat-label">Consultants</div>
              </div>
            </div>
          </div>

          {/* ── Pending Banner ───────────────────────── */}
          {stats.pending > 0 && (
            <div className="um-pending-banner">
              <AlertCircle size={16} />
              <span>
                <strong>{stats.pending} user{stats.pending > 1 ? "s" : ""}</strong> awaiting registration approval — review in the <strong>Pending</strong> tab.
              </span>
            </div>
          )}

          {/* ── Toolbar: Tabs + Search ───────────────── */}
          <div className="um-toolbar">
            <div className="um-tabs">
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={`um-tab ${activeTab === t.id ? "active" : ""}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                  {t.count > 0 && (
                    <span className={`um-tab-badge ${t.id === "pending" ? "badge-warn" : ""}`}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="um-filters">
              <div className="um-search-wrap">
                <Search size={14} />
                <input
                  className="um-search"
                  placeholder="Search name or email…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="um-select"
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="consultant">Consultant</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </div>
          </div>

          {/* ── User Cards ───────────────────────────── */}
          {loading ? (
            <div className="um-empty">Loading users…</div>
          ) : filtered.length === 0 ? (
            <div className="um-empty">
              <Users size={36} color="var(--text-muted)" />
              <p>No users found</p>
            </div>
          ) : (
            <div className="row g-4">
              {filtered.map(user => {
                const { cls, Icon: StatusIcon, label: statusLabel } = getStatusCfg(user.status);
                const isDeactivated = user.status === "deactivated";
                return (
                  <div className="col-12 col-md-6 col-lg-4" key={user.id}>
                    <div className={`user-card ${isDeactivated ? "user-card-dim" : ""}`}>
                      {/* Header */}
                      <div className="user-header">
                        <div className={`user-avatar um-avatar-${getRoleCls(user.role)}`}>
                          {user.name ? user.name[0].toUpperCase() : "?"}
                        </div>
                        <div className="user-details">
                          <h3 className="user-name">{user.name || "Unknown User"}</h3>
                          <p className="user-email">
                            <Mail size={11} style={{ marginRight: 4 }} />{user.email}
                          </p>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="d-flex gap-2 flex-wrap">
                        <span className={`user-role-badge ${getRoleCls(user.role)}`}>
                          {user.role || "user"}
                        </span>
                        <span className={`status-badge ${cls} d-flex align-items-center gap-1`}>
                          <StatusIcon size={11} /> {statusLabel}
                        </span>
                      </div>

                      {/* Meta */}
                      <div className="user-stats">
                        <div className="stat-item">
                          <Calendar size={12} />
                          {user.createdAt
                            ? format(user.createdAt.toDate(), "d MMM yyyy")
                            : "N/A"}
                        </div>
                        {user.rejectionReason && (
                          <div className="stat-item um-rejection-note">
                            <XCircle size={12} /> {user.rejectionReason}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="user-actions">
                        {user.status === "pending" && (
                          <>
                            <button className="um-btn um-btn-success" onClick={() => handleApprove(user)}>
                              <CheckCircle size={13} /> Approve
                            </button>
                            <button className="um-btn um-btn-danger" onClick={() => setRejectModal({ open: true, user })}>
                              <XCircle size={13} /> Reject
                            </button>
                          </>
                        )}
                        {user.status === "rejected" && (
                          <button className="um-btn um-btn-success" onClick={() => handleApprove(user)}>
                            <CheckCircle size={13} /> Re-Approve
                          </button>
                        )}
                        <button className="um-btn um-btn-ghost" onClick={() => openEdit(user)}>
                          <Edit2 size={13} /> Edit
                        </button>
                        {(user.status === "approved" || user.status === "deactivated") && (
                          <button
                            className="um-btn um-btn-ghost"
                            title="Send password reset email"
                            onClick={() => handleResetPassword(user)}
                          >
                            <KeyRound size={13} /> Reset Password
                          </button>
                        )}
                        {user.status === "approved" && (
                          <button className="um-btn um-btn-warning" onClick={() => handleDeactivate(user)}>
                            <UserX size={13} /> Deactivate
                          </button>
                        )}
                        {isDeactivated && (
                          <button className="um-btn um-btn-success" onClick={() => handleDeactivate(user)}>
                            <UserCheck size={13} /> Reactivate
                          </button>
                        )}
                        <button
                          className="um-btn um-btn-icon-danger"
                          title="Delete user"
                          onClick={() => setDeleteModal({ open: true, user })}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── REJECT MODAL ──────────────────────────────── */}
      {rejectModal.open && (
        <div className="um-overlay">
          <div className="um-modal">
            <div className="um-modal-header">
              <h4 className="um-modal-title">
                <XCircle size={18} color="var(--danger)" /> Reject Registration
              </h4>
              <button className="um-close-btn" onClick={() => { setRejectModal({ open: false, user: null }); setRejectReason(""); }}>
                <X size={18} />
              </button>
            </div>
            <div className="um-modal-body">
              <p style={{ color: "var(--text-secondary)", marginBottom: 14, fontSize: "0.9rem" }}>
                Rejecting <strong style={{ color: "var(--text-primary)" }}>{rejectModal.user?.name}</strong>.
                They will receive a notification with your reason.
              </p>
              <label className="um-label">Rejection Reason <span style={{ color: "var(--danger)" }}>*</span></label>
              <textarea
                className="um-textarea"
                rows={3}
                placeholder="e.g. Not a registered MEC'S employee. Please contact HR."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
              />
            </div>
            <div className="um-modal-footer">
              <button className="um-btn um-btn-ghost" onClick={() => { setRejectModal({ open: false, user: null }); setRejectReason(""); }}>
                Cancel
              </button>
              <button className="um-btn um-btn-danger" onClick={handleReject} disabled={saving}>
                {saving ? "Rejecting…" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ────────────────────────────────── */}
      {editModal.open && (
        <div className="um-overlay">
          <div className="um-modal">
            <div className="um-modal-header">
              <h4 className="um-modal-title"><Edit2 size={18} /> Edit User</h4>
              <button className="um-close-btn" onClick={() => setEditModal({ open: false, user: null })}>
                <X size={18} />
              </button>
            </div>
            <div className="um-modal-body">
              <label className="um-label">Full Name</label>
              <input
                className="um-input"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              />
              <label className="um-label">Email</label>
              <input
                className="um-input"
                type="email"
                value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
              />
              <label className="um-label">Role</label>
              <select
                className="um-input"
                value={editForm.role}
                onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
              >
                <option value="supervisor">Supervisor</option>
                <option value="consultant">Consultant</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="um-modal-footer">
              <button className="um-btn um-btn-ghost" onClick={() => setEditModal({ open: false, user: null })}>
                Cancel
              </button>
              <button className="um-btn um-btn-primary" onClick={handleEdit} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ──────────────────────── */}
      {deleteModal.open && (
        <div className="um-overlay">
          <div className="um-modal um-modal-sm">
            <div className="um-modal-header">
              <h4 className="um-modal-title">
                <Trash2 size={18} color="var(--danger)" /> Delete User
              </h4>
              <button className="um-close-btn" onClick={() => setDeleteModal({ open: false, user: null })}>
                <X size={18} />
              </button>
            </div>
            <div className="um-modal-body">
              <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                Permanently delete <strong style={{ color: "var(--text-primary)" }}>{deleteModal.user?.name}</strong>?
                This removes their profile from the system. Their Firebase Auth account will remain unless manually deleted.
              </p>
            </div>
            <div className="um-modal-footer">
              <button className="um-btn um-btn-ghost" onClick={() => setDeleteModal({ open: false, user: null })}>
                Cancel
              </button>
              <button className="um-btn um-btn-danger" onClick={handleDelete} disabled={saving}>
                {saving ? "Deleting…" : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
