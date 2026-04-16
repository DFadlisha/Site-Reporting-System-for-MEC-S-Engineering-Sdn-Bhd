// src/components/issues/IssuesPage.js
import React, { useEffect, useState } from "react";
import { Plus, AlertTriangle, CheckCircle, Loader2, MessageSquare } from "lucide-react";
import Topbar from "../shared/Topbar";
import { createIssue, subscribeIssues, updateIssue, subscribeProjects, createNotification } from "../../firebase/services";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";

export default function IssuesPage() {
  const { profile } = useAuth();
  const role = profile?.role?.toLowerCase() || "";
  const isConsultant = role === "consultant";
  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";

  // ── Flowchart role permissions ──────────────────────────────────
  // Consultant: Track issues → Update status, Resolve issues
  // Supervisor: Report new issue → Set priority, Add description
  const canReportIssue = isSupervisor || isAdmin;
  const canResolveIssue = isConsultant || isAdmin;

  const [issues, setIssues] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterSite, setFilterSite] = useState("all");
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", location: "", projectId: "" });

  // Comment modal for resolving with notes
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveComment, setResolveComment] = useState("");
  const [resolveStatus, setResolveStatus] = useState("resolved");

  useEffect(() => {
    const u1 = subscribeIssues(setIssues);
    const u2 = subscribeProjects(setProjects);
    return () => { u1(); u2(); };
  }, []);

  // Supervisor: Report new issue with priority and description
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const project = projects.find(p => p.id === form.projectId);
      await createIssue({
        ...form,
        projectName: project?.name || "",
        reportedBy: profile?.name,
        reportedByRole: profile?.role,
      });
      toast.success("Issue reported successfully");
      setShowModal(false);
      setForm({ title: "", description: "", priority: "medium", location: "", projectId: "" });
    } catch (err) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  // Consultant: Open resolve modal to update status with comment
  const openResolveModal = (issue) => {
    setResolveTarget(issue);
    setResolveComment("");
    setResolveStatus("resolved");
    setShowResolveModal(true);
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    try {
      await updateIssue(resolveTarget.id, {
        status: resolveStatus,
        resolvedBy: profile?.name,
        resolveComment: resolveComment || "",
        resolvedAt: new Date().toISOString(),
      });
      // Notify the supervisor who reported the issue
      if (resolveTarget.reportedBy) {
        await createNotification(
          resolveTarget.reportedByUid || "",
          `Issue "${resolveTarget.title}" has been ${resolveStatus === "resolved" ? "resolved" : "updated to " + resolveStatus}. ${resolveComment ? "Comment: " + resolveComment : ""}`,
          resolveStatus === "resolved" ? "success" : "info"
        ).catch(() => {});
      }
      toast.success(`Issue ${resolveStatus === "resolved" ? "resolved" : "updated"}`);
    } catch (err) {
      toast.error(err.message);
    }
    setShowResolveModal(false);
    setResolveTarget(null);
  };

  const filtered = issues.filter((i) => {
    if (filter !== "all" && i.status !== filter) return false;
    if (filterSite !== "all" && i.projectId !== filterSite) return false;
    return true;
  });

  const handleResetFilters = () => {
    setFilter("all");
    setFilterSite("all");
  };

  const getPriorityColor = (p) => {
    if (p === 'high') return { bg: '#fee2e2', text: '#F56A6A' };
    if (p === 'low') return { bg: '#dcfce7', text: '#15803d' };
    return { bg: '#fef3c7', text: '#b45309' };
  };

  const getStatusColor = (s) => {
    if (s === 'resolved') return { bg: '#22c55e', text: '#fff' };
    if (s === 'in-progress' || s === 'inprogress') return { bg: '#3b82f6', text: '#fff' };
    if (s === 'on-hold' || s === 'on hold') return { bg: '#f97316', text: '#fff' };
    return { bg: '#f87171', text: '#fff' }; // new/open
  };

  return (
    <div>
      <Topbar title="Issues" />
      <div className="page-body">
        
        <div className="d-flex flex-column flex-xl-row gap-4 align-items-start mt-2">
          
          {/* LEFT PANE: Report New Issue Form (Supervisors / Admins) */}
          {canReportIssue && (
            <div className="card p-4" style={{ flex: "0 0 360px", border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.02)', background: 'var(--bg-elevated)' }}>
              <h4 style={{ fontWeight: 700, margin: '0 0 24px 0', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Report New Issue</h4>
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 600 }}>Title</label>
                  <input className="visily-input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Brief summary of the issue" />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 600 }}>Site</label>
                  <select className="visily-input" required value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                    <option value="" disabled>Select site</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 600 }}>Priority</label>
                  <select className="visily-input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 600 }}>Description</label>
                  <textarea className="visily-input" rows="4" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detailed description of the problem, location, and impact" />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6, display: 'block', fontWeight: 600 }}>Upload Photo (Optional)</label>
                  <div className="rp-upload-area" style={{ padding: '30px 20px', border: '2px dashed var(--border)', borderRadius: 8, textAlign: 'center', cursor: 'pointer', background: 'var(--bg-surface)' }}>
                    <div className="text-muted"><AlertTriangle size={24} color="var(--text-muted)"/></div>
                    <div style={{ fontSize: '0.8rem', marginTop: 8, color: 'var(--text-secondary)' }}>Drag & drop a photo here, or click to browse</div>
                  </div>
                </div>
                <button type="submit" className="visily-full-btn mt-2" disabled={saving}>
                  {saving ? <Loader2 size={16} className="spin" /> : "Submit Issue"}
                </button>
              </form>
            </div>
          )}

          {/* RIGHT PANE: Issue History */}
          <div className="flex-grow-1 w-100">
            <h4 style={{ fontWeight: 700, margin: '0 0 20px 0', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Issue History</h4>
            
            <div className="d-flex flex-wrap gap-3 mb-4">
              <select className="visily-input" style={{ width: 180, padding: '8px 12px' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="open">New / Open</option>
                <option value="inprogress">In Progress</option>
                <option value="onhold">On Hold</option>
                <option value="resolved">Resolved</option>
              </select>
              <select className="visily-input" style={{ width: 180, padding: '8px 12px' }} value={filterSite} onChange={(e) => setFilterSite(e.target.value)}>
                <option value="all">All Sites</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn btn-secondary" style={{ fontSize: '0.9rem', fontWeight: 600, padding: '8px 16px', borderRadius: 6 }} onClick={handleResetFilters}>
                Reset Filters
              </button>
            </div>

            <div className="d-flex flex-column gap-3">
              {filtered.length === 0 ? (
                <div className="text-center py-5 text-muted border rounded" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                  <AlertTriangle size={32} style={{ marginBottom: 16, opacity: 0.5, color: 'var(--text-muted)' }} />
                  <p>No issues found matching criteria.</p>
                </div>
              ) : (
                filtered.map((issue) => {
                  const pColor = getPriorityColor(issue.priority);
                  const sColor = getStatusColor(issue.status);
                  // Adjust reported date formatting if needed
                  const dateString = 'Recently';
                  return (
                    <div key={issue.id} className="card p-4" style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-elevated)', boxShadow: 'none' }}>
                      <div className="d-flex flex-wrap justify-content-between align-items-start mb-2 gap-2">
                        <h6 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                          {issue.title} {issue.projectName ? `- ${issue.projectName}` : ''}
                        </h6>
                        <div className="d-flex gap-2 flex-wrap">
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: 12, background: pColor.bg, color: pColor.text, whiteSpace: 'nowrap' }}>
                            {issue.priority ? issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1) : 'Medium'} Priority
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: 12, background: sColor.bg, color: sColor.text, whiteSpace: 'nowrap' }}>
                            {issue.status === 'open' ? 'New' : issue.status === 'inprogress' ? 'In Progress' : issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="d-flex flex-wrap justify-content-between mb-3 text-muted" style={{ fontSize: '0.85rem' }}>
                        <span>{issue.location || 'Site Unknown'}</span>
                        <span>Reported by {issue.reportedBy || 'Unknown'} on {dateString}</span>
                      </div>
                      
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
                        {issue.description}
                      </p>
                      
                      <div className="d-flex flex-column gap-3 mt-auto">
                        {issue.resolveComment && (
                          <div style={{ fontSize: "0.85rem", color: "var(--text-primary)", background: "rgba(21, 128, 61, 0.1)", padding: "10px 14px", borderRadius: 6, borderLeft: "3px solid var(--success)" }}>
                            <strong style={{color: 'var(--success)'}}>Resolution Note:</strong> {issue.resolveComment}
                          </div>
                        )}
                        <div className="d-flex justify-content-between align-items-center">
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => canResolveIssue ? openResolveModal(issue) : null}>
                            View Details & Timeline {canResolveIssue && "(Update Action)"}
                          </span>
                          {canResolveIssue && issue.status !== 'resolved' && (
                             <button className="visily-coral-btn" style={{padding: '6px 16px', fontSize: '0.85rem'}} onClick={() => openResolveModal(issue)}>Resolve</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resolve Issue Modal — Consultant only (per flowchart: "Update status, Resolve issues") */}
      {showResolveModal && resolveTarget && (
        <div className="modal-overlay" onClick={() => setShowResolveModal(false)}>
          <div className="sp-modal" style={{ maxWidth: 460, borderRadius: 8, padding: 32 }} onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-title" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <CheckCircle size={22} color="var(--success)" />
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Resolve Issue</span>
            </div>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 20 }}>
              <strong style={{ color: "var(--text-primary)" }}>Issue:</strong> {resolveTarget.title} <br />
            </p>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Update Status</label>
              <select className="visily-input" value={resolveStatus} onChange={(e) => setResolveStatus(e.target.value)}>
                <option value="resolved">Resolved</option>
                <option value="inprogress">In Progress</option>
                <option value="onhold">On Hold</option>
              </select>
            </div>
            <div className="form-group">
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Resolution Comment</label>
              <textarea
                className="visily-input"
                value={resolveComment}
                onChange={(e) => setResolveComment(e.target.value)}
                placeholder="Describe how the issue was resolved..."
                rows={4}
              />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 24 }}>
              <button className="btn btn-secondary" style={{ fontWeight: 600 }} onClick={() => setShowResolveModal(false)}>Cancel</button>
              <button
                className="visily-coral-btn"
                onClick={handleResolve}
              >
                <CheckCircle size={16} style={{marginRight: 6}} /> Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
