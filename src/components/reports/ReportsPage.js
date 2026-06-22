// src/components/reports/ReportsPage.js
import React, { useEffect, useState, useRef } from "react";
import {
  Plus, X, Loader2, FileText, Camera, CheckCircle,
  XCircle, Clock, MapPin, ChevronDown, ChevronUp, MessageSquare, Download,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLocation } from "react-router-dom";
import Topbar from "../shared/Topbar";
import {
  createReport, subscribeReports, updateReport,
  subscribeProjects, createNotification, subscribeTasks,
  getSystemUsers, subscribeUserProjects,
  subscribeCustomMaterials, subscribeCustomEquipment,
  addCustomMaterialIfNew, addCustomEquipmentIfNew
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
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
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
    title: "", projectId: "", projectName: "", taskId: "", taskName: "", date: "", weather: "",
    description: "", workforce: "", materials: "", equipment: "",
    gpsLat: "", gpsLng: "", issues: "",
  });
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const sigCanvas = useRef(null);

  // Equipment & Materials options and multi-select states
  const [dbMaterials, setDbMaterials] = useState([]);
  const [dbEquipment, setDbEquipment] = useState([]);

  const materialsOptions = React.useMemo(() => {
    const predefined = ["Cement", "Steel Bars", "Bricks", "Sand", "Gravel", "Pipes", "Timber", "Paint"];
    const merged = [...new Set([...predefined, ...dbMaterials])];
    return [...merged, "Other"];
  }, [dbMaterials]);

  const equipmentOptions = React.useMemo(() => {
    const predefined = ["Excavator", "Concrete Mixer", "Mobile Crane", "Scaffolding", "Generator", "Welding Machine", "Jackhammer"];
    const merged = [...new Set([...predefined, ...dbEquipment])];
    return [...merged, "Other"];
  }, [dbEquipment]);

  const [selectedEquipment, setSelectedEquipment] = useState([]);
  const [customEquipment, setCustomEquipment] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [customMaterials, setCustomMaterials] = useState("");

  useEffect(() => {
    const u1 = subscribeReports(null, setReports);
    const u2 = subscribeUserProjects(user?.uid, role, setProjects);
    const u3 = subscribeTasks(null, setTasks);
    const u4 = subscribeCustomMaterials((mats) => {
      setDbMaterials(mats.map(m => m.name));
    });
    const u5 = subscribeCustomEquipment((eqs) => {
      setDbEquipment(eqs.map(e => e.name));
    });
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [user, role]);

  const getReportMonth = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split("-");
    if (parts.length >= 2) {
      return parseInt(parts[1], 10);
    }
    return null;
  };

  const projectIdsSet = React.useMemo(() => new Set(projects.map(p => p.id)), [projects]);

  const visibleTasks = React.useMemo(() => {
    const baseTasks = tasks.filter(t => projectIdsSet.has(t.projectId));
    if (isSupervisor) {
      return baseTasks.filter(t => t.assignedTo === profile?.name || t.assignedToUid === user?.uid);
    }
    return baseTasks;
  }, [tasks, projectIdsSet, isSupervisor, profile, user]);

  const visibleProjects = React.useMemo(() => {
    if (isSupervisor) {
      const myProjectIds = new Set(visibleTasks.map(t => t.projectId));
      return projects.filter(p => myProjectIds.has(p.id));
    }
    return projects;
  }, [projects, visibleTasks, isSupervisor]);

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
    
    // Compile equipment and materials from chips
    const customEqList = selectedEquipment.includes("Other") && customEquipment 
      ? customEquipment.split(",").map(s => s.trim()).filter(Boolean) 
      : [];
    const finalEquipment = [
      ...selectedEquipment.filter(eq => eq !== "Other"),
      ...customEqList
    ].filter(Boolean).join(", ");

    const customMatList = selectedMaterials.includes("Other") && customMaterials 
      ? customMaterials.split(",").map(s => s.trim()).filter(Boolean) 
      : [];
    const finalMaterials = [
      ...selectedMaterials.filter(mat => mat !== "Other"),
      ...customMatList
    ].filter(Boolean).join(", ");

    // Validation
    if (!form.title.trim()) {
      return toast.error("Please enter a report title.");
    }
    if (!form.projectId) {
      return toast.error("Please select a project.");
    }
    if (!form.taskId) {
      return toast.error("Please select a task.");
    }
    if (!form.date) {
      return toast.error("Please select a date.");
    }
    if (!form.description.trim()) {
      return toast.error("Please enter a progress description.");
    }
    if (photoFiles.length === 0) {
      return toast.error("Please upload at least 1 photo as evidence.");
    }
    if (sigCanvas.current.isEmpty()) {
      return toast.error("Please provide your physical signature digitally.");
    }
    
    setLoading(true);
    try {
      // Capture signature via Canvas API as base64 string
      const signatureData = sigCanvas.current.getCanvas().toDataURL('image/png');
      const selectedProject = projects.find((p) => p.id === form.projectId);
      await createReport(
        {
          ...form,
          equipment: finalEquipment,
          materials: finalMaterials,
          projectName: selectedProject?.name || "",
          submittedBy: profile?.name || user?.email,
          submittedById: user?.uid,
          signature: signatureData // Save signature context
        },
        photoFiles
      );

      // Auto-save new custom materials & tools to Firebase
      try {
        const matPromises = customMatList.map(mat => addCustomMaterialIfNew(mat));
        const eqPromises = customEqList.map(eq => addCustomEquipmentIfNew(eq));
        await Promise.all([...matPromises, ...eqPromises]);
      } catch (saveErr) {
        console.error("Error auto-saving materials/equipment:", saveErr);
      }

      // Notify all consultants about new report submission
      try {
        const allUsers = await getSystemUsers();
        const consultants = allUsers.filter(u => u.role === 'consultant');
        for (const c of consultants) {
          await createNotification(
            c.uid,
            `New daily report submitted: "${form.title}" by ${profile?.name || user?.email}. Awaiting your review.`,
            "info",
            "/reports" // Link to review daily reports
          );
        }
      } catch (notifErr) { console.error('Notification error:', notifErr); }

      toast.success("Daily report submitted!");
      setShowModal(false);
      setForm({ title: "", projectId: "", projectName: "", taskId: "", taskName: "", date: "", weather: "", description: "", workforce: "", materials: "", equipment: "", gpsLat: "", gpsLng: "", issues: "" });
      setPhotoFiles([]);
      setPhotoPreviews([]);
      setSelectedEquipment([]);
      setCustomEquipment("");
      setSelectedMaterials([]);
      setCustomMaterials("");
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
          action === "approve" ? "success" : "error",
          "/reports"
        );
      }
      toast.success(`Report ${dbAction}`);
      setActiveReport(null);
      setInlineComment("");
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── Modal review submit (Approve/Reject confirmation popup) ──
  const handleSubmitReview = async () => {
    if (commentAction === "reject" && !commentText.trim()) {
      return toast.error("Please provide a reason for rejection.");
    }
    try {
      const dbAction = commentAction === "approve" ? "approved" : "rejected";
      await updateReport(commentTarget.id, {
        status: dbAction,
        reviewedBy: profile?.name,
        reviewedAt: new Date().toISOString(),
        reviewComment: commentText || "",
        ...(commentAction === "reject" && { rejectedReason: commentText || "" })
      });
      if (commentTarget.submittedById) {
        await createNotification(
          commentTarget.submittedById, 
          `Your report "${commentTarget.title}" was ${dbAction}.${commentText ? ` Comment: ${commentText}` : ""}`, 
          commentAction === "approve" ? "success" : "error",
          "/reports"
        );
      }
      toast.success(`Report ${dbAction}`);
      setActiveReport(null);
      setShowCommentModal(false);
      setCommentText("");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const allowedReports = React.useMemo(() => {
    return reports.filter(r => projectIdsSet.has(r.projectId));
  }, [reports, projectIdsSet]);

  const filtered = React.useMemo(() => {
    return allowedReports.filter(r => {
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterProject && r.projectId !== filterProject) return false;
      if (filterSearch && !r.title?.toLowerCase().includes(filterSearch.toLowerCase()) && !r.projectName?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      
      // Month filter
      if (filterMonth !== "all") {
        const monthNum = getReportMonth(r.date);
        if (monthNum !== parseInt(filterMonth, 10)) return false;
      }

      const proj = projects.find(p => p.id === r.projectId);

      // Location filter
      if (filterLocation && proj?.location !== filterLocation) return false;

      // Priority filter
      if (filterPriority !== "all" && (proj?.priority || "medium") !== filterPriority) return false;

      return true;
    });
  }, [allowedReports, filterStatus, filterProject, filterSearch, filterMonth, filterLocation, filterPriority, projects]);

  const totalReports = allowedReports.length;
  const pendingReports = allowedReports.filter(r => r.status === "pending").length;
  const approvedReports = allowedReports.filter(r => r.status === "approved").length;
  const rejectedReports = allowedReports.filter(r => r.status === "rejected").length;

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

  // ── Professional PDF Export (Corporate Monochrome Style) ──────────
  const handleExportProjectPDF = (project) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentW = pageW - margin * 2;
    const exportDate = new Date().toLocaleDateString("en-MY", { day: "2-digit", month: "long", year: "numeric" });
    const projTasks   = tasks.filter(t => t.projectId === project.id);
    const projReports = reports.filter(r => r.projectId === project.id);

    // ── Professional monochrome palette ──
    const NAVY      = [18,  36,  71];   // primary dark navy
    const NAVYMID   = [44,  73, 130];   // mid navy for accents
    const CHARCOAL  = [50,  50,  55];   // body text
    const MIDGREY   = [110, 110, 115];  // secondary text / labels
    const LIGHTGREY = [235, 236, 238];  // table alternate rows / boxes
    const PALEGREY  = [248, 248, 249];  // info box bg
    const WHITE     = [255, 255, 255];
    const BLACK     = [0,   0,   0];

    // Status text helpers — text-only, no fill colours
    const statusLabel = (s) => {
      if (s === "approved") return "Approved";
      if (s === "rejected") return "Rejected";
      if (s === "pending")  return "Pending";
      return s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";
    };
    const taskStatusLabel = (s) =>
      s === "inprogress" ? "In Progress" : s === "todo" ? "To Do" : s === "done" ? "Completed" : s || "—";

    // ── Helper: horizontal rule ──
    const drawRule = (yPos, thickness = 0.3, color = LIGHTGREY) => {
      doc.setDrawColor(...color);
      doc.setLineWidth(thickness);
      doc.line(margin, yPos, pageW - margin, yPos);
    };

    // ── Helper: section heading ──
    const drawSectionHeading = (text, yPos) => {
      // Left accent bar
      doc.setFillColor(...NAVYMID);
      doc.rect(margin, yPos - 4, 1.5, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...NAVY);
      doc.text(text, margin + 4, yPos);
      drawRule(yPos + 2, 0.2, LIGHTGREY);
      return yPos + 6;
    };

    // ── Helper: footer ──
    const drawFooter = (pageNum, totalPages) => {
      drawRule(pageH - 14, 0.4, MIDGREY);
      doc.setFontSize(7.5);
      doc.setTextColor(...MIDGREY);
      doc.setFont("helvetica", "normal");
      doc.text("MEC'S ENGINEERING SDN. BHD.  |  SPRS Site Progress Reporting System  |  CONFIDENTIAL", margin, pageH - 9);
      doc.text(`Page ${pageNum} / ${totalPages}`, pageW - margin, pageH - 9, { align: "right" });
    };

    // ════════════════════════════════════════════════════════════════
    // PAGE 1 — COVER HEADER
    // ════════════════════════════════════════════════════════════════

    // Solid navy header band
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 42, "F");

    // Thin white rule inside header
    doc.setDrawColor(...WHITE);
    doc.setLineWidth(0.2);
    doc.line(margin, 30, pageW - margin, 30);

    // Company name (top-left)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...WHITE);
    doc.text("MEC'S ENGINEERING SDN. BHD.", margin, 13);

    // Document type (large)
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PROJECT MASTER REPORT", margin, 25);

    // Export metadata (top-right, small)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(200, 210, 230);  // pale blue-grey on dark
    doc.text(`Exported: ${exportDate}`, pageW - margin, 13, { align: "right" });
    doc.text("Prepared by SPRS", pageW - margin, 20, { align: "right" });

    // Project name sub-band (mid-navy)
    doc.setFillColor(...NAVYMID);
    doc.rect(0, 42, pageW, 14, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...WHITE);
    // Truncate project name if too long
    const projNameTrunc = doc.splitTextToSize(project.name, contentW)[0];
    doc.text(projNameTrunc, margin, 51);

    // ── Project Info Grid ──
    let y = 64;
    doc.setFillColor(...PALEGREY);
    doc.rect(margin, y, contentW, 30, "F");
    doc.setDrawColor(...LIGHTGREY);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentW, 30, "S");

    // Vertical dividers between columns
    const colW3 = contentW / 3;
    doc.setDrawColor(...LIGHTGREY);
    doc.setLineWidth(0.2);
    doc.line(margin + colW3, y + 4, margin + colW3, y + 26);
    doc.line(margin + colW3 * 2, y + 4, margin + colW3 * 2, y + 26);

    const infoItems = [
      ["Location",   project.location  || "N/A"],
      ["Status",     project.status    || "Active"],
      ["Priority",   project.priority  || "Medium"],
      ["Progress",   `${project.progress || 0}%`],
      ["Start Date", project.startDate || "N/A"],
      ["End Date",   project.endDate   || "N/A"],
    ];
    infoItems.forEach(([label, value], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const ix = margin + col * colW3 + 5;
      const iy = y + 9 + row * 13;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MIDGREY);
      doc.text(label.toUpperCase(), ix, iy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...CHARCOAL);
      doc.text(String(value), ix, iy + 5.5);
    });

    // ── Summary Statistics Row ──
    y = 100;
    const statItems = [
      { label: "Total Tasks",    value: projTasks.length },
      { label: "Daily Reports",  value: projReports.length },
      { label: "Approved",       value: projReports.filter(r => r.status === "approved").length },
      { label: "Pending",        value: projReports.filter(r => r.status === "pending").length },
    ];
    const statW = (contentW - (statItems.length - 1) * 3) / statItems.length;
    statItems.forEach(({ label, value }, i) => {
      const sx = margin + i * (statW + 3);
      // Box
      doc.setFillColor(...WHITE);
      doc.setDrawColor(...LIGHTGREY);
      doc.setLineWidth(0.4);
      doc.rect(sx, y, statW, 20, "FD");
      // Top accent line
      doc.setFillColor(...NAVY);
      doc.rect(sx, y, statW, 1.2, "F");
      // Value
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.setTextColor(...NAVY);
      doc.text(String(value), sx + statW / 2, y + 13, { align: "center" });
      // Label
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...MIDGREY);
      doc.text(label.toUpperCase(), sx + statW / 2, y + 18.5, { align: "center" });
    });

    // ════════════════════════════════════════════════════════════════
    // SECTION 1 — TASK ASSIGNMENTS
    // ════════════════════════════════════════════════════════════════
    y = 128;
    y = drawSectionHeading("SECTION 1  —  TASK ASSIGNMENTS & SITE IN-CHARGE", y);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["#", "Task Title", "Site In-Charge", "Site / Area", "Due Date", "Priority", "Status"]],
      body: projTasks.length > 0
        ? projTasks.map((t, i) => [
            i + 1,
            t.title || "—",
            t.assignedTo || "—",
            t.site || "—",
            t.dueDate || "—",
            t.priority ? t.priority.charAt(0).toUpperCase() + t.priority.slice(1) : "Medium",
            taskStatusLabel(t.status),
          ])
        : [["", "No tasks assigned to this project.", "", "", "", "", ""]],
      headStyles: {
        fillColor: NAVY,
        textColor: WHITE,
        fontStyle: "bold",
        fontSize: 7.5,
        cellPadding: 3.5,
      },
      bodyStyles: {
        fontSize: 8,
        cellPadding: 3.5,
        textColor: CHARCOAL,
        lineColor: LIGHTGREY,
        lineWidth: 0.2,
      },
      alternateRowStyles: { fillColor: PALEGREY },
      columnStyles: {
        0: { halign: "center", cellWidth: 7 },
        1: { cellWidth: 45, fontStyle: "bold" },
        2: { cellWidth: 38 },
        3: { cellWidth: 26 },
        4: { cellWidth: 22, halign: "center" },
        5: { cellWidth: 20, halign: "center" },
        6: { cellWidth: 24, halign: "center" },
      },
      didParseCell: (data) => {
        // Status column — text colour only, no cell fill
        if (data.section === "body" && data.column.index === 6 && projTasks[data.row.index]) {
          const s = projTasks[data.row.index]?.status;
          data.cell.styles.textColor = s === "done" ? [30, 100, 50] : s === "inprogress" ? NAVYMID : MIDGREY;
          data.cell.styles.fontStyle = "bold";
        }
        // Priority column — text colour only
        if (data.section === "body" && data.column.index === 5 && projTasks[data.row.index]) {
          const p = (projTasks[data.row.index]?.priority || "medium").toLowerCase();
          data.cell.styles.textColor = p === "high" ? [160, 30, 30] : p === "low" ? [40, 110, 60] : CHARCOAL;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    // ════════════════════════════════════════════════════════════════
    // SECTION 2 — DAILY PROGRESS REPORTS
    // ════════════════════════════════════════════════════════════════
    let finalY = (doc.lastAutoTable?.finalY || y) + 12;

    if (finalY > pageH - 50) {
      doc.addPage();
      finalY = margin + 10;
    }

    finalY = drawSectionHeading("SECTION 2  —  DAILY PROGRESS REPORTS & EVIDENCE", finalY);

    if (projReports.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8.5);
      doc.setTextColor(...MIDGREY);
      doc.text("No daily reports filed for this project.", margin, finalY + 4);
    } else {
      // Summary table
      autoTable(doc, {
        startY: finalY,
        margin: { left: margin, right: margin },
        head: [["#", "Report Title", "Date", "Submitted By", "Weather", "Workforce", "Status"]],
        body: projReports.map((r, i) => [
          i + 1,
          r.title || "—",
          r.date || "—",
          r.submittedBy || "—",
          r.weather || "—",
          r.workforce ? `${r.workforce} pax` : "—",
          statusLabel(r.status),
        ]),
        headStyles: {
          fillColor: NAVY,
          textColor: WHITE,
          fontStyle: "bold",
          fontSize: 7.5,
          cellPadding: 3.5,
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3.5,
          textColor: CHARCOAL,
          lineColor: LIGHTGREY,
          lineWidth: 0.2,
        },
        alternateRowStyles: { fillColor: PALEGREY },
        columnStyles: {
          0: { halign: "center", cellWidth: 7 },
          1: { cellWidth: 45, fontStyle: "bold" },
          2: { cellWidth: 24, halign: "center" },
          3: { cellWidth: 36 },
          4: { cellWidth: 20, halign: "center" },
          5: { cellWidth: 20, halign: "center" },
          6: { cellWidth: 24, halign: "center" },
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 6 && projReports[data.row.index]) {
            const s = projReports[data.row.index]?.status;
            data.cell.styles.textColor = s === "approved" ? [30, 100, 50] : s === "rejected" ? [160, 30, 30] : [120, 90, 0];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      // Detailed per-report blocks
      projReports.forEach((r, idx) => {
        let y2 = (doc.lastAutoTable?.finalY || finalY) + (idx === 0 ? 10 : 5);

        if (y2 > pageH - 55) {
          doc.addPage();
          y2 = margin + 8;
        }

        // ── Report block header (slim navy bar) ──
        doc.setFillColor(...NAVY);
        doc.rect(margin, y2, contentW, 8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...WHITE);
        const rLabel = `Report ${idx + 1}  —  ${r.title || "Untitled"}  |  ${r.submittedBy || "—"}`;
        doc.text(rLabel, margin + 3, y2 + 5.5);

        // Status text (right, same bar)
        const sTxt = statusLabel(r.status).toUpperCase();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(200, 210, 230);
        doc.text(sTxt, pageW - margin - 3, y2 + 5.5, { align: "right" });

        y2 += 10;

        // ── Metadata strip (light grey) ──
        doc.setFillColor(...LIGHTGREY);
        doc.rect(margin, y2, contentW, 7, "F");
        const metaParts = [
          `Date: ${r.date || "—"}`,
          `Weather: ${r.weather || "—"}`,
          `Workforce: ${r.workforce ? r.workforce + " pax" : "—"}`,
          r.equipment ? `Equip: ${r.equipment}` : null,
          r.materials ? `Materials: ${r.materials}` : null,
        ].filter(Boolean);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...MIDGREY);
        const metaStr = metaParts.join("   ·   ");
        const metaTrunc = doc.splitTextToSize(metaStr, contentW - 6)[0];
        doc.text(metaTrunc, margin + 3, y2 + 4.5);
        y2 += 9;

        // ── Progress Description ──
        if (r.description) {
          const lines = doc.splitTextToSize(r.description, contentW - 8);
          const blockH = Math.min(lines.length * 4.5 + 10, 44);
          doc.setFillColor(...WHITE);
          doc.setDrawColor(...LIGHTGREY);
          doc.setLineWidth(0.2);
          doc.rect(margin, y2, contentW, blockH, "FD");
          // Left accent bar
          doc.setFillColor(...NAVYMID);
          doc.rect(margin, y2, 1.2, blockH, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(...MIDGREY);
          doc.text("PROGRESS DESCRIPTION", margin + 4, y2 + 4.5);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...CHARCOAL);
          doc.text(lines.slice(0, 8), margin + 4, y2 + 9);
          y2 += blockH + 3;
          if (y2 > pageH - 40) { doc.addPage(); y2 = margin + 8; }
        }

        // ── Issues ──
        if (r.issues) {
          const issueLines = doc.splitTextToSize(r.issues, contentW - 8);
          const issueH = Math.min(issueLines.length * 4.5 + 10, 30);
          doc.setFillColor(...PALEGREY);
          doc.setDrawColor(...LIGHTGREY);
          doc.setLineWidth(0.2);
          doc.rect(margin, y2, contentW, issueH, "FD");
          // Darker left accent
          doc.setFillColor(...MIDGREY);
          doc.rect(margin, y2, 1.2, issueH, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(...MIDGREY);
          doc.text("ISSUES / PROBLEMS", margin + 4, y2 + 4.5);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...CHARCOAL);
          doc.text(issueLines.slice(0, 5), margin + 4, y2 + 9);
          y2 += issueH + 3;
          if (y2 > pageH - 40) { doc.addPage(); y2 = margin + 8; }
        }

        // ── Consultant Feedback ──
        if (r.reviewComment) {
          const fbLines = doc.splitTextToSize(r.reviewComment, contentW - 10);
          const fbH = Math.min(fbLines.length * 4.5 + 10, 28);
          doc.setFillColor(...WHITE);
          doc.setDrawColor(...LIGHTGREY);
          doc.setLineWidth(0.2);
          doc.rect(margin, y2, contentW, fbH, "FD");
          doc.setFillColor(...NAVYMID);
          doc.rect(margin, y2, 1.2, fbH, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7);
          doc.setTextColor(...MIDGREY);
          const reviewer = r.reviewedBy ? `  (${r.reviewedBy})` : "";
          doc.text(`CONSULTANT REVIEW${reviewer}`, margin + 4, y2 + 4.5);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...CHARCOAL);
          doc.text(fbLines.slice(0, 4), margin + 4, y2 + 9);
          y2 += fbH + 3;
          if (y2 > pageH - 30) { doc.addPage(); y2 = margin + 8; }
        }

        // ── Photo note ──
        if (r.photoUrls?.length > 0) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7.5);
          doc.setTextColor(...MIDGREY);
          doc.text(
            `[${r.photoUrls.length} photo attachment${r.photoUrls.length > 1 ? "s" : ""} — view in SPRS system]`,
            margin + 3, y2 + 4
          );
          y2 += 8;
        }

        // Separator
        drawRule(y2 + 2, 0.25, LIGHTGREY);

        if (!doc.lastAutoTable) doc.lastAutoTable = {};
        doc.lastAutoTable.finalY = y2 + 5;
      });
    }

    // ── Apply footers to all pages ──────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(i, totalPages);
    }

    // ── Save ──
    const safeName = project.name.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
    doc.save(`SPRS_ProjectMaster_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 auto', flexWrap: 'wrap' }}>
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
                  style={{ flex: '1 1 140px', maxWidth: 180, padding: '7px 12px', fontSize: '0.83rem' }}
                  value={filterProject}
                  onChange={e => setFilterProject(e.target.value)}
                >
                  <option value="">All Projects</option>
                  {visibleProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                {/* Month select */}
                <select
                  className="visily-input"
                  style={{ flex: '1 1 120px', maxWidth: 150, padding: '7px 12px', fontSize: '0.83rem' }}
                  value={filterMonth}
                  onChange={e => setFilterMonth(e.target.value)}
                >
                  <option value="all">All Months</option>
                  <option value="1">January</option>
                  <option value="2">February</option>
                  <option value="3">March</option>
                  <option value="4">April</option>
                  <option value="5">May</option>
                  <option value="6">June</option>
                  <option value="7">July</option>
                  <option value="8">August</option>
                  <option value="9">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>

                {/* Location select */}
                <select
                  className="visily-input"
                  style={{ flex: '1 1 120px', maxWidth: 150, padding: '7px 12px', fontSize: '0.83rem' }}
                  value={filterLocation}
                  onChange={e => setFilterLocation(e.target.value)}
                >
                  <option value="">All Locations</option>
                  {[...new Set(projects.map(p => p.location).filter(Boolean))].map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>

                {/* Priority select */}
                <select
                  className="visily-input"
                  style={{ flex: '1 1 120px', maxWidth: 150, padding: '7px 12px', fontSize: '0.83rem' }}
                  value={filterPriority}
                  onChange={e => setFilterPriority(e.target.value)}
                >
                  <option value="all">All Priorities</option>
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>

                {/* Search input */}
                <input
                  className="visily-input"
                  style={{ flex: '1 1 160px', maxWidth: 220, padding: '7px 12px', fontSize: '0.83rem' }}
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
                             <button 
                               className="btn btn-outline-secondary" 
                               style={{ fontSize: '0.85rem', padding: '8px 16px', fontWeight: 600, color: 'var(--text-primary)' }} 
                               onClick={() => {
                                 setCommentAction("reject");
                                 setCommentTarget(activeReport);
                                 setCommentText(inlineComment);
                                 setShowCommentModal(true);
                               }}
                             >
                                <XCircle size={14} className="me-1"/> Reject
                             </button>
                             <button 
                               className="visily-coral-btn" 
                               style={{ fontSize: '0.85rem', padding: '8px 16px' }} 
                               onClick={() => {
                                 setCommentAction("approve");
                                 setCommentTarget(activeReport);
                                 setCommentText(inlineComment);
                                 setShowCommentModal(true);
                               }}
                             >
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
                             <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', padding: '12px', background: 'var(--bg-surface)', borderLeft: `3px solid ${activeReport.status === 'approved' ? 'var(--success)' : 'var(--danger)'}`, borderRadius: 4, marginBottom: 12 }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Consultant Comment</div>
                                {activeReport.reviewComment}
                             </div>
                          )}
                          {/* Resubmit button for rejected reports — Supervisor only */}
                          {canSubmit && activeReport.status === 'rejected' && (
                             <button
                               className="visily-coral-btn mt-2"
                               style={{ fontSize: '0.85rem', padding: '8px 20px' }}
                               onClick={() => {
                                 setForm({
                                   title: activeReport.title || '',
                                   projectId: activeReport.projectId || '',
                                   projectName: activeReport.projectName || '',
                                   taskId: activeReport.taskId || '',
                                   taskName: activeReport.taskName || '',
                                   date: '',
                                   weather: activeReport.weather || '',
                                   description: '',
                                   workforce: activeReport.workforce || '',
                                   materials: activeReport.materials || '',
                                   equipment: activeReport.equipment || '',
                                   gpsLat: activeReport.gpsLat || '',
                                   gpsLng: activeReport.gpsLng || '',
                                   issues: '',
                                 });
                                 const parseCommaString = (str) => {
                                   if (!str) return [];
                                   return str.split(",").map(s => s.trim()).filter(Boolean);
                                 };
                                 const eqList = parseCommaString(activeReport.equipment);
                                 const predefinedEq = eqList.filter(e => equipmentOptions.includes(e));
                                 const customEq = eqList.filter(e => !predefinedEq.includes(e)).join(", ");
                                 setSelectedEquipment(predefinedEq.length > 0 || customEq ? [...predefinedEq, ...(customEq ? ["Other"] : [])] : []);
                                 setCustomEquipment(customEq);

                                 const matList = parseCommaString(activeReport.materials);
                                 const predefinedMat = matList.filter(m => materialsOptions.includes(m));
                                 const customMat = matList.filter(m => !predefinedMat.includes(m)).join(", ");
                                 setSelectedMaterials(predefinedMat.length > 0 || customMat ? [...predefinedMat, ...(customMat ? ["Other"] : [])] : []);
                                 setCustomMaterials(customMat);
                                 setShowModal(true);
                               }}
                             >
                               <Plus size={14} style={{ marginRight: 6 }} /> Resubmit Report
                             </button>
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
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12}}>
                     <select 
                       className="visily-input" 
                       required 
                       value={form.projectId} 
                       onChange={(e) => {
                         const selProj = projects.find(p => p.id === e.target.value);
                         setForm({ ...form, projectId: e.target.value, projectName: selProj?.name || "", taskId: "", taskName: "" });
                       }} 
                       style={{color: form.projectId ? 'inherit' : '#999'}}>
                      <option value="" disabled hidden>Select project...</option>
                      {visibleProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select 
                      className="visily-input" 
                      required 
                      value={form.taskId} 
                      onChange={(e) => {
                        const selTask = visibleTasks.find(t => t.id === e.target.value);
                        setForm({ ...form, taskId: e.target.value, taskName: selTask?.title || "" });
                      }} 
                      disabled={!form.projectId}
                      style={{color: form.taskId ? 'inherit' : '#999'}}
                    >
                      <option value="" disabled hidden>{form.projectId ? "Select task..." : "First select project"}</option>
                      {visibleTasks.filter(t => t.projectId === form.projectId).map((t) => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                    <input type="text" onFocus={e => e.target.type='date'} onBlur={e => {if(!e.target.value) e.target.type='text'}} className="visily-input" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} placeholder="Date" />
                  </div>

                  <input className="visily-input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" />

                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
                    <input className="visily-input" value={form.workforce} onChange={(e) => setForm({ ...form, workforce: e.target.value })} placeholder="Workforce (pax)" />
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

                  {/* Equipment Selection */}
                  <div>
                    <label style={{fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 6, display: 'block', fontWeight: 600}}>Equipment Used</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {equipmentOptions.map(eq => {
                        const isSelected = selectedEquipment.includes(eq);
                        return (
                          <button
                            key={eq}
                            type="button"
                            onClick={() => {
                              if (selectedEquipment.includes(eq)) {
                                setSelectedEquipment(selectedEquipment.filter(e => e !== eq));
                              } else {
                                setSelectedEquipment([...selectedEquipment, eq]);
                              }
                            }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 20,
                              border: `1px solid ${isSelected ? '#F56A6A' : 'var(--border)'}`,
                              background: isSelected ? 'rgba(245, 106, 106, 0.15)' : 'var(--bg-surface)',
                              color: isSelected ? '#F56A6A' : 'var(--text-primary)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            {eq}
                          </button>
                        );
                      })}
                    </div>
                    {selectedEquipment.includes("Other") && (
                      <input
                        className="visily-input"
                        value={customEquipment}
                        onChange={e => setCustomEquipment(e.target.value)}
                        placeholder="Specify other equipment (comma separated)..."
                      />
                    )}
                  </div>

                  {/* Materials Selection */}
                  <div>
                    <label style={{fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 6, display: 'block', fontWeight: 600}}>Materials Used</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {materialsOptions.map(mat => {
                        const isSelected = selectedMaterials.includes(mat);
                        return (
                          <button
                            key={mat}
                            type="button"
                            onClick={() => {
                              if (selectedMaterials.includes(mat)) {
                                setSelectedMaterials(selectedMaterials.filter(m => m !== mat));
                              } else {
                                setSelectedMaterials([...selectedMaterials, mat]);
                              }
                            }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 20,
                              border: `1px solid ${isSelected ? '#F56A6A' : 'var(--border)'}`,
                              background: isSelected ? 'rgba(245, 106, 106, 0.15)' : 'var(--bg-surface)',
                              color: isSelected ? '#F56A6A' : 'var(--text-primary)',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            {mat}
                          </button>
                        );
                      })}
                    </div>
                    {selectedMaterials.includes("Other") && (
                      <input
                        className="visily-input"
                        value={customMaterials}
                        onChange={e => setCustomMaterials(e.target.value)}
                        placeholder="Specify other materials (comma separated)..."
                      />
                    )}
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
                          if (!navigator.geolocation && !window.fetch) { toast.error("Location not supported"); return; }
                          setLocationFetching(true);
                          toast.loading("Detecting location...", { id: "loc" });

                          const handleLocationSuccess = async (lat, lng) => {
                            setForm(f => ({ ...f, gpsLat: lat, gpsLng: lng }));
                            try {
                              const OWM_KEY = process.env.REACT_APP_OWM_KEY || "bd5e378503939ddaee76f12ad7a97608";
                              const weatherRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OWM_KEY}&units=metric`);
                              if (weatherRes.ok) {
                                const wd = await weatherRes.json();
                                const main = wd.weather[0].main;
                                const desc = wd.weather[0].description;
                                const temp = Math.round(wd.main.temp);
                                const humidity = wd.main.humidity;
                                const icon = wd.weather[0].icon;
                                const weatherLabel = main === 'Clear' ? 'Sunny' : main === 'Rain' || main === 'Drizzle' ? 'Rainy' : main === 'Thunderstorm' ? 'Stormy' : (main === 'Clouds' && desc.includes('few')) ? 'Partly Cloudy' : main === 'Clouds' ? 'Cloudy' : 'Partly Cloudy';
                                setForm(f => ({ ...f, weather: weatherLabel }));
                                setWeatherInfo({ desc, temp, humidity, icon });
                              }
                              const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
                              if (geoRes.ok) {
                                const gd = await geoRes.json();
                                const city = gd.address?.city || gd.address?.town || gd.address?.village || gd.address?.county || '';
                                const state = gd.address?.state || '';
                                if (city || state) toast.success(`📍 ${city}${city && state ? ', ' : ''}${state} — auto-detected`, { id: "loc" });
                                else toast.success("Location acquired", { id: "loc" });
                              } else {
                                toast.success("Location acquired", { id: "loc" });
                              }
                            } catch (err) {
                              toast.success("Location acquired", { id: "loc" });
                            }
                            setLocationFetching(false);
                          };

                          if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition(
                              (pos) => handleLocationSuccess(pos.coords.latitude.toFixed(6), pos.coords.longitude.toFixed(6)),
                              async () => {
                                // FALLBACK: IP-based location (works on HTTP/IP)
                                try {
                                  const ipRes = await fetch("https://ipapi.co/json/");
                                  if (ipRes.ok) {
                                    const ipData = await ipRes.json();
                                    if (ipData.latitude && ipData.longitude) {
                                      handleLocationSuccess(ipData.latitude.toFixed(6), ipData.longitude.toFixed(6));
                                      return;
                                    }
                                  }
                                } catch (e) { console.error("IP fallback failed", e); }
                                toast.error("Location access failed. Browsers require HTTPS or 'localhost'.", { id: "loc" });
                                setLocationFetching(false);
                              }
                            );
                          } else {
                            // Direct IP fallback
                            try {
                              const ipRes = await fetch("https://ipapi.co/json/");
                              const ipData = await ipRes.json();
                              handleLocationSuccess(ipData.latitude.toFixed(6), ipData.longitude.toFixed(6));
                            } catch (e) {
                              toast.error("Location detection failed.");
                              setLocationFetching(false);
                            }
                          }
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
          <div className="sp-modal" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-title d-flex justify-content-between align-items-center mb-0">
              <span style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Download size={20} color="var(--accent)" /> Export Project Master Report
              </span>
              <button className="btn btn-ghost btn-sm p-1" onClick={() => setShowExportModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p className="small text-muted mt-2 mb-4">Select a project to generate a professional PDF report with task roadmap and all daily reports.</p>

            <div className="db-project-list" style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {projects.length === 0 ? <p className="text-muted small text-center">No active projects to export.</p> : null}
              {projects.map((p) => {
                const projTasks = tasks.filter(t => t.projectId === p.id);
                const projReports = reports.filter(r => r.projectId === p.id);
                return (
                  <div
                    key={p.id}
                    className="card p-3 mb-2"
                    style={{
                      cursor: 'pointer',
                      border: expandedExportProject === p.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                      transition: 'border-color 0.15s',
                    }}
                    onClick={() => setExpandedExportProject(expandedExportProject === p.id ? null : p.id)}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold" style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{p.name}</div>
                        <div className="small text-muted" style={{ marginTop: 2 }}>
                          {p.location || 'No Location'} &nbsp;·&nbsp; {p.progress || 0}% Progress &nbsp;·&nbsp;
                          <span style={{ color: 'var(--accent)' }}>{projTasks.length} task{projTasks.length !== 1 ? 's' : ''}</span>
                          &nbsp;·&nbsp;
                          <span style={{ color: 'var(--text-secondary)' }}>{projReports.length} report{projReports.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <button
                        className="visily-coral-btn"
                        style={{ padding: '7px 16px', fontSize: '0.83rem', gap: 6, display: 'flex', alignItems: 'center' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportProjectPDF(p);
                        }}
                      >
                        <Download size={14} /> Export PDF
                      </button>
                    </div>

                    {expandedExportProject === p.id && (
                      <div
                        className="mt-3 pt-3"
                        style={{ borderTop: '1px dashed var(--border)', cursor: 'default' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>Status:</strong> {p.status || 'Active'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>Priority:</strong> {p.priority || 'Medium'}
                          </div>
                          {p.startDate && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>Start:</strong> {p.startDate}
                          </div>}
                          {p.endDate && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>End:</strong> {p.endDate}
                          </div>}
                        </div>
                        <h6 className="mb-2" style={{ color: 'var(--text-primary)', fontSize: '0.82rem', fontWeight: 700 }}>Task Preview:</h6>
                        {projTasks.length === 0 ? (
                          <p className="small text-muted mb-0">No tasks assigned to this project.</p>
                        ) : (
                          <div className="table-responsive">
                            <table className="table table-sm" style={{ fontSize: '0.75rem' }}>
                              <thead>
                                <tr>
                                  <th>Task Title</th>
                                  <th>Assigned To</th>
                                  <th>Due Date</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {projTasks.slice(0, 5).map(t => (
                                  <tr key={t.id}>
                                    <td>{t.title}</td>
                                    <td>{t.assignedTo || '—'}</td>
                                    <td>{t.dueDate || '—'}</td>
                                    <td style={{
                                      color: t.status === 'done' ? 'var(--success)' : t.status === 'inprogress' ? 'var(--info)' : 'var(--text-secondary)',
                                      fontWeight: 600, textTransform: 'capitalize'
                                    }}>
                                      {t.status === 'inprogress' ? 'In Progress' : t.status === 'todo' ? 'To Do' : 'Done'}
                                    </td>
                                  </tr>
                                ))}
                                {projTasks.length > 5 && (
                                  <tr>
                                    <td colSpan="4" style={{ color: 'var(--text-muted)', fontSize: '0.73rem', fontStyle: 'italic' }}>
                                      +{projTasks.length - 5} more tasks in the PDF export
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* handleExportProjectPDF — jsPDF professional generator (called from modal) */}
      {false && (
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
