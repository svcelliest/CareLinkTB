import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "@inertiajs/react";
import RoleScreen, { roles } from "./RoleScreen";

// Screens: 'role' | 'form' | 'fp-email' | 'fp-otp' | 'fp-newpw' | 'fp-success'

const DEMO_OTP = "123456";

function getPwStrength(val) {
    let s = 0;
    if (val.length >= 8) s++;
    if (/[A-Z]/.test(val)) s++;
    if (/[0-9]/.test(val)) s++;
    if (/[^A-Za-z0-9]/.test(val)) s++;
    return {
        pct: (s / 4) * 100,
        color: ["", "#e74c3c", "#e67e22", "#f1c40f", "#27ae60"][s] || "#eee",
    };
}

export default function LoginModal({ isOpen, onClose }) {
    const [screen, setScreen] = useState("role");
    const [selectedRole, setSelectedRole] = useState(null);
    const [fpEmail, setFpEmail] = useState("");

    const handleClose = useCallback(() => {
        if (typeof onClose === "function") onClose();
    }, [onClose]);

    const reset = useCallback(() => {
        setScreen("role");
        setSelectedRole(null);
        setFpEmail("");
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape" && isOpen) handleClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [isOpen, handleClose]);

    useEffect(() => {
        document.body.style.overflow = isOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            const t = setTimeout(reset, 280);
            return () => clearTimeout(t);
        }
    }, [isOpen, reset]);

    const cfg = selectedRole ? roles.find((r) => r.key === selectedRole) : null;

    return (
        <div
            className={`login-overlay ${isOpen ? "active" : ""}`}
            onClick={(e) => {
                if (e.target === e.currentTarget) handleClose();
            }}
        >
            <div className="login-card">
                <button
                    onClick={handleClose}
                    className="modal-close-btn"
                    aria-label="Close"
                >
                    ✕
                </button>

                <div className="login-logo">
                    <img
                        src="/img/logo_img/icm_logo_transparent.png"
                        alt="CareLink TB Logo"
                        className="login-logo-img"
                    />
                </div>

                {screen === "role" && (
                    <RoleScreen
                        onSelect={(role) => {
                            setSelectedRole(role);
                            setScreen("form");
                        }}
                    />
                )}

                {screen === "form" && cfg && (
                    <LoginForm
                        cfg={cfg}
                        onBack={() => setScreen("role")}
                        onForgotPw={() => setScreen("fp-email")}
                    />
                )}

                {screen === "fp-email" && (
                    <FpEmail
                        onBack={() => setScreen("form")}
                        onOtpSent={(email) => {
                            setFpEmail(email);
                            setScreen("fp-otp");
                        }}
                    />
                )}

                {screen === "fp-otp" && (
                    <FpOtp
                        email={fpEmail}
                        onBack={() => setScreen("fp-email")}
                        onVerified={() => setScreen("fp-newpw")}
                    />
                )}

                {screen === "fp-newpw" && (
                    <FpNewPassword onSaved={() => setScreen("fp-success")} />
                )}

                {screen === "fp-success" && (
                    <FpSuccess
                        onBack={() => {
                            reset();
                            handleClose();
                        }}
                    />
                )}
            </div>
        </div>
    );
}

/* ══════════════════════════════════════════════
   SUB-SCREEN: LOGIN FORM
   ══════════════════════════════════════════════ */
function LoginForm({ cfg, onBack, onForgotPw }) {
    const { data, setData, post, processing, errors } = useForm({
        role: cfg.key,
        email: "",
        password: "",
        remember: false,
    });

    const emailRef = useRef(null);

    useEffect(() => {
        setTimeout(() => emailRef.current?.focus(), 50);
    }, []);

    const handleSignIn = (e) => {
        e.preventDefault();
        post("/login");
    };

    return (
        <form onSubmit={handleSignIn} className="form-screen-enter">
            <button type="button" className="back-btn" onClick={onBack}>
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ width: 16, height: 16 }}
                >
                    <polyline points="15 18 9 12 15 6" />
                </svg>
                Back
            </button>

            <div className="role-badge">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    {cfg.icon}
                </svg>
                {cfg.label.replace("Login as ", "")}
            </div>

            <h2 className="form-title">{cfg.title}</h2>
            <p className="form-subtitle">{cfg.subtitle}</p>

            <label className="field-label">Email</label>
            <input
                ref={emailRef}
                type="email"
                placeholder="Enter email"
                autoComplete="username"
                value={data.email}
                onChange={(e) => setData("email", e.target.value)}
                className={`field-input ${errors.email ? "input-error" : ""}`}
            />
            {errors.email && (
                <div className="field-error">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {errors.email}
                </div>
            )}

            <label className="field-label" style={{ marginTop: "6px" }}>
                Password
            </label>
            <input
                type="password"
                placeholder="Enter password"
                autoComplete="current-password"
                value={data.password}
                onChange={(e) => setData("password", e.target.value)}
                className={`field-input ${errors.password ? "input-error" : ""}`}
            />
            {errors.password && (
                <div className="field-error">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {errors.password}
                </div>
            )}

            <div className="first-login-notice">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>
                    Your account was created by an administrator. Please change
                    your password after your first login.
                </span>
            </div>

            <div className="login-row">
                <label>
                    <input
                        type="checkbox"
                        checked={data.remember}
                        onChange={(e) => setData("remember", e.target.checked)}
                    />
                    Keep me signed in
                </label>
                <button
                    type="button"
                    className="forgot-link"
                    onClick={onForgotPw}
                >
                    Forgot password?
                </button>
            </div>

            <button type="submit" className="btn-primary" disabled={processing}>
                {processing
                    ? "Signing in…"
                    : `Sign in as ${cfg.label.replace("Login as ", "")}`}
                {processing && <span className="btn-spinner" />}
            </button>
        </form>
    );
}

