// src/components/issues/IssuesPage.js
import React, { useEffect, useState } from "react";
import { Plus, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import Topbar from "../shared/Topbar";
import { createIssue, subscribeIssues, updateIssue } from "../../firebase/services";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";

export default function IssuesPage() {
  const { profile } = useAuth();
  const [issues, setIssues] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", location: "" });

  useEffect(() => {
    const unsub = subscribeIssues(setIssues);
    return unsub;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createIssue({ ...form, reportedBy: profile?.name });
      toast.success("Issue reported");
      setShowModal(false);
      setForm({ title: "", description: "", priority: "medium", location: "" });
    } catch (err) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  const handleResolve = async (id) => {
    await updateIssue(id, { status: "resolved", resolvedBy: profile?.name });
    toast.success("Issue marked as resolved");
  };

  const filtered = filter === "all" ? issues : issues.filter((i) => i.status === filter);

  return (
    <div>
      <Topbar title="Issues" />
      <div className="page-body">
        <div className="page-header">
          <div>
            <h2 className="page-title">Issue Tracker</h2>
            <p className="page-subtitle">{filtered.length} issue{filtered.length !== 1 ? "s" : ""}</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className="tk-filter-tabs">
              {["all", "open", "resolved"].map((s) => (
                <button key={s} className={`tk-filter-tab ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
              <Plus size={14} /> Report Issue
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="tk-empty">
            <AlertTriangle size={40} />
            <p>No issues found</p>
          </div>
        ) : (
          <div className="tk-grid">
            {filtered.map((issue) => (
              <div key={issue.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span className={`badge badge-${issue.priority}`}>{issue.priority}</span>
                    <span className={`badge badge-${issue.status}`}>{issue.status}</span>
                  </div>
                  {issue.status === "open" && (
                    <button
                      className="btn btn-sm"
                      style={{ background: "rgba(63,185,80,0.1)", color: "var(--success)", border: "1px solid rgba(63,185,80,0.3)", padding: "4px 10px" }}
                      onClick={() => handleResolve(issue.id)}
                    >
                      <CheckCircle size={12} /> Resolve
                    </button>
                  )}
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.975rem" }}>{issue.title}</div>
                {issue.description && <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{issue.description}</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4 }}>
                  {issue.location && <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>📍 {issue.location}</span>}
                  <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>Reported by {issue.reportedBy}</span>
                  {issue.resolvedBy && <span style={{ fontSize: "0.78rem", color: "var(--success)" }}>✓ Resolved by {issue.resolvedBy}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Report a Site Issue</div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Issue Title</label>
                <input className="form-control" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Foundation crack detected" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-control" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the issue in detail..." />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-control" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    {["low", "medium", "high"].map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Location on Site</label>
                  <input className="form-control" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Level 3, Grid B4" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Report Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
