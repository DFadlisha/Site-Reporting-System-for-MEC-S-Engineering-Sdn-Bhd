// src/components/admin/AuditPage.js
import React, { useEffect, useState, useMemo } from "react";
import {
  BarChart2, AlertOctagon, Clock, FileText, TrendingDown,
  CheckCircle, Loader2, Download, RefreshCw, AlertTriangle, XCircle,
  FileSpreadsheet,
} from "lucide-react";
import Topbar from "../shared/Topbar";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { differenceInDays, format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import * as XLSX from "xlsx";
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

// ── Professional Excel Export ─────────────────────────────────
function exportProfessionalExcel({
  delayedProjects,
  submissionStats,
  approvalStats,
  issuesByProject,
  summaryStats,
  exportDate,
}) {
  const wb = XLSX.utils.book_new();

  // ── Colour/style helpers ──────────────────────────────────
  const CORP_BLUE   = "1F4E79";
  const CORP_ACCENT = "FE6F6F";
  const HEADER_BG   = "2D6A9F";
  const ALT_ROW     = "EEF4FB";
  const WHITE       = "FFFFFF";
  const RED_BG      = "FFE8E8";
  const GREEN_BG    = "E8F8EE";
  const YELLOW_BG   = "FFF8E1";
  const GREY_TEXT   = "6B7280";

  function hStyle(bg = HEADER_BG, bold = true, sz = 11, color = WHITE, border = true) {
    return {
      font:      { bold, sz, color: { rgb: color }, name: "Calibri" },
      fill:      { fgColor: { rgb: bg } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: border ? {
        top:    { style: "thin", color: { rgb: "BFBFBF" } },
        bottom: { style: "thin", color: { rgb: "BFBFBF" } },
        left:   { style: "thin", color: { rgb: "BFBFBF" } },
        right:  { style: "thin", color: { rgb: "BFBFBF" } },
      } : {},
    };
  }

  function cellStyle(bg = WHITE, bold = false, sz = 10, color = "1F2937", align = "left") {
    return {
      font:      { bold, sz, color: { rgb: color }, name: "Calibri" },
      fill:      { fgColor: { rgb: bg } },
      alignment: { horizontal: align, vertical: "center", wrapText: true },
      border: {
        top:    { style: "hair", color: { rgb: "E5E7EB" } },
        bottom: { style: "hair", color: { rgb: "E5E7EB" } },
        left:   { style: "hair", color: { rgb: "E5E7EB" } },
        right:  { style: "hair", color: { rgb: "E5E7EB" } },
      },
    };
  }

  function applyStyles(ws, data, startRow, altBg = ALT_ROW) {
    data.forEach((row, rIdx) => {
      const isAlt = rIdx % 2 === 1;
      row.forEach((cell, cIdx) => {
        const addr = XLSX.utils.encode_cell({ r: startRow + rIdx, c: cIdx });
        if (!ws[addr]) ws[addr] = { v: cell ?? "", t: typeof cell === "number" ? "n" : "s" };
        ws[addr].s = cellStyle(isAlt ? altBg : WHITE, false, 10, "1F2937", typeof cell === "number" ? "center" : "left");
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SHEET 1 – COVER / SUMMARY
  // ═══════════════════════════════════════════════════════════
  const coverData = [];
  const ws1 = XLSX.utils.aoa_to_sheet(coverData);
  ws1["!cols"] = [{ wch: 4 }, { wch: 32 }, { wch: 20 }, { wch: 4 }];

  const setCell = (ws, addr, value, style) => {
    ws[addr] = { v: value, t: typeof value === "number" ? "n" : "s", s: style };
  };

  // Title block
  setCell(ws1, "B2", "MEC-S ENGINEERING SDN BHD", {
    font: { bold: true, sz: 18, color: { rgb: WHITE }, name: "Calibri" },
    fill: { fgColor: { rgb: CORP_BLUE } },
    alignment: { horizontal: "left", vertical: "center" },
  });
  setCell(ws1, "B3", "Site Progress Reporting System", {
    font: { bold: false, sz: 12, color: { rgb: "D0E4F7" }, name: "Calibri" },
    fill: { fgColor: { rgb: CORP_BLUE } },
    alignment: { horizontal: "left", vertical: "center" },
  });
  setCell(ws1, "B4", "PROJECT PROGRESS AUDIT REPORT", {
    font: { bold: true, sz: 14, color: { rgb: WHITE }, name: "Calibri" },
    fill: { fgColor: { rgb: CORP_ACCENT } },
    alignment: { horizontal: "left", vertical: "center" },
  });
  setCell(ws1, "C2", `Generated: ${exportDate}`, {
    font: { bold: false, sz: 10, color: { rgb: "D0E4F7" }, name: "Calibri" },
    fill: { fgColor: { rgb: CORP_BLUE } },
    alignment: { horizontal: "right", vertical: "center" },
  });
  setCell(ws1, "C4", `Date: ${exportDate}`, {
    font: { bold: true, sz: 10, color: { rgb: WHITE }, name: "Calibri" },
    fill: { fgColor: { rgb: CORP_ACCENT } },
    alignment: { horizontal: "right", vertical: "center" },
  });

  // Merges for header
  ws1["!merges"] = [
    { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },  // B2:C2
    { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },  // B3:C3
    // B4:C4 kept separate for date
  ];

  // Spacer
  const summRow = 6; // 0-indexed row 6 = row 7 on sheet

  // Summary section title
  setCell(ws1, `B${summRow}`, "EXECUTIVE SUMMARY", {
    font: { bold: true, sz: 13, color: { rgb: CORP_BLUE }, name: "Calibri" },
    fill: { fgColor: { rgb: "EEF4FB" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: { bottom: { style: "medium", color: { rgb: CORP_BLUE } } },
  });

  const kpiRows = [
    ["Delayed Projects",       summaryStats.delayed,    RED_BG,    "EF4444"],
    ["Pending Reports",        summaryStats.pending,    YELLOW_BG, "F59E0B"],
    ["Open Issues",            summaryStats.openIssues, RED_BG,    "F97316"],
    ["Avg Approval Time (d)",  summaryStats.avgApproval ?? "N/A", "EEF4FB", CORP_BLUE],
    ["Total Projects",         summaryStats.totalProjects, GREEN_BG, "10B981"],
    ["Total Reports",          summaryStats.totalReports,  GREEN_BG, "10B981"],
  ];

  kpiRows.forEach(([label, value, bg, color], i) => {
    const r = summRow + 2 + i; // 1-indexed row
    setCell(ws1, `B${r}`, label, {
      font: { bold: false, sz: 10, color: { rgb: "374151" }, name: "Calibri" },
      fill: { fgColor: { rgb: bg } },
      alignment: { horizontal: "left", vertical: "center" },
      border: {
        top:    { style: "hair", color: { rgb: "E5E7EB" } },
        bottom: { style: "hair", color: { rgb: "E5E7EB" } },
        left:   { style: "medium", color: { rgb: color } },
        right:  { style: "hair", color: { rgb: "E5E7EB" } },
      },
    });
    setCell(ws1, `C${r}`, typeof value === "number" ? value : String(value), {
      font: { bold: true, sz: 11, color: { rgb: color }, name: "Calibri" },
      fill: { fgColor: { rgb: bg } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top:    { style: "hair", color: { rgb: "E5E7EB" } },
        bottom: { style: "hair", color: { rgb: "E5E7EB" } },
        left:   { style: "hair", color: { rgb: "E5E7EB" } },
        right:  { style: "hair", color: { rgb: "E5E7EB" } },
      },
    });
  });

  // Sections index
  const idxRow = summRow + 2 + kpiRows.length + 2;
  setCell(ws1, `B${idxRow}`, "REPORT CONTENTS", {
    font: { bold: true, sz: 11, color: { rgb: WHITE }, name: "Calibri" },
    fill: { fgColor: { rgb: HEADER_BG } },
    alignment: { horizontal: "left", vertical: "center" },
  });
  setCell(ws1, `C${idxRow}`, "Sheet", {
    font: { bold: true, sz: 11, color: { rgb: WHITE }, name: "Calibri" },
    fill: { fgColor: { rgb: HEADER_BG } },
    alignment: { horizontal: "center", vertical: "center" },
  });
  const contents = [
    ["1. Delayed Projects",              "Delayed Projects"],
    ["2. Report Submission by Supervisor","Report Submissions"],
    ["3. Consultant Approval Turnaround", "Approval Turnaround"],
    ["4. Issues by Project",              "Issues by Project"],
  ];
  contents.forEach(([desc, sheet], i) => {
    const r = idxRow + 1 + i;
    setCell(ws1, `B${r}`, desc, cellStyle(i % 2 === 0 ? WHITE : ALT_ROW, false, 10));
    setCell(ws1, `C${r}`, sheet, cellStyle(i % 2 === 0 ? WHITE : ALT_ROW, false, 10, "1F2937", "center"));
  });

  // Footer
  const footerRow = idxRow + 1 + contents.length + 2;
  setCell(ws1, `B${footerRow}`, "This report is generated automatically by the Site Progress Reporting System.", {
    font: { bold: false, sz: 9, color: { rgb: GREY_TEXT }, name: "Calibri" },
    fill: { fgColor: { rgb: WHITE } },
    alignment: { horizontal: "left", vertical: "center" },
  });
  setCell(ws1, `C${footerRow}`, "CONFIDENTIAL", {
    font: { bold: true, sz: 9, color: { rgb: CORP_ACCENT }, name: "Calibri" },
    fill: { fgColor: { rgb: WHITE } },
    alignment: { horizontal: "center", vertical: "center" },
  });

  ws1["!ref"] = `A1:D${footerRow + 2}`;
  XLSX.utils.book_append_sheet(wb, ws1, "Cover");

  // ═══════════════════════════════════════════════════════════
  // SHEET 2 – DELAYED PROJECTS
  // ═══════════════════════════════════════════════════════════
  const ws2 = XLSX.utils.aoa_to_sheet([]);
  ws2["!cols"] = [{ wch: 30 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 18 }];

  // Sheet title row
  setCell(ws2, "A1", "DELAYED PROJECTS", hStyle(CORP_BLUE, true, 13, WHITE, false));
  setCell(ws2, "B1", "", hStyle(CORP_BLUE, false, 13, WHITE, false));
  setCell(ws2, "C1", "", hStyle(CORP_BLUE, false, 13, WHITE, false));
  setCell(ws2, "D1", "", hStyle(CORP_BLUE, false, 13, WHITE, false));
  setCell(ws2, "E1", `Exported: ${exportDate}`, {
    ...hStyle(CORP_BLUE, false, 10, "D0E4F7", false),
    alignment: { horizontal: "right", vertical: "center" },
  });
  setCell(ws2, "F1", "", hStyle(CORP_BLUE, false, 13, WHITE, false));

  // Headers
  const dp_headers = ["Project Name", "Location", "Expected End Date", "Progress (%)", "Days Overdue", "Severity"];
  dp_headers.forEach((h, i) => {
    const addr = XLSX.utils.encode_cell({ r: 2, c: i });
    ws2[addr] = { v: h, t: "s", s: hStyle(HEADER_BG, true, 10) };
  });

  const dpRows = delayedProjects.map(p => [
    p.name,
    p.location || "—",
    p.endDate,
    p.progress ?? 0,
    p.daysOverdue,
    p.daysOverdue > 30 ? "High" : p.daysOverdue > 7 ? "Medium" : "Low",
  ]);
  dpRows.forEach((row, rIdx) => {
    const isAlt = rIdx % 2 === 1;
    row.forEach((cell, cIdx) => {
      const addr = XLSX.utils.encode_cell({ r: 3 + rIdx, c: cIdx });
      const severity = row[5];
      let bg = isAlt ? ALT_ROW : WHITE;
      let color = "1F2937";
      if (cIdx === 5) {
        bg = severity === "High" ? RED_BG : severity === "Medium" ? YELLOW_BG : "E8F8EE";
        color = severity === "High" ? "EF4444" : severity === "Medium" ? "D97706" : "059669";
      }
      ws2[addr] = { v: cell ?? "", t: typeof cell === "number" ? "n" : "s", s: cellStyle(bg, cIdx === 5, 10, color, cIdx >= 3 ? "center" : "left") };
    });
  });

  if (!dpRows.length) {
    setCell(ws2, "A4", "✓ No delayed projects at this time.", cellStyle(GREEN_BG, false, 10, "059669"));
  }

  ws2["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
  ];
  ws2["!ref"] = `A1:F${Math.max(4, 3 + dpRows.length) + 1}`;
  XLSX.utils.book_append_sheet(wb, ws2, "Delayed Projects");

  // ═══════════════════════════════════════════════════════════
  // SHEET 3 – REPORT SUBMISSIONS
  // ═══════════════════════════════════════════════════════════
  const ws3 = XLSX.utils.aoa_to_sheet([]);
  ws3["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 18 }];

  setCell(ws3, "A1", "REPORT SUBMISSION BY SUPERVISOR", hStyle(CORP_BLUE, true, 13, WHITE, false));
  setCell(ws3, "B1", "", hStyle(CORP_BLUE, false, 13, WHITE, false));
  setCell(ws3, "C1", "", hStyle(CORP_BLUE, false, 13, WHITE, false));
  setCell(ws3, "D1", `Exported: ${exportDate}`, {
    ...hStyle(CORP_BLUE, false, 10, "D0E4F7", false),
    alignment: { horizontal: "right", vertical: "center" },
  });
  setCell(ws3, "E1", "", hStyle(CORP_BLUE, false, 13, WHITE, false));

  const rs_headers = ["Supervisor Name", "Total Reports", "This Month", "Last Submission Date", "Activity Status"];
  rs_headers.forEach((h, i) => {
    const addr = XLSX.utils.encode_cell({ r: 2, c: i });
    ws3[addr] = { v: h, t: "s", s: hStyle(HEADER_BG, true, 10) };
  });

  submissionStats.forEach((s, rIdx) => {
    const isAlt = rIdx % 2 === 1;
    const bg = isAlt ? ALT_ROW : WHITE;
    const activity = s.thisMonth === 0 ? "Inactive" : s.thisMonth >= 3 ? "Active" : "Low";
    const actColor = s.thisMonth === 0 ? "EF4444" : s.thisMonth >= 3 ? "059669" : "D97706";
    const actBg    = s.thisMonth === 0 ? RED_BG   : s.thisMonth >= 3 ? GREEN_BG  : YELLOW_BG;
    const row = [s.name, s.total, s.thisMonth, s.lastDate ? format(s.lastDate, "d MMM yyyy") : "Never", activity];
    row.forEach((cell, cIdx) => {
      const addr = XLSX.utils.encode_cell({ r: 3 + rIdx, c: cIdx });
      const isBadge = cIdx === 4;
      ws3[addr] = { v: cell ?? "", t: typeof cell === "number" ? "n" : "s",
        s: cellStyle(isBadge ? actBg : bg, isBadge, 10, isBadge ? actColor : "1F2937", cIdx >= 1 ? "center" : "left") };
    });
  });

  if (!submissionStats.length) {
    setCell(ws3, "A4", "No reports submitted yet.", cellStyle(YELLOW_BG, false, 10, "D97706"));
  }

  ws3["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  ws3["!ref"] = `A1:E${Math.max(4, 3 + submissionStats.length) + 1}`;
  XLSX.utils.book_append_sheet(wb, ws3, "Report Submissions");

  // ═══════════════════════════════════════════════════════════
  // SHEET 4 – APPROVAL TURNAROUND
  // ═══════════════════════════════════════════════════════════
  const ws4 = XLSX.utils.aoa_to_sheet([]);
  ws4["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 22 }, { wch: 18 }];

  setCell(ws4, "A1", "CONSULTANT APPROVAL TURNAROUND", hStyle(CORP_BLUE, true, 13, WHITE, false));
  setCell(ws4, "B1", "", hStyle(CORP_BLUE, false, 13, WHITE, false));
  setCell(ws4, "C1", `Exported: ${exportDate}`, {
    ...hStyle(CORP_BLUE, false, 10, "D0E4F7", false),
    alignment: { horizontal: "right", vertical: "center" },
  });
  setCell(ws4, "D1", "", hStyle(CORP_BLUE, false, 13, WHITE, false));

  const at_headers = ["Consultant Name", "Reports Reviewed", "Avg Days to Approve", "Performance Rating"];
  at_headers.forEach((h, i) => {
    const addr = XLSX.utils.encode_cell({ r: 2, c: i });
    ws4[addr] = { v: h, t: "s", s: hStyle(HEADER_BG, true, 10) };
  });

  approvalStats.forEach((c, rIdx) => {
    const isAlt = rIdx % 2 === 1;
    const bg = isAlt ? ALT_ROW : WHITE;
    const days = parseFloat(c.avgDays);
    const rating = days <= 1 ? "Excellent" : days <= 3 ? "Good" : days <= 7 ? "Average" : "Slow";
    const ratingColor = days <= 1 ? "059669" : days <= 3 ? "2563EB" : days <= 7 ? "D97706" : "EF4444";
    const ratingBg    = days <= 1 ? GREEN_BG  : days <= 3 ? "EFF6FF"  : days <= 7 ? YELLOW_BG : RED_BG;
    const row = [c.name, c.count, c.avgDays ? `${c.avgDays} days` : "—", rating];
    row.forEach((cell, cIdx) => {
      const addr = XLSX.utils.encode_cell({ r: 3 + rIdx, c: cIdx });
      const isBadge = cIdx === 3;
      ws4[addr] = { v: cell ?? "", t: typeof cell === "number" ? "n" : "s",
        s: cellStyle(isBadge ? ratingBg : bg, isBadge, 10, isBadge ? ratingColor : "1F2937", cIdx >= 1 ? "center" : "left") };
    });
  });

  if (!approvalStats.length) {
    setCell(ws4, "A4", "No approved reports yet.", cellStyle(ALT_ROW, false, 10, GREY_TEXT));
  }

  ws4["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
  ws4["!ref"] = `A1:D${Math.max(4, 3 + approvalStats.length) + 1}`;
  XLSX.utils.book_append_sheet(wb, ws4, "Approval Turnaround");

  // ═══════════════════════════════════════════════════════════
  // SHEET 5 – ISSUES BY PROJECT
  // ═══════════════════════════════════════════════════════════
  const ws5 = XLSX.utils.aoa_to_sheet([]);
  ws5["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }];

  setCell(ws5, "A1", "ISSUES BY PROJECT", hStyle(CORP_BLUE, true, 13, WHITE, false));
  setCell(ws5, "B1", "", hStyle(CORP_BLUE, false, 13, WHITE, false));
  setCell(ws5, "C1", "", hStyle(CORP_BLUE, false, 13, WHITE, false));
  setCell(ws5, "D1", "", hStyle(CORP_BLUE, false, 13, WHITE, false));
  setCell(ws5, "E1", `Exported: ${exportDate}`, {
    ...hStyle(CORP_BLUE, false, 10, "D0E4F7", false),
    alignment: { horizontal: "right", vertical: "center" },
  });
  setCell(ws5, "F1", "", hStyle(CORP_BLUE, false, 13, WHITE, false));

  const ib_headers = ["Project Name", "Total Issues", "Open", "Resolved", "Open Rate (%)", "Health Status"];
  ib_headers.forEach((h, i) => {
    const addr = XLSX.utils.encode_cell({ r: 2, c: i });
    ws5[addr] = { v: h, t: "s", s: hStyle(HEADER_BG, true, 10) };
  });

  issuesByProject.forEach((p, rIdx) => {
    const isAlt = rIdx % 2 === 1;
    const bg = isAlt ? ALT_ROW : WHITE;
    const openRate = p.total > 0 ? Math.round((p.open / p.total) * 100) : 0;
    const health = openRate > 50 ? "Critical" : openRate > 20 ? "At Risk" : "Healthy";
    const healthColor = openRate > 50 ? "EF4444" : openRate > 20 ? "D97706" : "059669";
    const healthBg    = openRate > 50 ? RED_BG  : openRate > 20 ? YELLOW_BG : GREEN_BG;
    const row = [p.name, p.total, p.open, p.resolved, openRate, health];
    row.forEach((cell, cIdx) => {
      const addr = XLSX.utils.encode_cell({ r: 3 + rIdx, c: cIdx });
      const isBadge = cIdx === 5;
      const isOpen  = cIdx === 2 && p.open > 0;
      ws5[addr] = {
        v: cell ?? "", t: typeof cell === "number" ? "n" : "s",
        s: cellStyle(
          isBadge ? healthBg : isOpen ? RED_BG : bg,
          isBadge,
          10,
          isBadge ? healthColor : isOpen ? "EF4444" : "1F2937",
          cIdx >= 1 ? "center" : "left"
        ),
      };
    });
  });

  if (!issuesByProject.length) {
    setCell(ws5, "A4", "✓ No issues recorded.", cellStyle(GREEN_BG, false, 10, "059669"));
  }

  ws5["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  ws5["!ref"] = `A1:F${Math.max(4, 3 + issuesByProject.length) + 1}`;
  XLSX.utils.book_append_sheet(wb, ws5, "Issues by Project");

  // ── Write file ────────────────────────────────────────────
  XLSX.writeFile(wb, `SPRS_Audit_Report_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
}

export default function AuditPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [projects, setProjects] = useState([]);
  const [reports,  setReports]  = useState([]);
  const [issues,   setIssues]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [exporting, setExporting] = useState(false);
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

  function handleExportAll() {
    setExporting(true);
    try {
      exportProfessionalExcel({
        delayedProjects,
        submissionStats,
        approvalStats,
        issuesByProject,
        summaryStats: {
          delayed:       delayedProjects.length,
          pending:       pendingReports,
          openIssues,
          avgApproval:   allAvgApproval,
          totalProjects: projects.length,
          totalReports:  reports.length,
        },
        exportDate: format(now, "d MMMM yyyy, h:mm a"),
      });
    } finally {
      setTimeout(() => setExporting(false), 800);
    }
  }

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
            {/* ── Page Header with Export All ─────────────────── */}
            <div className="audit-page-header">
              <div>
                <h1 className="audit-page-title">Project Progress Audit</h1>
                <p className="audit-page-subtitle">
                  Comprehensive overview · {format(now, "MMMM yyyy")}
                </p>
              </div>
              <button
                className={`audit-export-all-btn ${exporting ? "loading" : ""}`}
                onClick={handleExportAll}
                disabled={exporting}
              >
                {exporting
                  ? <><Loader2 size={16} className="spin" /> Generating…</>
                  : <><FileSpreadsheet size={16} /> Export Full Report</>}
              </button>
            </div>

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
                  title="Export this section as Excel"
                  onClick={() => {
                    const wb = XLSX.utils.book_new();
                    const data = [
                      ["Project", "Location", "Expected End", "Progress (%)", "Days Overdue", "Severity"],
                      ...delayedProjects.map(p => [
                        p.name, p.location, p.endDate, p.progress ?? 0, p.daysOverdue,
                        p.daysOverdue > 30 ? "High" : p.daysOverdue > 7 ? "Medium" : "Low",
                      ]),
                    ];
                    const ws = XLSX.utils.aoa_to_sheet(data);
                    ws["!cols"] = [{ wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
                    XLSX.utils.book_append_sheet(wb, ws, "Delayed Projects");
                    XLSX.writeFile(wb, "delayed_projects.xlsx");
                  }}
                >
                  <Download size={14} /> Export
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
                  title="Export this section as Excel"
                  onClick={() => {
                    const wb = XLSX.utils.book_new();
                    const data = [
                      ["Supervisor", "Total Reports", "This Month", "Last Submission", "Activity Status"],
                      ...submissionStats.map(s => [
                        s.name, s.total, s.thisMonth,
                        s.lastDate ? format(s.lastDate, "d MMM yyyy") : "Never",
                        s.thisMonth === 0 ? "Inactive" : s.thisMonth >= 3 ? "Active" : "Low",
                      ]),
                    ];
                    const ws = XLSX.utils.aoa_to_sheet(data);
                    ws["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 16 }];
                    XLSX.utils.book_append_sheet(wb, ws, "Report Submissions");
                    XLSX.writeFile(wb, "report_submissions.xlsx");
                  }}
                >
                  <Download size={14} /> Export
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
                <button
                  className="audit-export-btn"
                  title="Export this section as Excel"
                  onClick={() => {
                    const wb = XLSX.utils.book_new();
                    const data = [
                      ["Consultant", "Reports Reviewed", "Avg Days to Approve", "Performance Rating"],
                      ...approvalStats.map(c => {
                        const days = parseFloat(c.avgDays);
                        return [
                          c.name, c.count,
                          c.avgDays ? `${c.avgDays} days` : "—",
                          days <= 1 ? "Excellent" : days <= 3 ? "Good" : days <= 7 ? "Average" : "Slow",
                        ];
                      }),
                    ];
                    const ws = XLSX.utils.aoa_to_sheet(data);
                    ws["!cols"] = [{ wch: 28 }, { wch: 16 }, { wch: 20 }, { wch: 18 }];
                    XLSX.utils.book_append_sheet(wb, ws, "Approval Turnaround");
                    XLSX.writeFile(wb, "approval_turnaround.xlsx");
                  }}
                >
                  <Download size={14} /> Export
                </button>
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
                  title="Export this section as Excel"
                  onClick={() => {
                    const wb = XLSX.utils.book_new();
                    const data = [
                      ["Project", "Total Issues", "Open", "Resolved", "Open Rate (%)", "Health Status"],
                      ...issuesByProject.map(p => {
                        const openRate = p.total > 0 ? Math.round((p.open / p.total) * 100) : 0;
                        return [
                          p.name, p.total, p.open, p.resolved, openRate,
                          openRate > 50 ? "Critical" : openRate > 20 ? "At Risk" : "Healthy",
                        ];
                      }),
                    ];
                    const ws = XLSX.utils.aoa_to_sheet(data);
                    ws["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }];
                    XLSX.utils.book_append_sheet(wb, ws, "Issues by Project");
                    XLSX.writeFile(wb, "issues_by_project.xlsx");
                  }}
                >
                  <Download size={14} /> Export
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
