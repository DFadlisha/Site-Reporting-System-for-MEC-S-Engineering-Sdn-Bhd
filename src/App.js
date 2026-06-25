// src/App.js
import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { onMessage } from "firebase/messaging";
import { messaging } from "./firebase/config";
import ProtectedRoute from "./components/shared/ProtectedRoute";
import AppLayout from "./components/shared/AppLayout";
import AuthPage from "./components/auth/AuthPage";
import Dashboard from "./components/dashboard/Dashboard";
import TasksPage from "./components/tasks/TasksPage";
import ReportsPage from "./components/reports/ReportsPage";
import IssuesPage from "./components/issues/IssuesPage";
import NotificationsPage from "./components/notifications/NotificationsPage";
import UsersPage from "./components/admin/UsersPage";
import AuditPage from "./components/admin/AuditPage";
import "./index.css";

export default function App() {
  // ── Foreground FCM message handler ──────────────────────────────
  useEffect(() => {
    if (!messaging) return;
    const unsub = onMessage(messaging, (payload) => {
      const title = payload.notification?.title || "New Notification";
      const body  = payload.notification?.body  || "";
      toast(
        (t) => (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: "1.2rem" }}>🔔</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 2 }}>{title}</div>
              {body && <div style={{ fontSize: "0.82rem", opacity: 0.85 }}>{body}</div>}
            </div>
          </div>
        ),
        { duration: 5000 }
      );
    });
    return unsub;
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                fontSize: "0.875rem",
              },
              success: { iconTheme: { primary: "var(--success)", secondary: "var(--bg-elevated)" } },
              error:   { iconTheme: { primary: "var(--danger)", secondary: "var(--bg-elevated)" } },
            }}
          />
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />

          {/* Protected */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout><Dashboard /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <AppLayout><TasksPage /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <AppLayout><ReportsPage /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/issues"
            element={
              <ProtectedRoute>
                <AppLayout><IssuesPage /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <AppLayout><NotificationsPage /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <AppLayout><UsersPage /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit"
            element={
              <ProtectedRoute>
                <AppLayout><AuditPage /></AppLayout>
              </ProtectedRoute>
            }
          />


          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}