/* ══════════════════════════════════════════════
   SUB-SCREEN: FORGOT PASSWORD — EMAIL
   ══════════════════════════════════════════════ */
function FpEmail({ onBack, onOtpSent }) {
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSend = () => {
        setError("");
        if (!email.trim()) {
            setError("Please enter your Gmail address.");
            return;
        }
        if (!/^[^\s@]+@gmail\.com$/i.test(email)) {
            setError(
                "Please enter a valid Gmail address (must end in @gmail.com).",
            );
            return;
        }
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            onOtpSent(email);
        }, 900);
    };

    return (
        <div className="fp-screen-enter">
            <button className="back-btn" onClick={onBack}>
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ width: 16, height: 16 }}
                >
                    <polyline points="15 18 9 12 15 6" />
                </svg>
                Back to Sign In
            </button>
            <h2 className="fp-title">Forgot Password</h2>
            <p className="fp-subtitle">
                Enter your Gmail address and we'll send you a 6-digit OTP to
                reset your password.
            </p>

            <label className="field-label">Gmail Address</label>
            <input
                type="email"
                placeholder="yourname@gmail.com"
                value={email}
                onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className={`field-input ${error ? "input-error" : ""}`}
            />
            {error && (
                <div className="field-error">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                </div>
            )}
            <button
                className="btn-primary"
                disabled={loading}
                onClick={handleSend}
            >
                {loading ? "Sending…" : "Send OTP"}
                {loading && <span className="btn-spinner" />}
            </button>
        </div>
    );
}

/* ══════════════════════════════════════════════
   SUB-SCREEN: FORGOT PASSWORD — OTP
   ══════════════════════════════════════════════ */
