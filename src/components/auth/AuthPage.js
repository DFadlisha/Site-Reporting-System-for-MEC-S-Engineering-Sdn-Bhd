// src/components/auth/AuthPage.js
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Mail,
  Lock,
  User,
  Briefcase,
  AlertCircle,
} from "lucide-react";
import { registerUser, loginUser } from "../../firebase/services";
import toast from "react-hot-toast";
import "./AuthPage.css";

// ── Translate Firebase error codes to friendly messages ──────────────────────
function parseFirebaseError(err) {
  const code = err?.code || "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address is invalid.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password. Please try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact your administrator.";
    default:
      return err?.message || "Something went wrong. Please try again.";
  }
}

const ALLOWED_DOMAIN = "@mecs";

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "supervisor",
  });
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  // ── Derived validation states ─────────────────────────────────────────────
  const emailHasDomain =
    form.email.toLowerCase().includes(ALLOWED_DOMAIN.toLowerCase());
  const emailIsNotEmpty = form.email.length > 0;
  const passwordsMatch =
    form.confirmPassword.length > 0 &&
    form.password === form.confirmPassword;
  const passwordMismatch =
    form.confirmPassword.length > 0 &&
    form.password !== form.confirmPassword;

  // ── Validate before register submit ──────────────────────────────────────
  const validateRegister = () => {
    if (!form.name.trim()) {
      toast.error("Please enter your full name.");
      return false;
    }
    if (!emailHasDomain) {
      toast.error(
        `Only MEC'S staff emails are allowed. Your email must contain "${ALLOWED_DOMAIN}".`
      );
      return false;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return false;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === "register" && !validateRegister()) return;
    setLoading(true);
    try {
      if (mode === "register") {
        await registerUser(form.name, form.email, form.password, form.role);
        toast.success("Account created! Welcome aboard.");
      } else {
        await loginUser(form.email, form.password);
        toast.success("Welcome back!");
      }
      navigate("/dashboard");
    } catch (err) {
      toast.error(parseFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setForm({ name: "", email: "", password: "", confirmPassword: "", role: "supervisor" });
    setShowPw(false);
    setShowConfirmPw(false);
  };

  return (
    <div className="auth-root">
      {/* Animated grid background */}
      <div className="auth-grid-bg" />
      <div className="auth-glow" />

      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo">
            <Building2 size={22} />
          </div>
          <div>
            <h1 className="auth-title">SPRS</h1>
            <p className="auth-subtitle">Site Progress Reporting System</p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="auth-toggle">
          <button
            id="btn-signin-tab"
            className={`auth-toggle-btn ${mode === "login" ? "active" : ""}`}
            onClick={() => switchMode("login")}
            type="button"
          >
            Sign In
          </button>
          <button
            id="btn-register-tab"
            className={`auth-toggle-btn ${mode === "register" ? "active" : ""}`}
            onClick={() => switchMode("register")}
            type="button"
          >
            Register
          </button>
        </div>

        {/* Domain notice on register */}
        {mode === "register" && (
          <div className="auth-notice">
            <ShieldCheck size={15} className="auth-notice-icon" />
            <span>
              Registration is limited to <strong>MEC'S Engineering</strong>{" "}
              staff. You must use a <strong>@mecs</strong> email address.
            </span>
          </div>
        )}

        <form id="auth-form" className="auth-form" onSubmit={handleSubmit}>
          {/* Full name — register only */}
          {mode === "register" && (
            <div className="form-group">
              <label className="form-label" htmlFor="input-name">
                Full Name
              </label>
              <div className="input-icon-wrapper">
                <User size={15} className="input-icon" />
                <input
                  id="input-name"
                  name="name"
                  className="form-control with-icon"
                  placeholder="Ahmad bin Abdullah"
                  value={form.name}
                  onChange={change}
                  required
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="input-email">
              Email Address
            </label>
            <div className="input-icon-wrapper">
              <Mail size={15} className="input-icon" />
              <input
                id="input-email"
                name="email"
                type="email"
                className={`form-control with-icon ${
                  mode === "register" && emailIsNotEmpty
                    ? emailHasDomain
                      ? "input-valid"
                      : "input-invalid"
                    : ""
                }`}
                placeholder="name@mecs.com.my"
                value={form.email}
                onChange={change}
                required
                autoComplete="email"
              />
              {mode === "register" && emailIsNotEmpty && (
                <span className="input-validation-icon">
                  {emailHasDomain ? (
                    <CheckCircle2 size={15} className="text-success" />
                  ) : (
                    <XCircle size={15} className="text-danger" />
                  )}
                </span>
              )}
            </div>
            {mode === "register" && emailIsNotEmpty && !emailHasDomain && (
              <p className="field-hint error">
                <AlertCircle size={12} />
                Email must contain &quot;@mecs&quot; (e.g. name@mecs.com.my)
              </p>
            )}
            {mode === "register" && emailIsNotEmpty && emailHasDomain && (
              <p className="field-hint success">
                <CheckCircle2 size={12} />
                MEC&apos;S email verified
              </p>
            )}
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="input-password">
              Password
            </label>
            <div className="input-icon-wrapper pw-wrapper">
              <Lock size={15} className="input-icon" />
              <input
                id="input-password"
                name="password"
                type={showPw ? "text" : "password"}
                className="form-control with-icon"
                placeholder="••••••••"
                value={form.password}
                onChange={change}
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                id="btn-toggle-password"
                className="pw-toggle"
                onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm password — register only */}
          {mode === "register" && (
            <div className="form-group">
              <label className="form-label" htmlFor="input-confirm-password">
                Confirm Password
              </label>
              <div className="input-icon-wrapper pw-wrapper">
                <Lock size={15} className="input-icon" />
                <input
                  id="input-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPw ? "text" : "password"}
                  className={`form-control with-icon ${
                    passwordsMatch
                      ? "input-valid"
                      : passwordMismatch
                      ? "input-invalid"
                      : ""
                  }`}
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={change}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  id="btn-toggle-confirm-password"
                  className="pw-toggle"
                  onClick={() => setShowConfirmPw(!showConfirmPw)}
                  aria-label={showConfirmPw ? "Hide password" : "Show password"}
                >
                  {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordMismatch && (
                <p className="field-hint error">
                  <XCircle size={12} /> Passwords do not match
                </p>
              )}
              {passwordsMatch && (
                <p className="field-hint success">
                  <CheckCircle2 size={12} /> Passwords match
                </p>
              )}
            </div>
          )}

          {/* Role — register only */}
          {mode === "register" && (
            <div className="form-group">
              <label className="form-label" htmlFor="input-role">
                Role
              </label>
              <div className="input-icon-wrapper">
                <Briefcase size={15} className="input-icon" />
                <select
                  id="input-role"
                  name="role"
                  className="form-control with-icon"
                  value={form.role}
                  onChange={change}
                >
                  <option value="supervisor">Site Supervisor (Contractor)</option>
                  <option value="consultant">Project Consultant</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>
          )}

          <button
            id="btn-auth-submit"
            className="btn btn-primary btn-full btn-lg auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? <Loader2 size={18} className="spin" /> : null}
            {mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="auth-footer">
          MEC&apos;S Engineering Sdn. Bhd. &mdash; Internal Use Only
        </p>
      </div>
    </div>
  );
}
