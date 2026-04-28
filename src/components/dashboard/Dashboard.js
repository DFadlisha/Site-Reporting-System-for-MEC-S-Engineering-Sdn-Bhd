// src/components/dashboard/Dashboard.js
import React, { useEffect, useState } from "react";
import {
  FolderOpen, CheckSquare, FileText,
  AlertTriangle, TrendingUp, CheckCircle, Bell, Database, X, Download,
  ClipboardList, ArrowRight, Eye, PlusCircle, MessageSquare, XCircle, Clock
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Topbar from "../shared/Topbar";
import AdminDashboard from "./AdminDashboard";
import { subscribeProjects, subscribeTasks, subscribeReports, subscribeIssues, seedDummyData, requestPushPermission, subscribeNotifications } from "../../firebase/services";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import toast from "react-hot-toast";
import "./Dashboard.css";

// Chart.js imports (To fulfill thesis stack requirement)
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, ArcElement,
  Title, Tooltip, Legend, Filler
);

const MOCK_AREA = [
  { month: "Jan", reports: 4, tasks: 6 },
  { month: "Feb", reports: 6, tasks: 9 },
  { month: "Mar", reports: 8, tasks: 11 },
  { month: "Apr", reports: 7, tasks: 13 },
  { month: "May", reports: 12, tasks: 16 },
  { month: "Jun", reports: 15, tasks: 20 },
];