function FpOtp({ email, onBack, onVerified }) {
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const refs = useRef([]);

    useEffect(() => {
        refs.current[0]?.focus();
    }, []);
    useEffect(() => {
        if (countdown <= 0) {
            setCanResend(true);
            return;
        }
        const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown]);

    const handleChange = (i, val) => {
        const v = val.replace(/[^0-9]/g, "").slice(-1);
        const next = [...otp];
        next[i] = v;
        setOtp(next);
        setError("");
        if (v && i < 5) refs.current[i + 1]?.focus();
    };

    const handleKeyDown = (i, e) => {
        if (e.key === "Backspace" && !otp[i] && i > 0)
            refs.current[i - 1]?.focus();
    };

    const handleVerify = () => {
        const code = otp.join("");
        if (code.length < 6) {
            setError("Please enter all 6 digits.");
            return;
        }
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            if (code === DEMO_OTP) onVerified();
            else
                setError("Incorrect OTP. Please try again. (Demo: use 123456)");
        }, 700);
    };

    const handleResend = () => {
        if (!canResend) return;
        setOtp(["", "", "", "", "", ""]);
        setError("");
        setCountdown(60);
        setCanResend(false);
        refs.current[0]?.focus();
    };

    return (
        <div className="fp-screen-enter">
            <button className="back-btn" onClick={onBack}>
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ width: 16, height: 16 }}
                >
                    <polyline points="15 18 9 12 15 6" />
                </svg>
                Back
            </button>
            <h2 className="fp-title">Enter OTP</h2>
            <p className="fp-subtitle">
                We sent a 6-digit code to{" "}
                <strong style={{ color: "#222" }}>{email}</strong>. Enter it
                below.
            </p>

            <div className="otp-group">
                {otp.map((v, i) => (
                    <input
                        key={i}
                        ref={(el) => (refs.current[i] = el)}
                        type="text"
                        maxLength={1}
                        inputMode="numeric"
                        value={v}
                        onChange={(e) => handleChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        className={`otp-input ${error ? "input-error" : ""}`}
                    />
                ))}
            </div>

            {error && (
                <div
                    className="field-error"
                    style={{ justifyContent: "center" }}
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                </div>
            )}

            <div className="resend-row">
                Didn't receive it?{" "}
                <button
                    className="resend-link"
                    disabled={!canResend}
                    onClick={handleResend}
                >
                    Resend OTP
                </button>
                {!canResend && (
                    <span>
                        {" "}
                        in <strong>{countdown}</strong>s
                    </span>
                )}
            </div>

            <button
                className="btn-primary"
                disabled={loading}
                onClick={handleVerify}
            >
                {loading ? "Verifying…" : "Verify OTP"}
                {loading && <span className="btn-spinner" />}
            </button>
        </div>
    );
}

/* ══════════════════════════════════════════════
   SUB-SCREEN: FORGOT PASSWORD — NEW PASSWORD
   ══════════════════════════════════════════════ */
function FpNewPassword({ onSaved }) {
    const [pw, setPw] = useState("");
    const [cpw, setCpw] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const { pct, color } = getPwStrength(pw);
    const match = cpw ? pw === cpw : null;

    const handleSave = () => {
        setError("");
        if (!pw) {
            setError("Please enter a new password.");
            return;
        }
        if (pw.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        if (pw !== cpw) {
            setError("Passwords do not match.");
            return;
        }
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            onSaved();
        }, 800);
    };

    return (
        <div className="fp-screen-enter">
            <h2 className="fp-title">Set New Password</h2>
            <p className="fp-subtitle">
                Choose a strong new password for your account.
            </p>

            <label className="field-label">New Password</label>
            <input
                type="password"
                placeholder="Enter new password"
                value={pw}
                onChange={(e) => {
                    setPw(e.target.value);
                    setError("");
                }}
                className={`field-input ${error && !pw ? "input-error" : ""}`}
            />
            <div className="pw-strength-bar">
                <div
                    className="pw-strength-fill"
                    style={{ width: `${pct}%`, background: color }}
                />
            </div>

            <label className="field-label">Confirm Password</label>
            <input
                type="password"
                placeholder="Re-enter new password"
                value={cpw}
                onChange={(e) => {
                    setCpw(e.target.value);
                    setError("");
                }}
                className={`field-input ${error && pw !== cpw ? "input-error" : ""}`}
            />

            {match !== null && (
                <p className={match ? "pw-match-ok" : "pw-match-err"}>
                    {match ? "✓ Passwords match" : "✗ Passwords do not match"}
                </p>
            )}
            {error && (
                <div className="field-error">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                </div>
            )}

            <button
                className="btn-primary"
                disabled={loading}
                onClick={handleSave}
            >
                {loading ? "Saving…" : "Save New Password"}
                {loading && <span className="btn-spinner" />}
            </button>
        </div>
    );
}

/* ══════════════════════════════════════════════
   SUB-SCREEN: FORGOT PASSWORD — SUCCESS
   ══════════════════════════════════════════════ */
function FpSuccess({ onBack }) {
    return (
        <div className="fp-screen-enter">
            <div className="success-icon">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            </div>
            <h2 className="fp-title" style={{ textAlign: "center" }}>
                Password Reset!
            </h2>
            <p className="fp-subtitle" style={{ textAlign: "center" }}>
                Your password has been updated successfully. You can now sign in
                with your new password.
            </p>
            <button className="btn-primary" onClick={onBack}>
                Back to Sign In
            </button>
        </div>
    );
}
