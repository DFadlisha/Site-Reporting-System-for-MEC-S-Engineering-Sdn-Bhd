// src/components/admin/AdminNotifyPage.js
import React, { useState, useEffect } from "react";
import {
  Bell, Send, Users, UserCheck, Briefcase, Clock, CheckCircle,
  Megaphone, History, Loader2, Info,
} from "lucide-react";
import Topbar from "../shared/Topbar";
import { broadcastNotification, subscribeAuditLogs } from "../../firebase/services";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";
import { format } from "date-fns";
import "./AdminNotifyPage.css";

const TARGET_OPTIONS = [
  { value: "",            label: "All Users",        Icon: Users,     color: "var(--info)" },
  { value: "supervisor",  label: "Supervisors Only",  Icon: UserCheck, color: "var(--success)" },
  { value: "consultant",  label: "Consultants Only",  Icon: Briefcase, color: "var(--warning)" },
];

const TEMPLATES = [
  "🔔 Reminder: Please submit your daily site report by end of day.",
  "⚠️ System maintenance scheduled tonight from 11 PM – 1 AM. Please save your work.",
  "📋 All pending reports must be reviewed by the consultant before Friday EOD.",
  "🎉 Thank you for your continued effort on-site. Keep up the great work!",
  "🚧 Important: New safety guidelines have been updated. Please review in the portal.",
];

export default function AdminNotifyPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [message,    setMessage]    = useState("");
  const [target,     setTarget]     = useState("");
  const [sending,    setSending]    = useState(false);
  const [history,    setHistory]    = useState([]);
  const [loadHist,   setLoadHist]   = useState(true);
  const [activeTab,  setActiveTab]  = useState("compose"); // compose | history

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeAuditLogs((logs) => {
      setHistory(logs.filter(l => l.action === "ANNOUNCEMENT_SENT"));
      setLoadHist(false);
    });
    return unsub;
  }, [isAdmin]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return toast.error("Message cannot be empty");
    setSending(true);
    try {
      const count = await broadcastNotification(message.trim(), target || null);
      toast.success(`Notification sent to ${count} user${count !== 1 ? "s" : ""}!`);
      setMessage("");
    } catch (err) {
      toast.error("Failed to send notification");
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  if (!isAdmin) {
    return (
      <div>
        <Topbar title="Notification Management" />
        <div className="page-body">
          <div className="alert alert-danger">Access Denied: Admin Only.</div>
        </div>
      </div>
    );
  }

  const selectedTarget = TARGET_OPTIONS.find(t => t.value === target) || TARGET_OPTIONS[0];

  return (
    <div>
      <Topbar title="Notification Management" />
      <div className="page-body">
        <div className="an-container">

          {/* ── Tabs ─────────────────────────────────── */}
          <div className="an-tabs">
            <button
              className={`an-tab ${activeTab === "compose" ? "active" : ""}`}
              onClick={() => setActiveTab("compose")}
            >
              <Megaphone size={15} /> Compose
            </button>
            <button
              className={`an-tab ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              <History size={15} /> History
              {history.length > 0 && <span className="an-tab-count">{history.length}</span>}
            </button>
          </div>

          {/* ── Compose Tab ──────────────────────────── */}
          {activeTab === "compose" && (
            <div className="an-compose-layout">
              {/* Left: Form */}
              <div className="an-card">
                <div className="an-card-header">
                  <Bell size={18} color="var(--accent)" />
                  <span>Send Notification</span>
                </div>
                <form onSubmit={handleSend} className="an-form">
                  {/* Target Audience */}
                  <div className="an-field">
                    <label className="an-label">Target Audience</label>
                    <div className="an-target-grid">
                      {TARGET_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`an-target-btn ${target === opt.value ? "active" : ""}`}
                          style={target === opt.value ? { borderColor: opt.color, background: opt.color + "18" } : {}}
                          onClick={() => setTarget(opt.value)}
                        >
                          <opt.Icon size={16} style={{ color: target === opt.value ? opt.color : "var(--text-muted)" }} />
                          <span style={{ color: target === opt.value ? opt.color : "var(--text-secondary)" }}>
                            {opt.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message */}
                  <div className="an-field">
                    <label className="an-label">Message</label>
                    <textarea
                      className="an-textarea"
                      rows={5}
                      placeholder="Type your notification message here…"
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      required
                    />
                    <div className="an-char-count">{message.length} characters</div>
                  </div>

                  {/* Preview */}
                  {message && (
                    <div className="an-preview">
                      <div className="an-preview-label">
                        <Info size={13} /> Preview
                      </div>
                      <div className="an-preview-bubble">
                        <div className="an-preview-icon"><Bell size={14} color="var(--accent)" /></div>
                        <p>{message}</p>
                      </div>
                      <div className="an-preview-meta">
                        Will be sent to: <strong>{selectedTarget.label}</strong>
                      </div>
                    </div>
                  )}

                  <button type="submit" className="an-send-btn" disabled={sending || !message.trim()}>
                    {sending
                      ? <><Loader2 size={16} className="spin" /> Sending…</>
                      : <><Send size={16} /> Send Notification</>}
                  </button>
                </form>
              </div>

              {/* Right: Templates */}
              <div className="an-sidebar">
                <div className="an-card">
                  <div className="an-card-header">
                    <Clock size={16} color="var(--text-muted)" />
                    <span>Message Templates</span>
                  </div>
                  <div className="an-templates">
                    {TEMPLATES.map((t, i) => (
                      <button
                        key={i}
                        type="button"
                        className="an-template-btn"
                        onClick={() => setMessage(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── History Tab ───────────────────────────── */}
          {activeTab === "history" && (
            <div className="an-card">
              <div className="an-card-header">
                <History size={18} color="var(--accent)" />
                <span>Sent Notifications History</span>
              </div>
              {loadHist ? (
                <div className="an-loading"><Loader2 size={22} className="spin" /></div>
              ) : history.length === 0 ? (
                <div className="an-empty">
                  <Bell size={32} color="var(--text-muted)" />
                  <p>No announcements sent yet</p>
                </div>
              ) : (
                <div className="an-history-list">
                  {history.map(log => (
                    <div key={log.id} className="an-history-item">
                      <div className="an-history-icon">
                        <Megaphone size={15} color="var(--accent)" />
                      </div>
                      <div className="an-history-body">
                        <p className="an-history-msg">{log.changes?.message || "—"}</p>
                        <div className="an-history-meta">
                          <span className="an-history-target">
                            <Users size={12} />
                            {log.changes?.targetRole === "all"
                              ? "All Users"
                              : log.changes?.targetRole === "supervisor"
                              ? "Supervisors"
                              : "Consultants"}
                          </span>
                          {log.changes?.recipientCount !== undefined && (
                            <span className="an-history-count">
                              <CheckCircle size={12} />
                              {log.changes.recipientCount} recipient{log.changes.recipientCount !== 1 ? "s" : ""}
                            </span>
                          )}
                          <span className="an-history-time">
                            <Clock size={12} />
                            {log.timestamp ? format(log.timestamp.toDate(), "d MMM yyyy, h:mm a") : "Just now"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
