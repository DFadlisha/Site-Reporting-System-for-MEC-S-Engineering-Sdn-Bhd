// src/components/reports/ReportsPage.js
import React, { useEffect, useState, useRef } from "react";
import {
  Plus, X, Loader2, FileText, Camera, CheckCircle,
  XCircle, Clock, MapPin, ChevronDown, ChevronUp, MessageSquare,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import Topbar from "../shared/Topbar";
import {
  createReport, subscribeReports, updateReport,
  subscribeProjects, createNotification, subscribeTasks
} from "../../firebase/services";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";
import SignatureCanvas from 'react-signature-canvas';
import "./ReportsPage.css";

export default function ReportsPage() {
  const { profile, user } = useAuth();
  const role = profile?.role?.toLowerCase() || "";
  const isConsultant = role === "consultant";
  const isAdmin = role === "admin";
  const isSupervisor = role === "supervisor";

  // ── Flowchart role permissions ──────────────────────────────────
  // Consultant: Review daily reports → Approve/reject, Add comments
  // Supervisor: Submit daily log report → Fill form, Upload photos & sign
  const canReview = isConsultant || isAdmin;
  const canSubmit = isSupervisor; // Only supervisor submits reports
  const canExport = isAdmin || isConsultant;

  const [reports, setReports]   = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeReport, setActiveReport] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProject, setFilterProject] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [inlineComment, setInlineComment] = useState("");
  const [tasks, setTasks] = useState([]);
  const [expandedExportProject, setExpandedExportProject] = useState(null);
  const [selectedExportProject, setSelectedExportProject] = useState(null);
  const fileInputRef = useRef(null);
  const [locationFetching, setLocationFetching] = useState(false);
  const [weatherInfo, setWeatherInfo] = useState(null); // { desc, temp, humidity, icon }

  // Comment modal state for approve/reject with comments (per flowchart)
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentAction, setCommentAction] = useState(null); // "approve" or "reject"
  const [commentTarget, setCommentTarget] = useState(null); // the report
  const [commentText, setCommentText] = useState("");

  const [form, setForm] = useState({
    title: "", projectId: "", projectName: "", date: "", weather: "",
    description: "", workforce: "", materials: "", equipment: "",
    gpsLat: "", gpsLng: "", issues: "",
  });
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const sigCanvas = useRef(null);

  useEffect(() => {
    const u1 = subscribeReports(null, setReports);
    const u2 = subscribeProjects(setProjects);
    const u3 = subscribeTasks(null, setTasks);
    return () => { u1(); u2(); u3(); };
  }, []);

  const location = useLocation();
  useEffect(() => {
    if (location.state?.openModal && canSubmit) {
      setShowModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location, canSubmit]);

  const handlePhotos = (e) => {
    const files = Array.from(e.target.files);
    setPhotoFiles((prev) => [...prev, ...files]);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreviews((prev) => [...prev, ev.target.result]);
      reader.readAsDataURL(f);
    });
  };

  const removePhoto = (i) => {
    setPhotoFiles((p) => p.filter((_, idx) => idx !== i));
    setPhotoPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sigCanvas.current.isEmpty()) {
      return toast.error("Please provide your physical signature digitally.");
    }
    
    setLoading(true);
    try {
      // Capture signature via Canvas API as base64 string
      const signatureData = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      const selectedProject = projects.find((p) => p.id === form.projectId);
      await createReport(
        {
          ...form,
          projectName: selectedProject?.name || "",
          submittedBy: profile?.name || user?.email,
          submittedById: user?.uid,
          signature: signatureData // Save signature context
        },
        photoFiles
      );
      toast.success("Daily report submitted!");
      setShowModal(false);
      setForm({ title: "", projectId: "", projectName: "", date: "", weather: "", description: "", workforce: "", materials: "", equipment: "", gpsLat: "", gpsLng: "", issues: "" });
      setPhotoFiles([]);
      setPhotoPreviews([]);
      sigCanvas.current.clear();
    } catch (err) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  // ── Inline review submit for split pane ──
  const handleSubmitReviewInline = async (report, action) => {
    try {
      const dbAction = action === "approve" ? "approved" : "rejected";
      await updateReport(report.id, {
        status: dbAction,
        reviewedBy: profile?.name,
        reviewedAt: new Date().toISOString(),
        reviewComment: inlineComment || "",
        ...(action === "reject" && { rejectedReason: inlineComment || "" })
      });
      if (report.submittedById) {
        await createNotification(
          report.submittedById, 
          `Your report "${report.title}" was ${dbAction}.${inlineComment ? ` Comment: ${inlineComment}` : ""}`, 
          action === "approve" ? "success" : "error"
        );
      }
      toast.success(`Report ${dbAction}`);
      setActiveReport(null);
      setInlineComment("");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const filtered = reports.filter(r => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterProject && r.projectId !== filterProject) return false;
    if (filterSearch && !r.title?.toLowerCase().includes(filterSearch.toLowerCase()) && !r.projectName?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  const totalReports = reports.length;
  const pendingReports = reports.filter(r => r.status === "pending").length;
  const approvedReports = reports.filter(r => r.status === "approved").length;
  const rejectedReports = reports.filter(r => r.status === "rejected").length;

  const handleExportCSV = () => {
    let csv = "Title,Project,Date,Submitted By,Status,Weather,Workforce,Issues\n";
    filtered.forEach(r => {
      csv += `"${r.title}","${r.projectName || ""}","${r.date}","${r.submittedBy}","${r.status}","${r.weather || ""}","${r.workforce || ""}","${r.issues || ""}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reports_export.csv";
    a.click();
  };

  return (
    <div>
      <Topbar title="Daily Reports" />
      <div className="page-body">

        {/* Header and Grid Layout */}
        <div className="d-flex flex-column flex-xl-row gap-4 align-items-start mb-4">
           {/* Left Pane */}
           <div className="flex-grow-1 w-100">
              <div className="d-flex justify-content-end align-items-center mb-3">
                 <div className="d-flex gap-2">
                    {/* Provide Submit Report if Supervisor */}
                    {canSubmit && (
                      <button className="visily-coral-btn" onClick={() => setShowModal(true)}>
                        <Plus size={16} style={{marginRight: 6}}/> Submit Report
                      </button>
                    )}
                    {/* Extra actions */}
                    {canExport && (
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowExportModal(true)}>
                        Export Project Master
                      </button>
                    )}
                 </div>
              </div>

              {/* Stats Cards */}
              <div className="row g-3 mb-4">
                 <div className="col-6 col-md-3">
                    <div className="card p-3 h-100" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                       <div className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Reports</div>
                       <div className="d-flex justify-content-between align-items-end mt-2">
                          <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>{totalReports}</h3>
                          <div style={{ background: 'var(--bg-surface)', padding: 8, borderRadius: '50%' }}><FileText size={16} color="var(--text-secondary)"/></div>
                       </div>
                    </div>
                 </div>
                 <div className="col-6 col-md-3">
                    <div className="card p-3 h-100" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                       <div className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Pending</div>
                       <div className="d-flex justify-content-between align-items-end mt-2">
                          <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>{pendingReports}</h3>
                          <div style={{ background: 'rgba(194, 65, 12, 0.15)', padding: 8, borderRadius: '50%' }}><Clock size={16} color="var(--warning)"/></div>
                       </div>
                    </div>
                 </div>
                 <div className="col-6 col-md-3">
                    <div className="card p-3 h-100" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                       <div className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Approved</div>
                       <div className="d-flex justify-content-between align-items-end mt-2">
                          <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>{approvedReports}</h3>
                          <div style={{ background: 'rgba(21, 128, 61, 0.15)', padding: 8, borderRadius: '50%' }}><CheckCircle size={16} color="var(--success)"/></div>
                       </div>
                    </div>
                 </div>
                 <div className="col-6 col-md-3">
                    <div className="card p-3 h-100" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
                       <div className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Rejected</div>
                       <div className="d-flex justify-content-between align-items-end mt-2">
                          <h3 style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>{rejectedReports}</h3>
                          <div style={{ background: 'rgba(185, 28, 28, 0.15)', padding: 8, borderRadius: '50%' }}><XCircle size={16} color="var(--danger)"/></div>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Filtering block */}
              <div className="rp-filter-bar mb-4" style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center',
                gap: '12px', padding: '12px 16px',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 8
              }}>
                {/* Status pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
                  {["all", "pending", "approved", "rejected"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      style={{
                        padding: '5px 14px',
                        borderRadius: 20,
                        border: 'none',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        background: filterStatus === s ? '#F56A6A' : 'var(--bg-surface)',
                        color: filterStatus === s ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Divider */}
                <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />

                {/* Project select */}
                <select
                  className="visily-input"
                  style={{ flex: '1 1 160px', maxWidth: 220, padding: '7px 12px', fontSize: '0.83rem' }}
                  value={filterProject}
                  onChange={e => setFilterProject(e.target.value)}
                >
                  <option value="">All Projects</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                {/* Search input */}
                <input
                  className="visily-input"
                  style={{ flex: '1 1 180px', maxWidth: 260, padding: '7px 12px', fontSize: '0.83rem' }}
                  placeholder="Search site name or date..."
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                />
              </div>

              {/* Reports Table */}
              <div className="card p-0 overflow-hidden" style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-elevated)' }}>
                 <div className="table-responsive">
                    <table className="rp-table">
                       <thead>
                          <tr>
                             <th>Date</th>
                             <th>Project</th>
                             <th>Submitted By</th>
                             <th>Status</th>
                             <th style={{ textAlign: 'center' }}>Action</th>
                          </tr>
                       </thead>
                       <tbody>
                          {filtered.length === 0 ? (
                             <tr><td colSpan="5" style={{ textAlign:'center', padding:'32px', color:'var(--text-secondary)' }}>No reports found matching criteria.</td></tr>
                          ) : (
                             filtered.map(r => (
                                <tr key={r.id} onClick={() => setActiveReport(r)} className={activeReport?.id === r.id ? 'rp-row-active' : ''}>
                                   <td className="td-muted">{r.date || "—"}</td>
                                   <td className="td-muted">{r.projectName || r.title || "—"}</td>
                                   <td >{r.submittedBy || "—"}</td>
                                   <td>
                                      <span style={{ 
                                         fontWeight: 700, 
                                         color: r.status === 'approved' ? 'var(--success)' : r.status === 'rejected' ? 'var(--danger)' : 'var(--warning)' 
                                      }}>
                                         {r.status === 'approved' ? 'Approved' : r.status === 'rejected' ? 'Rejected' : 'Pending'}
                                      </span>
                                   </td>
                                   <td style={{ textAlign: 'center' }}>
                                      <span style={{ padding: '4px' }}>
                                         <FileText size={16} color={activeReport?.id === r.id ? "var(--accent)" : "var(--text-secondary)"} />
                                      </span>
                                   </td>
                                </tr>
                             ))
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>

           {/* Right Pane (Detail Monitor) */}
           <div className="visily-notification-pane" style={{ width: "100%", flex: "0 0 440px", padding: "24px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg-elevated)", alignSelf: "stretch" }}>
              {!activeReport ? (
                 <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted" style={{ minHeight: '300px' }}>
                    <FileText size={48} color="var(--border)" style={{ marginBottom: 16 }} />
                    <p style={{ fontSize: '0.9rem', marginBottom: 0, color: 'var(--text-secondary)' }}>Select a report to view details</p>
                 </div>
              ) : (
                 <div className="d-flex flex-column h-100">
                    <h5 style={{ fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                      {activeReport.title} {activeReport.projectName ? `- ${activeReport.projectName}` : ""}
                    </h5>
                    
                    <div className="d-flex flex-wrap gap-3 mb-4" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                       <div className="d-flex align-items-center gap-1"><Clock size={14}/> {activeReport.date || 'No Date'}</div>
                       <div className="d-flex align-items-center gap-1" style={{ color: 'var(--text-primary)', fontWeight: 500 }}><MapPin size={14}/> {activeReport.projectName || 'Unspecified Location'}</div>
                    </div>

                    <div className="d-flex flex-wrap gap-4 mb-4" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                       {activeReport.weather && <div><strong>Weather:</strong> {activeReport.weather}</div>}
                       {activeReport.gpsLat && activeReport.gpsLng && <div><MapPin size={12} color="var(--accent)"/> <strong>GPS:</strong> {activeReport.gpsLat}, {activeReport.gpsLng}</div>}
                    </div>

                    {/* Progress Summary block */}
                    {activeReport.description && (
                       <div className="mb-4">
                          <h6 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Progress Summary</h6>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', lineHeight: 1.6 }}>
                             {activeReport.description}
                          </div>
                       </div>
                    )}

                    {/* Photos */}
                    {activeReport.photoUrls?.length > 0 && (
                       <div className="mb-4">
                          <h6 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Uploaded Photos</h6>
                          <div className="d-flex flex-wrap gap-2">
                             {activeReport.photoUrls.map((url, idx) => (
                                <a key={idx} href={url} target="_blank" rel="noreferrer">
                                  <img src={url} alt={`Report ${idx}`} style={{ width: '100%', maxWidth: '140px', height: 100, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }}/>
                                </a>
                             ))}
                          </div>
                       </div>
                    )}
                    
                    {/* Rejection / Approval Comments area */}
                    {canReview && activeReport.status === "pending" && (
                       <div className="mt-auto pt-4" style={{ borderTop: '1px dashed var(--border)' }}>
                          <h6 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Review Comments</h6>
                          <textarea 
                             className="form-control mb-3" 
                             rows="3" 
                             placeholder="Add comments for rejection or approval..." 
                             style={{ fontSize: '0.85rem', borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                             value={inlineComment}
                             onChange={(e) => setInlineComment(e.target.value)}
                          />
                          <div className="d-flex gap-2 justify-content-end">
                             <button className="btn btn-outline-secondary" style={{ fontSize: '0.85rem', padding: '8px 16px', fontWeight: 600, color: 'var(--text-primary)' }} onClick={() => handleSubmitReviewInline(activeReport, "reject")}>
                                <XCircle size={14} className="me-1"/> Reject
                             </button>
                             <button className="visily-coral-btn" style={{ fontSize: '0.85rem', padding: '8px 16px' }} onClick={() => handleSubmitReviewInline(activeReport, "approve")}>
                                <CheckCircle size={14} className="me-1"/> Approve
                             </button>
                          </div>
                       </div>
                    )}

                    {activeReport.status !== "pending" && (
                       <div className="mt-auto pt-4" style={{ borderTop: '1px dashed var(--border)' }}>
                          <div className="d-flex align-items-center gap-2 mb-2">
                             {activeReport.status === 'approved' ? <CheckCircle size={16} color="var(--success)"/> : <XCircle size={16} color="var(--danger)"/>}
                             <h6 style={{ margin: 0, fontWeight: 700, color: activeReport.status === 'approved' ? 'var(--success)' : 'var(--danger)' }}>
                                This report was {activeReport.status}.
                             </h6>
                          </div>
                          {activeReport.reviewComment && (
                             <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', padding: '12px', background: 'var(--bg-surface)', borderLeft: `3px solid ${activeReport.status === 'approved' ? 'var(--success)' : 'var(--danger)'}`, borderRadius: 4 }}>
                                {activeReport.reviewComment}
                             </div>
                          )}
                       </div>
                    )}
                 </div>
              )}
           </div>
        </div>
      </div>

      {/* Submit Report Modal — Supervisor only (per flowchart: Fill form, Upload photos & sign) */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} style={{backdropFilter: 'blur(4px)'}}>
          <div className="sp-modal" style={{ maxWidth: 900, padding: 0, overflow: 'hidden', borderRadius: 12, border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="visily-split-modal">
              {/* Left pane: Upload Status (dummy data to match design) */}
              <div className="visily-modal-left d-none d-md-block" style={{ background: 'var(--bg-surface)' }}>
                <h4 style={{fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)'}}>Upload Status</h4>
                <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 24}}>View the upload status for each report here.</p>
                
                <div className="visily-status-item">
                  <h6 style={{fontWeight: 600, fontSize: '0.9rem', marginBottom: 4, color: 'var(--text-primary)'}}>Upload Successful</h6>
                  <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0}}>Your report was uploaded successfully.</p>
                  <span style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>2 minutes ago</span>
                </div>

                <div className="visily-status-item">
                  <h6 style={{fontWeight: 600, fontSize: '0.9rem', marginBottom: 4, color: 'var(--text-primary)'}}>Error Detected</h6>
                  <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0}}>There was an issue with file format.</p>
                  <span style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>5 minutes ago</span>
                </div>

                <div className="visily-status-item">
                  <h6 style={{fontWeight: 600, fontSize: '0.9rem', marginBottom: 4, color: 'var(--text-primary)'}}>Pending Approval</h6>
                  <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0}}>Your report is awaiting review.</p>
                  <span style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>10 minutes ago</span>
                </div>
              </div>

              {/* Right pane: Form */}
              <div className="visily-modal-right" style={{ background: 'var(--bg-elevated)' }}>
                <h4 style={{fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)'}}>Site Daily Task Form</h4>
                <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 24}}>Please fill in the details below to upload your daily report.</p>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <input className="visily-input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Report Title" />
                  
                  {/* Additional form fields from original code mapped nicely */}
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
                     <select className="visily-input" required value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} style={{color: form.projectId ? 'inherit' : '#999'}}>
                      <option value="" disabled hidden>Select project...</option>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="text" onFocus={e => e.target.type='date'} onBlur={e => {if(!e.target.value) e.target.type='text'}} className="visily-input" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} placeholder="Date" />
                  </div>

                  <input className="visily-input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />

                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
                    <input className="visily-input" value={form.workforce} onChange={(e) => setForm({ ...form, workforce: e.target.value })} placeholder="Workforce (pax)" />
                    <input className="visily-input" value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} placeholder="Equipment" />
                  </div>

                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
                    <input className="visily-input" value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} placeholder="Materials Used" />
                    <div>
                      {/* Weather — live badge (API) or custom pill selector */}
                      {weatherInfo ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
                          <img src={`https://openweathermap.org/img/wn/${weatherInfo.icon}.png`} alt="weather" style={{ width: 32, height: 32 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{form.weather}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{weatherInfo.temp}°C · Humidity {weatherInfo.humidity}%</div>
                          </div>
                          <button type="button" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem' }} onClick={() => { setWeatherInfo(null); setForm(f => ({ ...f, weather: '' })); }}>✕</button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>Weather <span style={{ opacity: 0.6 }}>(or auto-fill via GPS)</span></div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {[
                              { label: '☀️ Sunny', val: 'Sunny' },
                              { label: '☁️ Cloudy', val: 'Cloudy' },
                              { label: '🌦️ Partly', val: 'Partly Cloudy' },
                              { label: '🌧️ Rainy', val: 'Rainy' },
                              { label: '⛈️ Stormy', val: 'Stormy' },
                            ].map(({ label, val }) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, weather: val }))}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: 20,
                                  border: `1px solid ${form.weather === val ? '#F56A6A' : 'var(--border)'}`,
                                  background: form.weather === val ? '#F56A6A' : 'var(--bg-surface)',
                                  color: form.weather === val ? '#fff' : 'var(--text-primary)',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <input className="visily-input" value={form.issues} onChange={(e) => setForm({ ...form, issues: e.target.value })} placeholder="Issues / Problems (if any)" />

                  <div>
                     <label style={{fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 6, display: 'block', fontWeight: 600}}>Photos (Add 1 or more)</label>
                     <button type="button" className="visily-full-btn" onClick={() => fileInputRef.current?.click()}>
                        Add Photos
                     </button>
                     <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotos} style={{ display: "none" }} />
                     {photoPreviews.length > 0 && (
                        <div className="rp-preview-grid mt-2">
                          {photoPreviews.map((src, i) => (
                            <div key={i} className="rp-preview-wrap">
                              <img src={src} alt="" className="rp-preview-img" />
                              <button type="button" className="rp-preview-remove" onClick={() => removePhoto(i)}><X size={10} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>

                  <div>
                     <label style={{fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 6, display: 'block', fontWeight: 600}}>
                       GPS Location &amp; Weather
                       <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 8 }}>— click button to auto-detect</span>
                     </label>
                     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12 }}>
                       <input className="visily-input" value={form.gpsLat} onChange={(e) => setForm({ ...form, gpsLat: e.target.value })} placeholder="Latitude" />
                       <input className="visily-input" value={form.gpsLng} onChange={(e) => setForm({ ...form, gpsLng: e.target.value })} placeholder="Longitude" />
                       <button type="button" className="visily-coral-btn" disabled={locationFetching} onClick={async () => {
                         if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
                         setLocationFetching(true);
                         toast.loading("Detecting location & weather...", { id: "loc" });
                         navigator.geolocation.getCurrentPosition(async (pos) => {
                           const lat = pos.coords.latitude.toFixed(6);
                           const lng = pos.coords.longitude.toFixed(6);
                           setForm(f => ({ ...f, gpsLat: lat, gpsLng: lng }));
                           try {
                             // ── OpenWeatherMap API ────────────────────────────
                             const OWM_KEY = process.env.REACT_APP_OWM_KEY || "bd5e378503939ddaee76f12ad7a97608";
                             const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OWM_KEY}&units=metric`);
                             if (weatherRes.ok) {
                               const wd = await weatherRes.json();
                               const main = wd.weather[0].main; // Rain, Clouds, Clear, Thunderstorm, Drizzle
                               const desc = wd.weather[0].description;
                               const temp = Math.round(wd.main.temp);
                               const humidity = wd.main.humidity;
                               const icon = wd.weather[0].icon;
                               // Map OWM condition to our labels
                               const weatherLabel =
                                 main === 'Clear' ? 'Sunny' :
                                 main === 'Rain' || main === 'Drizzle' ? 'Rainy' :
                                 main === 'Thunderstorm' ? 'Stormy' :
                                 main === 'Clouds' && desc.includes('few') ? 'Partly Cloudy' :
                                 main === 'Clouds' ? 'Cloudy' : 'Partly Cloudy';
                               setForm(f => ({ ...f, weather: weatherLabel }));
                               setWeatherInfo({ desc, temp, humidity, icon });
                             }
                             // ── Reverse Geocode (OpenStreetMap Nominatim) ─────
                             const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
                             if (geoRes.ok) {
                               const gd = await geoRes.json();
                               const city = gd.address?.city || gd.address?.town || gd.address?.village || gd.address?.county || '';
                               const state = gd.address?.state || '';
                               if (city || state) toast.success(`📍 ${city}${city && state ? ', ' : ''}${state} — weather auto-filled`, { id: "loc" });
                               else toast.success("Location & weather acquired", { id: "loc" });
                             } else {
                               toast.success("Location & weather acquired", { id: "loc" });
                             }
                           } catch (err) {
                             toast.success("GPS acquired (weather fetch failed)", { id: "loc" });
                           }
                           setLocationFetching(false);
                         }, () => {
                           toast.error("Failed to get location", { id: "loc" });
                           setLocationFetching(false);
                         });
                       }}>
                         {locationFetching ? <Loader2 size={14} className="spin" /> : <MapPin size={14} />} {locationFetching ? 'Detecting...' : 'Get Location'}
                       </button>
                     </div>
                   </div>

                  <div style={{ marginTop: 8 }}>
                    <label style={{fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 600}}>
                      <span>Digital Signature</span>
                      <button type="button" className="btn btn-sm btn-ghost" style={{ padding: '2px 8px', color: '#F56A6A' }} onClick={() => sigCanvas.current.clear()}>Clear</button>
                    </label>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: '#fff', overflow: 'hidden' }}>
                      <SignatureCanvas 
                        ref={sigCanvas} 
                        penColor="black"
                        canvasProps={{width: 530, height: 100, className: 'sigCanvas'}}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                    <button type="submit" className="visily-coral-btn" style={{padding: '10px 32px', fontSize: '0.95rem'}} disabled={loading}>
                      {loading ? <Loader2 size={16} className="spin" /> : "Submit"}
                    </button>
                    <button type="button" className="visily-gray-btn" style={{padding: '10px 32px', fontSize: '0.95rem'}} onClick={() => setShowModal(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Comment Modal — Consultant approve/reject with comments (per flowchart) */}
      {showCommentModal && commentTarget && (
        <div className="modal-overlay" onClick={() => setShowCommentModal(false)}>
          <div className="sp-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <MessageSquare size={20} />
              {commentAction === "approve" ? "Approve Report" : "Reject Report"}
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 16 }}>
              <strong>Report:</strong> {commentTarget.title} <br />
              <strong>Submitted by:</strong> {commentTarget.submittedBy}
            </p>
            <div className="form-group">
              <label className="form-label">
                {commentAction === "approve" ? "Comment (optional)" : "Reason for rejection"}
              </label>
              <textarea
                className="form-control"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={commentAction === "approve" ? "Add a comment for the supervisor..." : "Explain why this report is being rejected..."}
                rows={3}
                required={commentAction === "reject"}
              />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowCommentModal(false)}>Cancel</button>
              {commentAction === "approve" ? (
                <button className="btn btn-sm" style={{ background: "rgba(63,185,80,0.15)", color: "var(--success)", border: "1px solid rgba(63,185,80,0.3)", padding: "8px 18px" }} onClick={handleSubmitReview}>
                  <CheckCircle size={14} /> Approve
                </button>
              ) : (
                <button className="btn btn-danger" onClick={handleSubmitReview}>
                  <XCircle size={14} /> Reject
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Project Export Selection Modal */}
      {showExportModal && (
        <div className="modal-overlay d-print-none" onClick={() => setShowExportModal(false)}>
          <div className="sp-modal" style={{ maxWidth: 650 }} onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-title d-flex justify-content-between align-items-center mb-0">
              <span style={{ fontSize: '1.2rem' }}>Export Project Master Report</span>
              <button className="btn btn-ghost btn-sm p-1" onClick={() => setShowExportModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p className="small text-muted mt-2 mb-4">Select a project to export its comprehensive task roadmap and all associated daily reports.</p>
            
            <div className="db-project-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {projects.length === 0 ? <p className="text-muted small text-center">No active projects to export.</p> : null}
              {projects.map((p) => (
                <div key={p.id} className="card p-3 mb-2" style={{ cursor: 'pointer', border: expandedExportProject === p.id ? '1px solid var(--accent)' : '1px solid var(--border)' }} onClick={() => setExpandedExportProject(expandedExportProject === p.id ? null : p.id)}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <div className="fw-semibold" style={{ color: "var(--text-primary)" }}>{p.name}</div>
                      <div className="small text-muted">{p.location || "No Location"} • {p.progress}% Progress</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedExportProject(p); setTimeout(() => window.print(), 200); }}>
                      Select & Export
                    </button>
                  </div>

                  {expandedExportProject === p.id && (
                    <div className="mt-3 pt-3" style={{ borderTop: "1px dashed var(--border)", cursor: 'default' }} onClick={(e) => e.stopPropagation()}>
                      <h6 className="mb-2" style={{ color: "var(--text-primary)", fontSize: "0.85rem" }}>Task List:</h6>
                      {tasks.filter(t => t.projectId === p.id).length === 0 ? (
                        <p className="small text-muted mb-0">No tasks currently appended to this project.</p>
                      ) : (
                        <div className="table-responsive">
                          <table className="table table-sm" style={{ fontSize: "0.75rem" }}>
                            <thead>
                              <tr>
                                <th>Task Title</th>
                                <th>Assigned To</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tasks.filter(t => t.projectId === p.id).map(t => (
                                <tr key={t.id}>
                                  <td>{t.title}</td>
                                  <td>{t.assignedTo || "—"}</td>
                                  <td>{t.status}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Invisible Printable Component triggered by window.print() */}
      {selectedExportProject && (
        <div className="printable-reports-export d-none">
          <div style={{ padding: '32px', fontFamily: 'Arial, sans-serif', color: '#111' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, borderBottom: '2px solid #F56A6A', paddingBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#F56A6A', letterSpacing: 2, marginBottom: 4 }}>MEC'S ENGINEERING SDN. BHD.</div>
                <h1 style={{ fontSize: 22, margin: 0, fontWeight: 800 }}>{selectedExportProject.name}</h1>
                <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>Project Progress Report</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: '#555' }}>
                <div><strong>Exported:</strong> {new Date().toLocaleDateString('en-MY', { day:'2-digit', month:'long', year:'numeric' })}</div>
                <div><strong>Location:</strong> {selectedExportProject.location || 'N/A'}</div>
                <div><strong>Status:</strong> {selectedExportProject.status || 'Active'}</div>
                <div><strong>Progress:</strong> {selectedExportProject.progress || 0}%</div>
              </div>
            </div>

            {/* Section 1: Task Assignment Table */}
            <h2 style={{ fontSize: 15, borderBottom: '1px solid #ddd', paddingBottom: 6, marginBottom: 12, color: '#111' }}>
              Section 1 — Task Assignments &amp; Site In-Charge
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 32 }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '8px 10px', border: '1px solid #ddd', textAlign: 'left' }}>Task Title</th>
                  <th style={{ padding: '8px 10px', border: '1px solid #ddd', textAlign: 'left' }}>Site In-Charge (Supervisor)</th>
                  <th style={{ padding: '8px 10px', border: '1px solid #ddd', textAlign: 'left' }}>Site</th>
                  <th style={{ padding: '8px 10px', border: '1px solid #ddd', textAlign: 'left' }}>Due Date</th>
                  <th style={{ padding: '8px 10px', border: '1px solid #ddd', textAlign: 'left' }}>Priority</th>
                  <th style={{ padding: '8px 10px', border: '1px solid #ddd', textAlign: 'left' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.filter(t => t.projectId === selectedExportProject.id).length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '10px', border: '1px solid #ddd', textAlign: 'center', color: '#888' }}>No tasks assigned to this project.</td></tr>
                ) : (
                  tasks.filter(t => t.projectId === selectedExportProject.id).map((t, i) => (
                    <tr key={t.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '8px 10px', border: '1px solid #ddd', fontWeight: 600 }}>{t.title}</td>
                      <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{t.assignedTo || '—'}</td>
                      <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{t.site || '—'}</td>
                      <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>{t.dueDate || '—'}</td>
                      <td style={{ padding: '8px 10px', border: '1px solid #ddd', textTransform: 'capitalize' }}>{t.priority || 'medium'}</td>
                      <td style={{ padding: '8px 10px', border: '1px solid #ddd' }}>
                        <span style={{
                          background: t.status === 'done' ? '#d1fae5' : t.status === 'inprogress' ? '#dbeafe' : '#f3f4f6',
                          color: t.status === 'done' ? '#065f46' : t.status === 'inprogress' ? '#1e40af' : '#374151',
                          padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, textTransform: 'uppercase'
                        }}>
                          {t.status === 'inprogress' ? 'In Progress' : t.status === 'todo' ? 'To Do' : 'Done'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Section 2: Daily Reports with Evidence */}
            <h2 style={{ fontSize: 15, borderBottom: '1px solid #ddd', paddingBottom: 6, marginBottom: 16, color: '#111' }}>
              Section 2 — Daily Progress Reports &amp; Evidence
            </h2>
            {reports.filter(r => r.projectId === selectedExportProject.id).length === 0 ? (
              <p style={{ fontSize: 12, color: '#888' }}>No daily reports filed for this project.</p>
            ) : (
              reports.filter(r => r.projectId === selectedExportProject.id).map((r, index) => (
                <div key={r.id} style={{ marginBottom: 28, border: '1px solid #ddd', borderRadius: 6, overflow: 'hidden', pageBreakInside: 'avoid' }}>
                  {/* Report header bar */}
                  <div style={{ background: '#f8f8f8', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>Report #{index + 1}: {r.title}</span>
                      <span style={{ marginLeft: 12, fontSize: 11, color: '#555' }}>Submitted by: <strong>{r.submittedBy}</strong></span>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 4,
                      background: r.status === 'approved' ? '#d1fae5' : r.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                      color: r.status === 'approved' ? '#065f46' : r.status === 'rejected' ? '#991b1b' : '#92400e',
                      textTransform: 'uppercase'
                    }}>{r.status}</span>
                  </div>

                  <div style={{ padding: '12px 16px' }}>
                    {/* Report meta */}
                    <div style={{ display: 'flex', gap: 24, fontSize: 11, color: '#444', marginBottom: 10, flexWrap: 'wrap' }}>
                      <span><strong>Date:</strong> {r.date || '—'}</span>
                      <span><strong>Weather:</strong> {r.weather || '—'}</span>
                      <span><strong>Workforce:</strong> {r.workforce || '—'} pax</span>
                      <span><strong>Equipment:</strong> {r.equipment || '—'}</span>
                      <span><strong>Materials:</strong> {r.materials || '—'}</span>
                      {r.gpsLat && r.gpsLng && <span><strong>GPS:</strong> {r.gpsLat}, {r.gpsLng}</span>}
                    </div>

                    {/* Description */}
                    {r.description && (
                      <div style={{ fontSize: 11, marginBottom: 10 }}>
                        <strong>Progress Description:</strong>
                        <div style={{ marginTop: 4, padding: '8px 10px', background: '#f9f9f9', borderLeft: '3px solid #F56A6A', borderRadius: 3, lineHeight: 1.6 }}>{r.description}</div>
                      </div>
                    )}

                    {/* Issues */}
                    {r.issues && (
                      <div style={{ fontSize: 11, marginBottom: 10, padding: '6px 10px', background: '#fff8f0', borderLeft: '3px solid #f59e0b', borderRadius: 3 }}>
                        <strong>Issues/Problems:</strong> {r.issues}
                      </div>
                    )}

                    {/* Consultant comment */}
                    {r.reviewComment && (
                      <div style={{ fontSize: 11, marginBottom: 10, padding: '6px 10px', background: '#f0f7ff', borderLeft: '3px solid #3b82f6', borderRadius: 3 }}>
                        <strong>Consultant Feedback:</strong> {r.reviewComment}
                        {r.reviewedBy && <span style={{ color: '#555' }}> — {r.reviewedBy}</span>}
                      </div>
                    )}

                    {/* Photo Evidence */}
                    {r.photoUrls?.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
                          Photo Evidence ({r.photoUrls.length} photo{r.photoUrls.length > 1 ? 's' : ''})
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {r.photoUrls.map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`Evidence ${idx + 1}`}
                              style={{ width: 130, height: 100, objectFit: 'cover', border: '1px solid #ddd', borderRadius: 4 }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {(!r.photoUrls || r.photoUrls.length === 0) && (
                      <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic', marginTop: 6 }}>No photo evidence attached.</div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Footer */}
            <div style={{ marginTop: 40, paddingTop: 12, borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888' }}>
              <span>SPRS — Site Progress Reporting System | MEC's Engineering Sdn. Bhd.</span>
              <span>Generated: {new Date().toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
