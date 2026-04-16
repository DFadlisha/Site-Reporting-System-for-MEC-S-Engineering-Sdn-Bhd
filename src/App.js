// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
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
