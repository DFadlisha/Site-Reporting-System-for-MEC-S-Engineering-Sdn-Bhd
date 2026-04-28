// src/components/admin/AuditPage.js
import React, { useEffect, useState, useMemo } from "react";
import {
  BarChart2, AlertOctagon, Clock, FileText, TrendingDown,
  CheckCircle, Loader2, Download, RefreshCw, AlertTriangle, XCircle,
} from "lucide-react";
import Topbar from "../shared/Topbar";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { differenceInDays, format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import "./AuditPage.css";



// ── Helpers ──────────────────────────────────────────────────
function daysBetween(a, b) {
  if (!a || !b) return null;
  return differenceInDays(b, a);
}

function avgDays(arr) {
  const valid = arr.filter(v => v !== null && v >= 0);
  if (!valid.length) return null;
  return (valid.reduce((s, v) => s + v, 0) / valid.length).toFixed(1);
}

// ── Export helpers ───────────────────────────────────────────
function exportCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => `"${r[h] ?? ""}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AuditPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [projects, setProjects] = useState([]);
  const [reports,  setReports]  = useState([]);
  const [issues,   setIssues]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const now = new Date();

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    (async () => {
      const [pSnap, rSnap, iSnap] = await Promise.all([
        getDocs(query(collection(db, "projects"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "reports"),  orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "issues"),   orderBy("createdAt", "desc"))),
      ]);
      setProjects(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setReports (rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIssues  (iSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, [isAdmin]);

  // 1. Delayed Projects ─────────────────────────────────────────
  const delayedProjects = useMemo(() =>
    projects
      .filter(p => p.status !== "completed" && p.endDate)
      .map(p => {
        const end = parseISO(p.endDate);
        const daysOverdue = differenceInDays(now, end);
        return { ...p, end, daysOverdue };
      })
      .filter(p => p.daysOverdue > 0)
      .sort((a, b) => b.daysOverdue - a.daysOverdue),
  [projects, now]);

  // 2. Report Submission by Supervisor ─────────────────────────
  const submissionStats = useMemo(() => {
    const map = {};
    const monthStart = startOfMonth(now);
    const monthEnd   = endOfMonth(now);
    reports.forEach(r => {
      const name = r.submittedBy || "Unknown";
      if (!map[name]) map[name] = { name, total: 0, thisMonth: 0, lastDate: null };
      map[name].total++;
      const ts = r.createdAt?.toDate?.();
      if (ts && isWithinInterval(ts, { start: monthStart, end: monthEnd })) map[name].thisMonth++;
      if (ts && (!map[name].lastDate || ts > map[name].lastDate)) map[name].lastDate = ts;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [reports, now]);

  // 3. Consultant Approval Turnaround ──────────────────────────
  const approvalStats = useMemo(() => {
    const map = {};
    reports.filter(r => r.status === "approved" && r.reviewedBy).forEach(r => {
      const name = r.reviewedBy || "Unknown";
      if (!map[name]) map[name] = { name, count: 0, totalDays: [] };
      map[name].count++;
      const submitted  = r.createdAt?.toDate?.();
      const reviewed   = r.updatedAt?.toDate?.();
      if (submitted && reviewed) map[name].totalDays.push(daysBetween(submitted, reviewed));
    });
    return Object.values(map).map(c => ({
      ...c, avgDays: avgDays(c.totalDays),
    })).sort((a, b) => a.avgDays - b.avgDays);
  }, [reports]);

  // 4. Issues by Project ────────────────────────────────────────
  const issuesByProject = useMemo(() => {
    const map = {};
    issues.forEach(i => {
      const proj = projects.find(p => p.id === i.projectId);
      const name = proj?.name || i.projectId || "Unknown";
      if (!map[name]) map[name] = { name, total: 0, open: 0, resolved: 0 };
      map[name].total++;
      if (i.status === "open") map[name].open++;
      else map[name].resolved++;
    });
    return Object.values(map).sort((a, b) => b.open - a.open);
  }, [issues, projects]);

  // Summary stats ───────────────────────────────────────────────
  const pendingReports  = reports.filter(r => r.status === "pending").length;
  const openIssues      = issues.filter(i => i.status === "open").length;
  const allAvgApproval  = avgDays(
    reports
      .filter(r => r.status === "approved" && r.createdAt?.toDate && r.updatedAt?.toDate)
      .map(r => daysBetween(r.createdAt.toDate(), r.updatedAt.toDate()))
  );

  if (!isAdmin) {
    return (
      <div>
        <Topbar title="Project Progress Audit" />
        <div className="page-body">
          <div className="alert alert-danger">Access Denied: Admin Only.</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Topbar title="Project Progress Audit" />
      <div className="page-body">
        {loading ? (
          <div className="audit-loading"><Loader2 size={28} className="spin" /> Loading audit data…</div>
        ) : (
          <>
            {/* ── Summary Cards ─────────────────────────────────── */}
            <div className="audit-stat-grid">
              <div className="audit-stat-card audit-stat-red">
                <div className="audit-stat-icon"><TrendingDown size={22} /></div>
                <div>
                  <div className="audit-stat-value">{delayedProjects.length}</div>
                  <div className="audit-stat-label">Delayed Projects</div>
                </div>
              </div>
              <div className="audit-stat-card audit-stat-yellow">
                <div className="audit-stat-icon"><FileText size={22} /></div>
                <div>
                  <div className="audit-stat-value">{pendingReports}</div>
                  <div className="audit-stat-label">Pending Reports</div>
                </div>
              </div>
              <div className="audit-stat-card audit-stat-orange">
                <div className="audit-stat-icon"><AlertOctagon size={22} /></div>
                <div>
                  <div className="audit-stat-value">{openIssues}</div>
                  <div className="audit-stat-label">Open Issues</div>
                </div>
              </div>
              <div className="audit-stat-card audit-stat-blue">
                <div className="audit-stat-icon"><Clock size={22} /></div>
                <div>
                  <div className="audit-stat-value">{allAvgApproval ?? "—"}{allAvgApproval ? " d" : ""}</div>
                  <div className="audit-stat-label">Avg Approval Time</div>
                </div>
              </div>
            </div>

            {/* ── 1. Delayed Projects ──────────────────────────── */}
            <div className="audit-section">
              <div className="audit-section-header">
                <div className="audit-section-title">
                  <TrendingDown size={18} color="var(--danger)" />
                  Delayed Projects
                  {delayedProjects.length > 0 && <span className="audit-badge-red">{delayedProjects.length}</span>}
                </div>
                <button
                  className="audit-export-btn"
                  onClick={() => exportCSV(
                    delayedProjects.map(p => ({
                      Project: p.name, Location: p.location,
                      "Expected End": p.endDate, Progress: `${p.progress}%`,
                      "Days Overdue": p.daysOverdue,
                    })),
                    "delayed_projects.csv"
                  )}
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>
              {delayedProjects.length === 0 ? (
                <div className="audit-empty"><CheckCircle size={18} color="var(--success)" /> No delayed projects</div>
              ) : (
                <div className="audit-table-wrap">
                  <table className="audit-table">
                    <thead>
                      <tr>
                        <th>Project</th><th>Location</th><th>Expected End</th>
                        <th>Progress</th><th>Days Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {delayedProjects.map(p => (
                        <tr key={p.id}>
                          <td><strong>{p.name}</strong></td>
                          <td>{p.location}</td>
                          <td>{format(p.end, "d MMM yyyy")}</td>
                          <td>
                            <div className="audit-progress-wrap">
                              <div className="audit-progress-bar" style={{ width: `${p.progress}%` }} />
                            </div>
                            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{p.progress}%</span>
                          </td>
                          <td>
                            <span className={`audit-delay-badge ${p.daysOverdue > 30 ? "high" : p.daysOverdue > 7 ? "medium" : "low"}`}>
                              {p.daysOverdue} day{p.daysOverdue !== 1 ? "s" : ""}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── 2. Report Submission Consistency ──────────────── */}
            <div className="audit-section">
              <div className="audit-section-header">
                <div className="audit-section-title">
                  <FileText size={18} color="var(--info)" />
                  Report Submission by Supervisor
                </div>
                <button
                  className="audit-export-btn"
                  onClick={() => exportCSV(
                    submissionStats.map(s => ({
                      Supervisor: s.name, "Total Reports": s.total,
                      "This Month": s.thisMonth,
                      "Last Submitted": s.lastDate ? format(s.lastDate, "d MMM yyyy") : "Never",
                    })),
                    "report_submission.csv"
                  )}
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>
              {submissionStats.length === 0 ? (
                <div className="audit-empty">No reports submitted yet</div>
              ) : (
                <div className="audit-table-wrap">
                  <table className="audit-table">
                    <thead>
                      <tr>
                        <th>Supervisor</th><th>Total Reports</th>
                        <th>This Month</th><th>Last Submission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissionStats.map(s => (
                        <tr key={s.name}>
                          <td><strong>{s.name}</strong></td>
                          <td><span className="audit-count">{s.total}</span></td>
                          <td>
                            <span className={`audit-month-badge ${s.thisMonth === 0 ? "zero" : ""}`}>
                              {s.thisMonth}
                            </span>
                          </td>
                          <td style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                            {s.lastDate ? format(s.lastDate, "d MMM yyyy") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── 3. Consultant Approval Turnaround ─────────────── */}
            <div className="audit-section">
              <div className="audit-section-header">
                <div className="audit-section-title">
                  <Clock size={18} color="var(--warning)" />
                  Consultant Approval Turnaround
                </div>
              </div>
              {approvalStats.length === 0 ? (
                <div className="audit-empty">No approved reports yet</div>
              ) : (
                <div className="audit-table-wrap">
                  <table className="audit-table">
                    <thead>
                      <tr>
                        <th>Consultant</th><th>Reports Reviewed</th><th>Avg Days to Approve</th><th>Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvalStats.map(c => {
                        const days = parseFloat(c.avgDays);
                        const rating = days <= 1 ? "Excellent" : days <= 3 ? "Good" : days <= 7 ? "Average" : "Slow";
                        const ratingCls = days <= 1 ? "green" : days <= 3 ? "blue" : days <= 7 ? "yellow" : "red";
                        return (
                          <tr key={c.name}>
                            <td><strong>{c.name}</strong></td>
                            <td><span className="audit-count">{c.count}</span></td>
                            <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                              {c.avgDays ? `${c.avgDays} days` : "—"}
                            </td>
                            <td><span className={`audit-rating audit-rating-${ratingCls}`}>{rating}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── 4. Issues by Project ──────────────────────────── */}
            <div className="audit-section">
              <div className="audit-section-header">
                <div className="audit-section-title">
                  <AlertTriangle size={18} color="var(--warning)" />
                  Issues by Project
                </div>
                <button
                  className="audit-export-btn"
                  onClick={() => exportCSV(
                    issuesByProject.map(p => ({
                      Project: p.name, "Total Issues": p.total,
                      Open: p.open, Resolved: p.resolved,
                    })),
                    "issues_by_project.csv"
                  )}
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>
              {issuesByProject.length === 0 ? (
                <div className="audit-empty"><CheckCircle size={18} color="var(--success)" /> No issues recorded</div>
              ) : (
                <div className="audit-table-wrap">
                  <table className="audit-table">
                    <thead>
                      <tr><th>Project</th><th>Total</th><th>Open</th><th>Resolved</th><th>Open Rate</th></tr>
                    </thead>
                    <tbody>
                      {issuesByProject.map(p => (
                        <tr key={p.name}>
                          <td><strong>{p.name}</strong></td>
                          <td><span className="audit-count">{p.total}</span></td>
                          <td>
                            {p.open > 0
                              ? <span className="audit-badge-orange">{p.open}</span>
                              : <span style={{ color: "var(--text-muted)" }}>0</span>}
                          </td>
                          <td>
                            <span style={{ color: "var(--success)", fontWeight: 600 }}>{p.resolved}</span>
                          </td>
                          <td>
                            <div className="audit-bar-row">
                              <div className="audit-mini-bar">
                                <div
                                  className={`audit-mini-fill ${p.open / p.total > 0.5 ? "fill-red" : "fill-green"}`}
                                  style={{ width: `${Math.round((p.open / p.total) * 100)}%` }}
                                />
                              </div>
                              <span>{Math.round((p.open / p.total) * 100)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