export default function Dashboard() {
  const { isDarkMode } = useTheme();
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  
  const role = profile?.role?.toLowerCase() || "";
  const isConsultant = role === "consultant";
  const isSupervisor = role === "supervisor";
  const isAdmin = role === "admin";

  // Admin gets its own dedicated dashboard
  if (isAdmin) return <AdminDashboard />;

  const themeColors = {
    info: isDarkMode ? "#58a6ff" : "#3b82f6",
    success: isDarkMode ? "#3fb950" : "#10b981",
    warning: isDarkMode ? "#d29922" : "#f59e0b",
    danger: isDarkMode ? "#f85149" : "#ef4444",
    bgElevated: isDarkMode ? "#21262d" : "#ffffff",
    border: isDarkMode ? "rgba(255,255,255,0.15)" : "#e2e8f0",
    textPrimary: isDarkMode ? "#e6edf3" : "#0f172a",
    textSecondary: isDarkMode ? "#8b949e" : "#475569",
  };

  const COLORS = [themeColors.info, themeColors.success, themeColors.warning, themeColors.danger];

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks]       = useState([]);
  const [reports, setReports]   = useState([]);
  const [issues, setIssues]     = useState([]);
  const [selectedExportProject, setSelectedExportProject] = useState(null);

  // New supervisor filter and notifications states
  const [notifications, setNotifications] = useState([]);
  const [supervisorFilterProject, setSupervisorFilterProject] = useState("");
  const [supervisorFilterStatus, setSupervisorFilterStatus] = useState("all");
  const [viewMode, setViewMode] = useState("list");

  useEffect(() => {
    const u1 = subscribeProjects(setProjects);
    const u2 = subscribeTasks(null, setTasks);
    const u3 = subscribeReports(null, setReports);
    const u4 = subscribeIssues(setIssues);
    let u5;
    if (user?.uid) {
      u5 = subscribeNotifications(user.uid, setNotifications);
    }
    return () => { u1(); u2(); u3(); u4(); if(u5) u5(); };
  }, [user]);

  // ── Role-specific computed metrics ──────────────────────────────
  const myTasks = isSupervisor
    ? tasks.filter(t => t.assignedTo === profile?.name || t.assignedToUid === user?.uid)
    : tasks;
  const doneTasks     = myTasks.filter((t) => t.status === "done").length;
  const inProgressTasks = myTasks.filter((t) => t.status === "inprogress").length;
  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const openIssues    = issues.filter((i) => i.status === "open").length;

  // ── Role-specific stat cards (per flowchart) ────────────────────
  const consultantStats = [
    { label: "Active Projects",  value: projects.length, icon: FolderOpen,   color: themeColors.info },
    { label: "Tasks Created",    value: tasks.length,    icon: CheckSquare,  color: themeColors.success },
    { label: "Pending Reviews",  value: pendingReports,  icon: FileText,     color: themeColors.warning },
    { label: "Open Issues",      value: openIssues,      icon: AlertTriangle,color: themeColors.danger },
  ];

  const supervisorStats = [
    { label: "My Tasks",         value: myTasks.length,    icon: CheckSquare,  color: themeColors.info },
    { label: "Tasks Completed",  value: doneTasks,         icon: CheckCircle,  color: themeColors.success },
    { label: "In Progress",      value: inProgressTasks,   icon: TrendingUp,   color: themeColors.warning },
    { label: "Open Issues",      value: openIssues,        icon: AlertTriangle,color: themeColors.danger },
  ];

  const adminStats = [
    { label: "Active Projects",  value: projects.length, icon: FolderOpen,   color: themeColors.info },
    { label: "Tasks Completed",  value: doneTasks,       icon: CheckSquare,  color: themeColors.success },
    { label: "Pending Reports",  value: pendingReports,  icon: FileText,     color: themeColors.warning },
    { label: "Open Issues",      value: openIssues,      icon: AlertTriangle,color: themeColors.danger },
  ];

  const stats = isConsultant ? consultantStats : isSupervisor ? supervisorStats : adminStats;

  // ── Role-specific quick actions (per flowchart) ─────────────────
  const consultantActions = [
    { label: "Manage Projects & Tasks", desc: "Create tasks, assign to supervisor", icon: FolderOpen, color: themeColors.info, path: "/tasks" },
    { label: "Review Daily Reports", desc: "Approve / reject with comments", icon: ClipboardList, color: themeColors.warning, path: "/reports" },
    { label: "Track Issues", desc: "Update status, resolve issues", icon: AlertTriangle, color: themeColors.danger, path: "/issues" },
  ];

  const supervisorActions = [
    { label: "View Assigned Tasks", desc: "Check status, view deadlines", icon: Eye, color: themeColors.info, path: "/tasks" },
    { label: "Submit Daily Report", desc: "Fill form, upload photos & sign", icon: PlusCircle, color: themeColors.success, path: "/reports" },
    { label: "Report New Issue", desc: "Set priority, add description", icon: AlertTriangle, color: themeColors.danger, path: "/issues" },
  ];

  const quickActions = isConsultant ? consultantActions : isSupervisor ? supervisorActions : consultantActions;

  // Chart.js Data configurations
  const lineChartData = {
    labels: MOCK_AREA.map(d => d.month),
    datasets: [
      {
        label: 'Reports',
        data: MOCK_AREA.map(d => d.reports),
        borderColor: themeColors.info,
        backgroundColor: `${themeColors.info}33`,
        fill: true,
        tension: 0.4
      },
      {
        label: 'Tasks',
        data: MOCK_AREA.map(d => d.tasks),
        borderColor: themeColors.success,
        backgroundColor: `${themeColors.success}33`,
        fill: true,
        tension: 0.4
      }
    ]
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: themeColors.textPrimary } },
      tooltip: {
        backgroundColor: themeColors.bgElevated,
        titleColor: themeColors.textPrimary,
        bodyColor: themeColors.textPrimary,
        borderColor: themeColors.border,
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { color: themeColors.border, drawBorder: false },
        ticks: { color: themeColors.textSecondary }
      },
      y: {
        grid: { color: themeColors.border, drawBorder: false },
        ticks: { color: themeColors.textSecondary }
      }
    }
  };

  const taskData = isSupervisor ? myTasks : tasks;
  const doughnutData = {
    labels: ['To Do', 'In Progress', 'Done'],
    datasets: [{
      data: [
        taskData.filter((t) => t.status === "todo").length,
        taskData.filter((t) => t.status === "inprogress").length,
        taskData.filter((t) => t.status === "done").length,
      ],
      backgroundColor: [COLORS[0], COLORS[2], COLORS[1]],
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: themeColors.textPrimary, padding: 20 } },
      tooltip: {
        backgroundColor: themeColors.bgElevated,
        titleColor: themeColors.textPrimary,
        bodyColor: themeColors.textPrimary,
        borderColor: themeColors.border,
        borderWidth: 1
      }
    },
    cutout: '70%'
  };

  const handleSeed = async () => {
    try {
      await seedDummyData();
      toast.success("Database heavily populated with dummy data!");
    } catch (e) {
      toast.error("Failed to seed data");
    }
  };

  const handlePush = async () => {
    toast.loading("Requesting browser permission...");
    try {
      const token = await requestPushPermission(profile?.id);
      toast.dismiss();
      if (token) {
        toast.success("FCM Notifications Enabled (Mock or Real)!");
      } else {
        toast.error("Push configuration failed. Ensure notifications are allowed by your browser.");
      }
    } catch (e) {
      toast.dismiss();
    }
  }

  // Role-specific welcome message
  const roleLabel = isConsultant ? "Consultant" : isSupervisor ? "Site Supervisor" : "Administrator";

  return (
    <div>
      <Topbar title="Dashboard" />
      <div className="page-body">

        {/* Role-aware welcome banner */}
        <div className="db-welcome-banner" style={{
          background: `linear-gradient(135deg, ${themeColors.info}22, ${themeColors.success}11)`,
          border: `1px solid ${themeColors.border}`,
          borderRadius: "var(--radius-lg)",
          padding: "20px 24px",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, fontFamily: "var(--font-display)" }}>
              Welcome back, {profile?.name || "User"} 👋
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "4px 0 0" }}>
              Logged in as <strong style={{ color: themeColors.info }}>{roleLabel}</strong> — Here's your dashboard overview.
            </p>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <button className="btn btn-sm btn-outline-primary" onClick={handlePush} style={{borderColor: themeColors.info, color: themeColors.info}}>
              <Bell size={16} /> Enable Notifications
            </button>
            {isAdmin && (
              <button className="btn btn-sm btn-outline-warning" onClick={handleSeed} style={{borderColor: themeColors.warning, color: themeColors.warning}}>
                <Database size={16} /> Seed Data
              </button>
            )}
          </div>
        </div>

        {/* Stat cards */}
        <div className="row g-4 mb-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div className="col-12 col-md-6 col-xl-3" key={label}>
              <div className="db-stat-card card h-100 d-flex flex-row align-items-center gap-3">
                <div className="db-stat-icon" style={{ background: color + "22", color }}>
                  <Icon size={24} />
                </div>
                <div>
                  <div className="db-stat-value fs-4 fw-bold">{value}</div>
                  <div className="db-stat-label text-muted">{label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions — role-specific (per flowchart "Choose action" branch) */}
        <div className="card p-4 mb-4">
          <div className="db-chart-title fw-bold mb-3 d-flex align-items-center gap-2">
            <ArrowRight size={18} /> Quick Actions
          </div>
          <div className="row g-3">
            {quickActions.map(({ label, desc, icon: Icon, color, path }) => (
              <div className="col-12 col-md-4" key={label}>
                <div
                  className="db-quick-action card h-100"
                  style={{ cursor: "pointer", border: `1px solid ${color}33`, transition: "all 0.2s" }}
                  onClick={() => {
                    if (label === "Submit Daily Report") {
                      navigate(path, { state: { openModal: true } });
                    } else if (label === "Report New Issue") {
                      navigate(path, { state: { openModal: true } });
                    } else {
                      navigate(path);
                    }
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${color}33`; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div style={{ background: `${color}22`, color, padding: "10px", borderRadius: "var(--radius-md)" }}>
                      <Icon size={22} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)" }}>{label}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>{desc}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Charts row */}
        <div className="row g-4 mb-4">
          {/* Area chart -> Line chart with fill using Chart.js */}
          <div className="col-12 col-lg-8">
            <div className="card h-100 p-4">
              <div className="db-chart-title mb-3 fw-bold d-flex align-items-center gap-2">
                <TrendingUp size={18} /> Activity Overview
              </div>
              <div style={{ position: 'relative', height: "300px", width: "100%" }}>
                <Line data={lineChartData} options={lineChartOptions} />
              </div>
            </div>
          </div>

          {/* Pie chart -> Doughnut chart using Chart.js */}
          <div className="col-12 col-lg-4">
            <div className="card h-100 p-4">
              <div className="db-chart-title mb-3 fw-bold d-flex align-items-center gap-2">
                <CheckCircle size={18} /> {isSupervisor ? "My Task Distribution" : "Task Distribution"}
              </div>
              <div style={{ position: 'relative', height: "300px", width: "100%", display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                {taskData.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <CheckCircle size={40} style={{ opacity: 0.2, marginBottom: 10 }} />
                    <div style={{ fontWeight: 600 }}>No task data available</div>
                    <div style={{ fontSize: '0.8rem' }}>Check back when tasks are assigned</div>
                  </div>
                ) : (
                  <Doughnut data={doughnutData} options={doughnutOptions} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Project Overview — visible to all roles */}
        <div className="card p-4 mb-4">
          <div className="db-chart-title fw-bold mb-3 d-flex align-items-center gap-2">
            <FolderOpen size={18} /> Project Overview
          </div>
          {projects.length === 0 ? (
            <p className="text-muted small">No projects yet. Create one from the Task Tracking page.</p>
          ) : (
            <div className="table-responsive">
              {/* Column headers */}
              <div className="d-none d-md-flex px-2 pb-2 mb-1" style={{ borderBottom: `1px solid ${themeColors.border}`, fontSize: '0.72rem', fontWeight: 700, color: themeColors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
                <div style={{ flex: '1 1 200px' }}>Project</div>
                <div style={{ flex: '0 0 120px', textAlign: 'center' }}>Start Date</div>
                <div style={{ flex: '0 0 140px', textAlign: 'center' }}>Due Date</div>
                <div style={{ flex: '0 0 140px', textAlign: 'center' }}>Progress</div>
                <div style={{ flex: '0 0 90px', textAlign: 'center' }}>Status</div>
              </div>

              {projects.map((p) => {
                // Due date urgency logic
                let dueBg = 'transparent';
                let dueColor = themeColors.textSecondary;
                let dueLabel = p.endDate || '—';
                let dueIcon = null;
                if (p.endDate) {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const due = new Date(p.endDate);
                  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
                  if (p.progress === 100 || p.status === 'completed') {
                    dueBg = `${themeColors.success}18`;
                    dueColor = themeColors.success;
                    dueLabel = p.endDate;
                  } else if (diffDays < 0) {
                    dueBg = `${themeColors.danger}18`;
                    dueColor = themeColors.danger;
                    dueLabel = `${p.endDate} (Overdue)`;
                  } else if (diffDays <= 7) {
                    dueBg = `${themeColors.warning}18`;
                    dueColor = themeColors.warning;
                    dueLabel = `${p.endDate} (${diffDays}d left)`;
                  } else {
                    dueColor = themeColors.textSecondary;
                    dueLabel = p.endDate;
                  }
                }

                // Progress bar colour
                const progressColor = p.progress === 100 ? themeColors.success : p.progress >= 60 ? themeColors.info : themeColors.warning;

                return (
                  <div
                    key={p.id}
                    className="d-flex flex-column flex-md-row align-items-md-center db-clickable-project py-3 px-2 gap-3"
                    style={{ borderBottom: `1px solid ${themeColors.border}`, cursor: 'pointer' }}
                    onClick={() => setSelectedExportProject(p)}
                  >
                    {/* Project name + location */}
                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <div className="fw-semibold" style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{p.name}</div>
                      <div className="small d-flex align-items-center gap-1 mt-1" style={{ color: 'var(--text-secondary)' }}>
                        <Clock size={11} /> {p.location || '—'}
                      </div>
                    </div>

                    {/* Start Date */}
                    <div style={{ flex: '0 0 120px', textAlign: 'center' }}>
                      <span className="small" style={{ color: themeColors.textSecondary }}>
                        {p.startDate || '—'}
                      </span>
                    </div>

                    {/* Due Date — prominent badge */}
                    <div style={{ flex: '0 0 140px', textAlign: 'center' }}>
                      {p.endDate ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '4px 10px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700,
                          background: dueBg, color: dueColor,
                          border: `1px solid ${dueColor}44`,
                        }}>
                          <Clock size={11} /> {dueLabel}
                        </span>
                      ) : (
                        <span className="small text-muted">Not set</span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div style={{ flex: '0 0 140px' }}>
                      <div className="d-flex align-items-center gap-2">
                        <div style={{ flex: 1, height: 8, background: `${progressColor}22`, borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ width: `${p.progress || 0}%`, height: '100%', background: progressColor, borderRadius: 99, transition: 'width 0.4s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: progressColor, minWidth: 32, textAlign: 'right' }}>{p.progress || 0}%</span>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div style={{ flex: '0 0 90px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                        background: p.status === 'completed' ? `${themeColors.success}22` : `${themeColors.warning}22`,
                        color: p.status === 'completed' ? themeColors.success : themeColors.warning,
                        textTransform: 'capitalize',
                      }}>
                        {p.status || 'active'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>


        {/* Supervisor: Task tracking and notifications layout */}
        {isSupervisor && (
          <div className="d-flex flex-column flex-xl-row gap-4 align-items-start mt-4">
            {/* Left side tasks area */}
            <div className="flex-grow-1 w-100">
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                <div className="d-flex gap-2">
                  <select 
                    className="form-control form-control-sm" 
                    style={{ width: "160px", background: "transparent", borderColor: "var(--border)" }}
                    value={supervisorFilterProject}
                    onChange={(e) => setSupervisorFilterProject(e.target.value)}
                  >
                    <option value="">Project (All)</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select 
                    className="form-control form-control-sm" 
                    style={{ width: "160px", background: "transparent", borderColor: "var(--border)" }}
                    value={supervisorFilterStatus}
                    onChange={(e) => setSupervisorFilterStatus(e.target.value)}
                  >
                    <option value="all">All tasks</option>
                    <option value="todo">To Do</option>
                    <option value="inprogress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                
                <div className="d-flex gap-2 flex-wrap">
                  {[
                    { key: 'list', icon: <ClipboardList size={14}/>, label: 'List' },
                    { key: 'board', icon: <CheckSquare size={14}/>, label: 'Board' },
                    { key: 'calendar', icon: null, label: 'Calendar' },
                    { key: 'gantt', icon: null, label: 'Gantt' },
                  ].map(({ key, icon, label }) => (
                    <button
                      key={key}
                      className="btn btn-sm"
                      style={{
                        background: viewMode === key ? '#F56A6A' : 'transparent',
                        color: viewMode === key ? '#ffffff' : '#F56A6A',
                        border: '1px solid #F56A6A',
                        borderRadius: 6,
                        fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                      onClick={() => setViewMode(key)}
                    >
                      {icon} {label}
                    </button>
                  ))}
                  <button className="btn btn-sm" style={{ background: 'transparent', color: '#F56A6A', border: '1px solid #F56A6A', borderRadius: 6, fontWeight: 600 }}>✓ Show Completed</button>
                </div>
              </div>

              <div className="row g-3">
                {myTasks
                  .filter(t => (supervisorFilterProject ? t.projectId === supervisorFilterProject : true))
                  .filter(t => (supervisorFilterStatus === "all" ? true : t.status === supervisorFilterStatus))
                  .length === 0 ? (
                  <div className="col-12"><p className="text-muted small">No tasks found matching criteria.</p></div>
                ) : (
                  myTasks
                    .filter(t => (supervisorFilterProject ? t.projectId === supervisorFilterProject : true))
                    .filter(t => (supervisorFilterStatus === "all" ? true : t.status === supervisorFilterStatus))
                    .map((t) => (
                    <div key={t.id} className="col-12 col-md-6">
                      <div 
                        className="card p-3 h-100 visily-task-card" 
                        style={{border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer", background: "var(--bg-card)"}}
                        onClick={() => navigate("/tasks")}
                      >
                         <div style={{fontSize: "0.95rem", fontWeight: "600", marginBottom: "20px", color: "var(--text-primary)"}}>{t.title}</div>
                         <div className="d-flex mb-3 gap-2 flex-wrap">
                           {t.priority && (
                              <span style={{fontSize: "0.7rem", padding: "4px 8px", borderRadius: "12px", background: "var(--accent-dim)", color: "var(--accent)", fontWeight: 700}}>
                                 {t.priority.toUpperCase()}
                              </span>
                           )}
                           <span style={{fontSize: "0.7rem", padding: "4px 8px", borderRadius: "12px", background: "rgba(88,166,255,0.15)", color: "var(--info)", fontWeight: 700}}>
                             {t.projectName || "Site Unknown"}
                           </span>
                         </div>
                         <div className="d-flex justify-content-between align-items-center mt-auto pt-2">
                           <div className="text-muted d-flex gap-3 align-items-center" style={{fontSize: "0.8rem"}}>
                             <span><MessageSquare size={14}/> 3</span>
                             <span><ClipboardList size={14}/> 1</span>
                           </div>
                           <div className="d-flex">
                             <img src="https://i.pravatar.cc/150?u=4" alt="worker" style={{width: 24, height: 24, borderRadius: '50%', border: '2px solid #fff', marginLeft: '-8px'}}/>
                             <img src="https://i.pravatar.cc/150?u=5" alt="worker" style={{width: 24, height: 24, borderRadius: '50%', border: '2px solid #fff', marginLeft: '-8px'}}/>
                             <img src="https://i.pravatar.cc/150?u=6" alt="worker" style={{width: 24, height: 24, borderRadius: '50%', border: '2px solid #fff', marginLeft: '-8px'}}/>
                           </div>
                         </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Side Notifications */}
            <div className="visily-notification-pane" style={{width: "100%", flex: "0 0 340px", background: "var(--bg-surface)", padding: "24px", borderRadius: "8px", border: "1px solid var(--border)"}}>
               <div className="d-flex justify-content-between align-items-center mb-4">
                 <h5 style={{fontWeight: 700, margin: 0, color: "var(--text-primary)"}}>Notification</h5>
                 <span style={{fontSize: "0.8rem", color: "var(--text-secondary)", cursor: "pointer"}}>✓ Mark All Read</span>
               </div>
               
               <div className="notifications-widget" style={{maxHeight: '400px', overflowY: 'auto'}}>
                   {notifications.length > 0 && notifications.slice(0, 5).map((n) => (
                     <div key={n.id} className="d-flex gap-3" style={{paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12}}>
                        <div style={{marginTop: 2}}>
                          {n.type === 'success' ? <CheckCircle size={16} color="var(--success)"/> : n.type === 'error' ? <XCircle size={16} color="var(--danger)"/> : <Bell size={16} color="var(--accent)"/>}
                        </div>
                        <div>
                           <div style={{fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.4}}>{n.message}</div>
                           <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4}}>
                             {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleTimeString() : 'Just now'}
                           </div>
                        </div>
                     </div>
                   ))}

                  {notifications.length === 0 && (
                   <>
                    <div className="d-flex gap-3" style={{paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12}}>
                        <div style={{marginTop: 2}}><CheckCircle size={16} color="var(--success)"/></div>
                        <div>
                           <div style={{fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.4}}>Task 'Electrical Work' assigned to you</div>
                           <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4}}>2 mins ago</div>
                        </div>
                    </div>
                    <div className="d-flex gap-3" style={{paddingBottom: 12, borderBottom: '1px solid var(--border)', marginBottom: 12}}>
                        <div style={{marginTop: 2}}><XCircle size={16} color="var(--danger)"/></div>
                        <div>
                           <div style={{fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.4}}>Your report on Site B was rejected: 'Missing GPS data'</div>
                           <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4}}>10 mins ago</div>
                        </div>
                    </div>
                   </>
                  )}
                </div>
            </div>
          </div>
        )}

        {/* Export Project Modal (Consultant/Admin) */}
        {selectedExportProject && (
          <div className="modal-overlay d-print-none" onClick={() => setSelectedExportProject(null)}>
            <div className="sp-modal" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
              <div className="sp-modal-title d-flex justify-content-between align-items-center mb-0">
                <span style={{ fontSize: '1.4rem' }}>{selectedExportProject.name} — Report</span>
                <div className="d-flex gap-2">
                   <button className="btn btn-outline-secondary btn-sm" onClick={() => window.print()}>
                     <Download size={14} /> Export PDF
                   </button>
                   <button className="btn btn-ghost btn-sm p-1" onClick={() => setSelectedExportProject(null)}>
                     <X size={18} />
                   </button>
                </div>
              </div>

              <div className="mt-4">
                <div className="d-flex justify-content-between text-muted small mb-4 pb-3" style={{ borderBottom: "1px dashed var(--border)" }}>
                  <span><strong>Location:</strong> {selectedExportProject.location || "N/A"}</span>
                  <span><strong>Due Date:</strong> {selectedExportProject.endDate || "N/A"}</span>
                  <span><strong>Overall Progress:</strong> {selectedExportProject.progress || 0}%</span>
                  <span className="text-uppercase text-warning"><strong>Status:</strong> {selectedExportProject.status}</span>
                </div>
                
                <h6 className="mb-3" style={{ color: "var(--text-primary)", fontWeight: "600" }}>Master Task List</h6>
                <div className="table-responsive">
                  <table className="table table-hover table-sm">
                    <thead>
                      <tr>
                        <th style={{ color: "var(--text-secondary)" }}>Task Title</th>
                        <th style={{ color: "var(--text-secondary)" }}>Assigned Worker</th>
                        <th style={{ color: "var(--text-secondary)" }}>Status</th>
                        <th style={{ color: "var(--text-secondary)" }}>Date Created</th>
                      </tr>
                    </thead>
                    <tbody style={{ color: "var(--text-primary)" }}>
                      {tasks.filter(t => t.projectId === selectedExportProject.id).length === 0 ? (
                        <tr><td colSpan="4" className="text-center py-4 text-muted">No tasks assigned to this project yet.</td></tr>
                      ) : (
                        tasks.filter(t => t.projectId === selectedExportProject.id).map(t => (
                          <tr key={t.id}>
                            <td>{t.title}</td>
                            <td>{t.assignedTo || "Unassigned"}</td>
                            <td>
                              <span className={`badge badge-${t.status || 'todo'}`}>
                                {t.status}
                              </span>
                            </td>
                            <td>{t.createdAt?.toDate ? new Date(t.createdAt.toDate()).toLocaleDateString() : 'N/A'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
      
      {/* Invisible Printable Component triggered by window.print() */}
      {selectedExportProject && (
        <div className="printable-master-report">
          <h1 style={{ fontSize: 24, marginBottom: 10, color: '#000' }}>{selectedExportProject.name} — Master Project Report</h1>
          <div style={{ marginBottom: 30, fontSize: 14, color: '#444', display: 'flex', gap: '30px' }}>
             <span><strong>Location:</strong> {selectedExportProject.location || "N/A"}</span>
             <span><strong>Due Date:</strong> {selectedExportProject.endDate || "N/A"}</span>
             <span><strong>Progress:</strong> {selectedExportProject.progress || 0}%</span>
             <span><strong>Status:</strong> {selectedExportProject.status}</span>
          </div>

          <h2 style={{ fontSize: 18, borderBottom: '1px solid #ccc', paddingBottom: 5, marginBottom: 15 }}>Assigned Project Tasks</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ padding: '8px', border: '1px solid #ccc' }}>Task Title</th>
                <th style={{ padding: '8px', border: '1px solid #ccc' }}>Assigned To</th>
                <th style={{ padding: '8px', border: '1px solid #ccc' }}>Status</th>
                <th style={{ padding: '8px', border: '1px solid #ccc' }}>Date Created</th>
              </tr>
            </thead>
            <tbody>
              {tasks.filter(t => t.projectId === selectedExportProject.id).length === 0 ? (
                <tr><td colSpan="4" style={{ padding: '8px', border: '1px solid #ccc', textAlign: 'center' }}>No tasks found.</td></tr>
              ) : (
                tasks.filter(t => t.projectId === selectedExportProject.id).map(t => (
                  <tr key={t.id}>
                    <td style={{ padding: '8px', border: '1px solid #ccc' }}>{t.title}</td>
                    <td style={{ padding: '8px', border: '1px solid #ccc' }}>{t.assignedTo || "—"}</td>
                    <td style={{ padding: '8px', border: '1px solid #ccc', textTransform: 'uppercase' }}>{t.status}</td>
                    <td style={{ padding: '8px', border: '1px solid #ccc' }}>{t.createdAt?.toDate ? new Date(t.createdAt.toDate()).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p style={{ marginTop: 40, fontSize: 10, color: '#666' }}>Generated automatically by SPRS Enterprise Reporting Engine.</p>
        </div>
      )}
    </div>
  );
}
