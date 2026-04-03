// src/components/dashboard/Dashboard.js
import React, { useEffect, useState } from "react";
import {
  FolderOpen, CheckSquare, FileText,
  AlertTriangle, TrendingUp, CheckCircle, Bell, Database
} from "lucide-react";
import Topbar from "../shared/Topbar";
import { subscribeProjects, subscribeTasks, subscribeReports, subscribeIssues, seedDummyData, requestPushPermission } from "../../firebase/services";
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
  const { profile } = useAuth();
  
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

  useEffect(() => {
    const u1 = subscribeProjects(setProjects);
    const u2 = subscribeTasks(null, setTasks);
    const u3 = subscribeReports(null, setReports);
    const u4 = subscribeIssues(setIssues);
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const doneTasks     = tasks.filter((t) => t.status === "done").length;
  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const openIssues    = issues.filter((i) => i.status === "open").length;

  const stats = [
    { label: "Active Projects",  value: projects.length, icon: FolderOpen,   color: themeColors.info },
    { label: "Tasks Completed",  value: doneTasks,        icon: CheckSquare,  color: themeColors.success },
    { label: "Pending Reports",  value: pendingReports,   icon: FileText,     color: themeColors.warning },
    { label: "Open Issues",      value: openIssues,       icon: AlertTriangle,color: themeColors.danger },
  ];

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

  const doughnutData = {
    labels: ['To Do', 'In Progress', 'Done'],
    datasets: [{
      data: [
        tasks.filter((t) => t.status === "todo").length,
        tasks.filter((t) => t.status === "inprogress").length,
        doneTasks
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
        toast.success("FCM Notifications Enabled!");
      } else {
        toast.error("VAPID Key missing in code, but permission was granted!");
      }
    } catch (e) {
      toast.dismiss();
    }
  }

  return (
    <div>
      <Topbar title="Dashboard" />
      <div className="page-body">

        {/* Action Buttons for Presentation / Thesis Defense */}
        <div className="d-flex flex-wrap gap-2 mb-4 justify-content-end">
          <button className="btn btn-sm btn-outline-primary" onClick={handlePush} style={{borderColor: themeColors.info, color: themeColors.info}}>
            <Bell size={16} /> Enable Push Notifications (FCM)
          </button>
          <button className="btn btn-sm btn-outline-warning" onClick={handleSeed} style={{borderColor: themeColors.warning, color: themeColors.warning}}>
            <Database size={16} /> Auto-Seed Dummy Data
          </button>
        </div>

        {/* Stat cards - Bootstrap integration via row/col */}
        {/* We use standard custom CSS but inject Bootstrap layout classes to adhere to thesis */}
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

        {/* Charts row */}
        <div className="row g-4 mb-4">
          {/* Area chart -> Line chart with fill using Chart.js */}
          <div className="col-12 col-lg-8">
            <div className="card h-100 p-4">
              <div className="db-chart-title mb-3 fw-bold d-flex align-items-center gap-2">
                <TrendingUp size={18} /> Activity Overview (Chart.js)
              </div>
              <div style={{ height: "300px" }}>
                <Line data={lineChartData} options={lineChartOptions} />
              </div>
            </div>
          </div>

          {/* Pie chart -> Doughnut chart using Chart.js */}
          <div className="col-12 col-lg-4">
            <div className="card h-100 p-4">
              <div className="db-chart-title mb-3 fw-bold d-flex align-items-center gap-2">
                <CheckCircle size={18} /> Task Distribution (Chart.js)
              </div>
              <div style={{ height: "300px" }}>
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>
            </div>
          </div>
        </div>

        {/* Recent projects */}
        <div className="card p-4">
          <div className="db-chart-title fw-bold mb-3 d-flex align-items-center gap-2">
            <FolderOpen size={18} /> Recent Projects
          </div>
          {projects.length === 0 ? (
            <p className="text-muted small">
              No projects yet. Create one from the Task Tracking page.
            </p>
          ) : (
            <div className="db-project-list">
              {projects.slice(0, 5).map((p) => (
                <div key={p.id} className="d-flex flex-column flex-md-row align-items-md-center justify-content-between py-3 border-bottom gap-3">
                  <div className="d-flex align-items-center gap-3">
                    <div className="db-project-icon text-primary rounded" style={{ background: `${themeColors.info}22`, padding: '10px' }}>
                      <FolderOpen size={18} style={{ color: themeColors.info }} />
                    </div>
                    <div>
                      <div className="fw-semibold">{p.name}</div>
                      <div className="text-muted small">{p.location || "—"}</div>
                    </div>
                  </div>
                  
                  <div className="d-flex align-items-center gap-4">
                    <div className="d-none d-md-flex align-items-center gap-2">
                      <div className="progress" style={{ width: "120px", height: "8px", borderRadius: "10px" }}>
                        <div
                          className="progress-bar"
                          style={{ width: `${p.progress || 0}%`, background: themeColors.info, borderRadius: "10px" }}
                        />
                      </div>
                      <span className="small text-muted fw-semibold">{p.progress || 0}%</span>
                    </div>
                    <span className={`badge`} style={{ background: `${themeColors.warning}22`, color: themeColors.warning, padding: '6px 10px', borderRadius: '10px' }}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
