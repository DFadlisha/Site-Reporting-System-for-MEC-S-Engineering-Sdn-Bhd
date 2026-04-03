// src/components/reports/ReportsPage.js
import React, { useEffect, useState, useRef } from "react";
import {
  Plus, X, Loader2, FileText, Camera, CheckCircle,
  XCircle, Clock, MapPin, ChevronDown, ChevronUp,
} from "lucide-react";
import Topbar from "../shared/Topbar";
import {
  createReport, subscribeReports, updateReport,
  subscribeProjects, createNotification,
} from "../../firebase/services";
import { useAuth } from "../../contexts/AuthContext";
import toast from "react-hot-toast";
import SignatureCanvas from 'react-signature-canvas';
import "./ReportsPage.css";

export default function ReportsPage() {
  const { profile, user } = useAuth();
  const isConsultant = profile?.role === "consultant";

  const [reports, setReports]   = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded]   = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const fileInputRef = useRef(null);

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
    return () => { u1(); u2(); };
  }, []);

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

  const handleApprove = async (report) => {
    await updateReport(report.id, { status: "approved", reviewedBy: profile?.name, reviewedAt: new Date().toISOString() });
    await createNotification(report.submittedById, `Your report "${report.title}" has been approved.`, "success");
    toast.success("Report approved");
  };

  const handleReject = async (report) => {
    const reason = window.prompt("Reason for rejection (optional):");
    await updateReport(report.id, { status: "rejected", rejectedReason: reason || "", reviewedBy: profile?.name });
    await createNotification(report.submittedById, `Your report "${report.title}" was rejected. ${reason ? "Reason: " + reason : ""}`, "error");
    toast.success("Report rejected");
  };

  const filtered = filterStatus === "all" ? reports : reports.filter((r) => r.status === filterStatus);

  const statusIcon = (s) => {
    if (s === "approved") return <CheckCircle size={14} color="var(--success)" />;
    if (s === "rejected") return <XCircle size={14} color="var(--danger)" />;
    return <Clock size={14} color="var(--warning)" />;
  };

  return (
    <div>
      <Topbar title="Daily Reports" />
      <div className="page-body">

        {/* Header */}
        <div className="page-header">
          <div>
            <h2 className="page-title">Site Daily Reports</h2>
            <p className="page-subtitle">{filtered.length} report{filtered.length !== 1 ? "s" : ""}</p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className="tk-filter-tabs">
              {["all", "pending", "approved", "rejected"].map((s) => (
                <button key={s} className={`tk-filter-tab ${filterStatus === s ? "active" : ""}`} onClick={() => setFilterStatus(s)}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            {!isConsultant && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
                <Plus size={14} /> Submit Report
              </button>
            )}
          </div>
        </div>

        {/* Report list */}
        {filtered.length === 0 ? (
          <div className="tk-empty">
            <FileText size={40} />
            <p>No reports found</p>
            {!isConsultant && <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={14} /> Submit First Report</button>}
          </div>
        ) : (
          <div className="rp-list">
            {filtered.map((r) => (
              <div key={r.id} className="rp-item card">
                <div className="rp-item-header" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <div className="rp-item-left">
                    <div className="rp-item-icon">
                      <FileText size={16} />
                    </div>
                    <div>
                      <div className="rp-item-title">{r.title || "Daily Log Report"}</div>
                      <div className="rp-item-meta">
                        {r.projectName && <span>{r.projectName}</span>}
                        {r.date && <span>• {r.date}</span>}
                        <span>• By {r.submittedBy}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rp-item-right">
                    <span className={`badge badge-${r.status}`} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      {statusIcon(r.status)} {r.status}
                    </span>
                    {isConsultant && r.status === "pending" && (
                      <div className="rp-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-sm" style={{ background: "rgba(63,185,80,0.15)", color: "var(--success)", border: "1px solid rgba(63,185,80,0.3)" }} onClick={() => handleApprove(r)}>
                          <CheckCircle size={13} /> Approve
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleReject(r)}>
                          <XCircle size={13} /> Reject
                        </button>
                      </div>
                    )}
                    {expanded === r.id ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
                  </div>
                </div>

                {expanded === r.id && (
                  <div className="rp-details">
                    <div className="rp-details-grid">
                      {r.weather      && <div className="rp-detail-item"><span className="rp-dl">Weather</span><span>{r.weather}</span></div>}
                      {r.workforce    && <div className="rp-detail-item"><span className="rp-dl">Workforce</span><span>{r.workforce}</span></div>}
                      {r.materials    && <div className="rp-detail-item"><span className="rp-dl">Materials</span><span>{r.materials}</span></div>}
                      {r.equipment    && <div className="rp-detail-item"><span className="rp-dl">Equipment</span><span>{r.equipment}</span></div>}
                      {r.issues       && <div className="rp-detail-item"><span className="rp-dl">Issues</span><span style={{ color: "var(--danger)" }}>{r.issues}</span></div>}
                      {r.gpsLat && r.gpsLng && (
                        <div className="rp-detail-item">
                          <span className="rp-dl"><MapPin size={12} /> GPS</span>
                          <span>{r.gpsLat}, {r.gpsLng}</span>
                        </div>
                      )}
                    </div>
                    {r.description && (
                      <div className="rp-description">
                        <span className="rp-dl">Progress Description</span>
                        <p>{r.description}</p>
                      </div>
                    )}
                    {r.photoUrls?.length > 0 && (
                      <div className="rp-photos">
                        <span className="rp-dl">Site Photos</span>
                        <div className="rp-photo-grid">
                          {r.photoUrls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              <img src={url} alt={`site-${i}`} className="rp-photo" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {r.signature && (
                      <div className="rp-description mt-3">
                        <span className="rp-dl">Digital Signature (Canvas API)</span>
                        <div>
                          <img src={r.signature} alt="Supervisor Signature" style={{ height: 80, borderBottom: '1px solid var(--border)', paddingBottom: 5 }} />
                          <div style={{ fontSize: '0.75rem', color: "var(--text-secondary)", marginTop: 4 }}>Signed by: {r.submittedBy}</div>
                        </div>
                      </div>
                    )}
                    {r.reviewedBy && (
                      <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 8 }}>
                        Reviewed by {r.reviewedBy}{r.rejectedReason ? ` — ${r.rejectedReason}` : ""}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Report Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Submit Daily Site Report</div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Report Title</label>
                  <input className="form-control" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Daily Log – Block A" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-control" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Project</label>
                  <select className="form-control" required value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                    <option value="">Select project...</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Weather</label>
                  <select className="form-control" value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })}>
                    <option value="">Select...</option>
                    {["Sunny", "Cloudy", "Rainy", "Stormy", "Partly Cloudy"].map((w) => <option key={w}>{w}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Progress Description</label>
                <textarea className="form-control" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe what was done today..." />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Workforce (pax)</label>
                  <input className="form-control" value={form.workforce} onChange={(e) => setForm({ ...form, workforce: e.target.value })} placeholder="15" />
                </div>
                <div className="form-group">
                  <label className="form-label">Materials Used</label>
                  <input className="form-control" value={form.materials} onChange={(e) => setForm({ ...form, materials: e.target.value })} placeholder="Cement, Steel..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Equipment</label>
                  <input className="form-control" value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} placeholder="Excavator, Crane..." />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Issues / Problems (if any)</label>
                <input className="form-control" value={form.issues} onChange={(e) => setForm({ ...form, issues: e.target.value })} placeholder="Leave blank if no issues" />
              </div>

              {/* Photo upload */}
              <div className="form-group">
                <label className="form-label">Site Photos</label>
                <div className="rp-upload-area" onClick={() => fileInputRef.current?.click()}>
                  <Camera size={22} />
                  <span>Click to add photos</span>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotos} style={{ display: "none" }} />
                </div>
                {photoPreviews.length > 0 && (
                  <div className="rp-preview-grid">
                    {photoPreviews.map((src, i) => (
                      <div key={i} className="rp-preview-wrap">
                        <img src={src} alt="" className="rp-preview-img" />
                        <button type="button" className="rp-preview-remove" onClick={() => removePhoto(i)}><X size={10} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Digital Signature using Canvas API */}
              <div className="form-group mt-2">
                <label className="form-label d-flex justify-content-between align-items-center">
                  <span>Digital Signature (Canvas API)</span>
                  <button type="button" className="btn btn-sm btn-ghost" style={{ padding: '2px 8px' }} onClick={() => sigCanvas.current.clear()}>Clear</button>
                </label>
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: '#fff', overflow: 'hidden' }}>
                  <SignatureCanvas 
                    ref={sigCanvas} 
                    penColor="black"
                    canvasProps={{width: 550, height: 150, className: 'sigCanvas'}}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <Loader2 size={16} className="spin" /> : <Plus size={16} />} Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
