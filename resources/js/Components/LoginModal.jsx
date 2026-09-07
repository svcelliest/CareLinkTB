// resources/js/Components/LoginModal.jsx
//
// SECURITY / PHI NOTES (flagging even though not explicitly asked):
// - Credentials are sensitive. The real sign-in submit below uses Inertia's
//   useForm to POST to a Laravel route, so the server (not the client) is the
//   source of truth for authentication, session issuance, and audit logging.
//   Make sure the backend logs login attempts (success + failure, role,
//   timestamp, IP) for audit purposes, and rate-limits attempts.
// - "Keep me signed in" sends `remember` to LoginRequest, which passes it to
//   Laravel's Auth::attempt() as the remember flag. This issues the built-in
//   remember-me cookie/token (not localStorage), which is the right approach
//   for a healthcare app.
// - Never log username/password values to the console.

import { useEffect, useState } from "react";
import { useForm } from "@inertiajs/react";
import {
    Dialog,
    DialogContent,
    Box,
    Typography,
    Button,
    IconButton,
    TextField,
    Checkbox,
    FormControlLabel,
    CircularProgress,
    Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import LocalHospitalOutlinedIcon from "@mui/icons-material/LocalHospitalOutlined";
import MedicalServicesOutlinedIcon from "@mui/icons-material/MedicalServicesOutlined";

// ─── JSON mutation helper (mirrors Screening.jsx) ────────────────
// Forgot-password needs a plain JSON answer read back into state
// (the OTP, then a reset token) rather than an Inertia page visit,
// so this uses fetch() + the CSRF meta tag instead of useForm/router.
function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? "";
}

async function apiRequest(method, url, payload) {
    const response = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-CSRF-TOKEN": csrfToken(),
        },
        credentials: "same-origin",
        body: JSON.stringify(payload),
    });

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        throw new Error(data?.message ?? "Request failed.");
    }

    return data;
}

const RESEND_COOLDOWN_SECONDS = 30;

// ─── Role config ────────────────────────────────────────────────
// TODO: confirm these against the real Laravel route names
// (e.g. route('icm.dashboard')) once the routes exist — using plain
// paths for now since this is a frontend-only conversion.
const ROLES = [
    {
        key: "icm",
        label: "ICM",
        title: "Login as ICM",
        description:
            "International Care Ministries — program coordination & monitoring",
        formTitle: "ICM Portal Sign In",
        formSubtitle:
            "International Care Ministries — program coordination & monitoring",
        icon: HomeWorkOutlinedIcon,
    },
    {
        key: "rhu",
        label: "RHU",
        title: "Login as RHU",
        description:
            "Rural Health Unit — patient management, sputum & contact tracing",
        formTitle: "RHU Portal Sign In",
        formSubtitle:
            "Rural Health Unit — patient management & contact tracing",
        icon: LocalHospitalOutlinedIcon,
    },
    {
        key: "provider",
        label: "Provider",
        title: "Login as Provider",
        description:
            "X-ray & diagnostic service provider — handles registration",
        formTitle: "Provider Portal Sign In",
        formSubtitle:
            "X-ray & diagnostic service provider — results and referrals",
        icon: MedicalServicesOutlinedIcon,
    },
];

export default function LoginModal({ open, onClose }) {
    const [step, setStep] = useState("role"); // role | login | fp-email | fp-otp | fp-newpw | fp-success
    const [role, setRole] = useState(null);

    // Main sign-in form (server-validated via Inertia). Field is `email`,
    // matching LoginRequest's expected `email` credential (not `username`).
    const loginForm = useForm({
        role: "",
        email: "",
        password: "",
        remember: false,
    });

    // Forgot-password flow state. Plain useState (not useForm) since each
    // step needs a JSON answer read back — a generated OTP handed to the
    // user is never trusted here; the server issues a reset token only
    // after it verifies the OTP itself.
    const [fpEmail, setFpEmail] = useState("");
    const [fpOtp, setFpOtp] = useState("");
    const [fpPassword, setFpPassword] = useState("");
    const [fpPasswordConfirmation, setFpPasswordConfirmation] = useState("");
    const [fpResetToken, setFpResetToken] = useState("");
    const [fpLoading, setFpLoading] = useState(false);
    const [fpError, setFpError] = useState("");
    const [fpNotice, setFpNotice] = useState("");
    const [fpResending, setFpResending] = useState(false);
    const [fpResendCooldown, setFpResendCooldown] = useState(0);

    function resetForgotPassword() {
        setFpEmail("");
        setFpOtp("");
        setFpPassword("");
        setFpPasswordConfirmation("");
        setFpResetToken("");
        setFpLoading(false);
        setFpError("");
        setFpNotice("");
        setFpResending(false);
        setFpResendCooldown(0);
    }

    // Countdown for the "Resend code" cooldown, ticking once per second
    // while a positive cooldown is active.
    useEffect(() => {
        if (fpResendCooldown <= 0) return;
        const timer = setInterval(() => {
            setFpResendCooldown((seconds) => Math.max(0, seconds - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [fpResendCooldown > 0]);

    function resetAll() {
        setStep("role");
        setRole(null);
        loginForm.reset();
        loginForm.clearErrors();
        resetForgotPassword();
    }

    function goToForgotPassword() {
        resetForgotPassword();
        setFpEmail(loginForm.data.email);
        setStep("fp-email");
    }

    function backToLogin() {
        resetForgotPassword();
        setStep("login");
    }

    async function handleSendOtp(e) {
        e.preventDefault();
        if (!fpEmail.trim()) {
            setFpError("Please enter your email.");
            return;
        }
        setFpError("");
        setFpLoading(true);
        try {
            const data = await apiRequest("POST", route("password.otp.send"), {
                email: fpEmail,
            });
            setFpNotice(
                data?.message ?? "If that email exists, a code was sent.",
            );
            setFpResendCooldown(RESEND_COOLDOWN_SECONDS);
            setStep("fp-otp");
        } catch (err) {
            setFpError(err.message);
        } finally {
            setFpLoading(false);
        }
    }

    async function handleResendOtp() {
        if (fpResending || fpResendCooldown > 0) return;
        setFpError("");
        setFpResending(true);
        try {
            const data = await apiRequest("POST", route("password.otp.send"), {
                email: fpEmail,
            });
            setFpOtp("");
            setFpNotice(data?.message ?? "A new code was sent.");
            setFpResendCooldown(RESEND_COOLDOWN_SECONDS);
        } catch (err) {
            setFpError(err.message);
        } finally {
            setFpResending(false);
        }
    }

    async function handleVerifyOtp(e) {
        e.preventDefault();
        if (!fpOtp.trim()) {
            setFpError("Please enter the code.");
            return;
        }
        setFpError("");
        setFpLoading(true);
        try {
            const data = await apiRequest(
                "POST",
                route("password.otp.verify"),
                {
                    email: fpEmail,
                    otp: fpOtp,
                },
            );
            setFpResetToken(data.reset_token);
            setFpNotice("");
            setStep("fp-newpw");
        } catch (err) {
            setFpError(err.message);
        } finally {
            setFpLoading(false);
        }
    }

    async function handleResetPassword(e) {
        e.preventDefault();
        if (!fpPassword || !fpPasswordConfirmation) {
            setFpError("Please fill in both password fields.");
            return;
        }
        if (fpPassword !== fpPasswordConfirmation) {
            setFpError("Passwords do not match.");
            return;
        }
        setFpError("");
        setFpLoading(true);
        try {
            await apiRequest("POST", route("password.reset"), {
                email: fpEmail,
                reset_token: fpResetToken,
                password: fpPassword,
                password_confirmation: fpPasswordConfirmation,
            });
            setStep("fp-success");
        } catch (err) {
            setFpError(err.message);
        } finally {
            setFpLoading(false);
        }
    }

    function handleClose() {
        onClose();
        // Let the close transition finish before wiping state
        setTimeout(resetAll, 200);
    }

    function selectRole(r) {
        setRole(r);
        loginForm.setData((data) => ({ ...data, role: r.key }));
        setStep("login");
    }

    function handleSignIn(e) {
        e.preventDefault();
        if (!loginForm.data.email.trim() || !loginForm.data.password.trim()) {
            // Inertia's `errors` only reflects server validation; surface a quick
            // client-side check too so empty submits don't round-trip needlessly.
            loginForm.setError({
                email: !loginForm.data.email.trim()
                    ? "Please enter your email."
                    : undefined,
                password: !loginForm.data.password.trim()
                    ? "Please enter your password."
                    : undefined,
            });
            return;
        }
        loginForm.post("/login", { preserveScroll: true });
    }

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: "20px",
                    p: { xs: 1, sm: 2 },
                    position: "relative",
                },
            }}
        >
            <IconButton
                aria-label="Close"
                onClick={handleClose}
                sx={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    color: "grey.400",
                }}
            >
                <CloseIcon fontSize="small" />
            </IconButton>

            <DialogContent className="flex flex-col gap-1 pt-4 pb-6 px-4 sm:px-6">
                {/* Logo */}
                <Box
                    className="flex items-center justify-center mx-auto mb-2"
                    sx={{
                        width: 64,
                        height: 64,
                        bgcolor: "primary.main",
                        borderRadius: "16px",
                    }}
                >
                    <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
                        <polyline
                            points="2,18 8,18 12,8 16,26 20,14 24,22 28,18 34,18"
                            stroke="white"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </Box>

                {/* ── STEP: role selection ── */}
                {step === "role" && (
                    <Box>
                        <Typography
                            variant="h6"
                            fontWeight={700}
                            textAlign="center"
                        >
                            Welcome to CareLink TB
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            textAlign="center"
                            sx={{ mb: 4 }}
                        >
                            Select your account type to continue
                        </Typography>

                        <Box className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {ROLES.map((r) => {
                                const Icon = r.icon;
                                return (
                                    <Box
                                        key={r.key}
                                        component="button"
                                        type="button"
                                        onClick={() => selectRole(r)}
                                        className="flex flex-col items-center gap-3 w-full"
                                        sx={{
                                            minHeight: 150,
                                            p: 2,
                                            border: "1.5px solid #e8e8e8",
                                            borderRadius: "14px",
                                            bgcolor: "background.paper",
                                            cursor: "pointer",
                                            textAlign: "center",
                                            transition:
                                                "border-color .2s, box-shadow .2s, transform .1s",
                                            "&:hover": {
                                                borderColor: "primary.main",
                                                boxShadow:
                                                    "0 4px 20px rgba(217,79,79,0.12)",
                                                transform: "translateY(-2px)",
                                                bgcolor: "#fff8f8",
                                            },
                                        }}
                                    >
                                        <Box
                                            className="flex items-center justify-center"
                                            sx={{
                                                width: 52,
                                                height: 52,
                                                borderRadius: "14px",
                                                bgcolor: "#fef0f0",
                                            }}
                                        >
                                            <Icon
                                                sx={{ color: "primary.main" }}
                                            />
                                        </Box>
                                        <Box>
                                            <Typography
                                                variant="body2"
                                                fontWeight={700}
                                            >
                                                Login as {r.label}
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                color="text.disabled"
                                                sx={{ lineHeight: 1.3 }}
                                            >
                                                {r.description}
                                            </Typography>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                )}

                {/* ── STEP: credentials ── */}
                {step === "login" && role && (
                    <Box
                        component="form"
                        onSubmit={handleSignIn}
                        className="flex flex-col gap-1"
                    >
                        <Button
                            onClick={() => setStep("role")}
                            startIcon={<ArrowBackIcon fontSize="small" />}
                            size="small"
                            sx={{
                                alignSelf: "flex-start",
                                color: "text.secondary",
                                mb: 2,
                            }}
                        >
                            Back
                        </Button>

                        <Chip
                            label={role.label}
                            size="small"
                            sx={{
                                alignSelf: "flex-start",
                                bgcolor: "#fef0f0",
                                color: "primary.main",
                                fontWeight: 700,
                                mb: 2,
                            }}
                        />

                        <Typography variant="h6" fontWeight={700}>
                            {role.formTitle}
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 3 }}
                        >
                            {role.formSubtitle}
                        </Typography>

                        <TextField
                            id="login-email"
                            name="email"
                            label="Email"
                            type="email"
                            placeholder="Enter email"
                            autoComplete="username"
                            value={loginForm.data.email}
                            onChange={(e) =>
                                loginForm.setData("email", e.target.value)
                            }
                            error={!!loginForm.errors.email}
                            helperText={loginForm.errors.email}
                            fullWidth
                            margin="dense"
                        />
                        <TextField
                            id="login-password"
                            name="password"
                            label="Password"
                            type="password"
                            placeholder="Enter password"
                            autoComplete="current-password"
                            value={loginForm.data.password}
                            onChange={(e) =>
                                loginForm.setData("password", e.target.value)
                            }
                            error={!!loginForm.errors.password}
                            helperText={loginForm.errors.password}
                            fullWidth
                            margin="dense"
                            sx={{ mb: 1 }}
                        />

                        <Box
                            className="flex items-center justify-between"
                            sx={{ my: 1.5 }}
                        >
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={loginForm.data.remember}
                                        onChange={(e) =>
                                            loginForm.setData(
                                                "remember",
                                                e.target.checked,
                                            )
                                        }
                                    />
                                }
                                label={
                                    <Typography variant="body2">
                                        Keep me signed in
                                    </Typography>
                                }
                            />
                            <Button
                                onClick={goToForgotPassword}
                                size="small"
                                sx={{ textTransform: "none" }}
                            >
                                Forgot password?
                            </Button>
                        </Box>

                        <Button
                            type="submit"
                            variant="contained"
                            size="large"
                            disabled={loginForm.processing}
                            startIcon={
                                loginForm.processing ? (
                                    <CircularProgress
                                        size={18}
                                        color="inherit"
                                    />
                                ) : null
                            }
                        >
                            {loginForm.processing
                                ? "Signing in…"
                                : `Sign in as ${role.label}`}
                        </Button>
                    </Box>
                )}

                {/* ── STEP: forgot password — email ── */}
                {step === "fp-email" && (
                    <Box
                        component="form"
                        onSubmit={handleSendOtp}
                        className="flex flex-col gap-1"
                    >
                        <Button
                            onClick={backToLogin}
                            startIcon={<ArrowBackIcon fontSize="small" />}
                            size="small"
                            sx={{
                                alignSelf: "flex-start",
                                color: "text.secondary",
                                mb: 2,
                            }}
                        >
                            Back
                        </Button>

                        <Typography variant="h6" fontWeight={700}>
                            Forgot password
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 3 }}
                        >
                            Enter your email and we'll send you a one-time code.
                        </Typography>

                        <TextField
                            label="Email"
                            type="email"
                            placeholder="Enter email"
                            autoComplete="username"
                            value={fpEmail}
                            onChange={(e) => setFpEmail(e.target.value)}
                            error={!!fpError}
                            helperText={fpError}
                            fullWidth
                            margin="dense"
                            sx={{ mb: 2 }}
                        />

                        <Button
                            type="submit"
                            variant="contained"
                            size="large"
                            disabled={fpLoading}
                            startIcon={
                                fpLoading ? (
                                    <CircularProgress
                                        size={18}
                                        color="inherit"
                                    />
                                ) : null
                            }
                        >
                            {fpLoading ? "Sending…" : "Send code"}
                        </Button>
                    </Box>
                )}

                {/* ── STEP: forgot password — enter OTP ── */}
                {step === "fp-otp" && (
                    <Box
                        component="form"
                        onSubmit={handleVerifyOtp}
                        className="flex flex-col gap-1"
                    >
                        <Button
                            onClick={() => setStep("fp-email")}
                            startIcon={<ArrowBackIcon fontSize="small" />}
                            size="small"
                            sx={{
                                alignSelf: "flex-start",
                                color: "text.secondary",
                                mb: 2,
                            }}
                        >
                            Back
                        </Button>

                        <Typography variant="h6" fontWeight={700}>
                            Enter code
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 3 }}
                        >
                            {fpNotice || `We sent a code to ${fpEmail}.`}
                        </Typography>

                        <TextField
                            label="One-time code"
                            placeholder="Enter code"
                            value={fpOtp}
                            onChange={(e) => setFpOtp(e.target.value)}
                            error={!!fpError}
                            helperText={fpError}
                            fullWidth
                            margin="dense"
                            sx={{ mb: 2 }}
                        />

                        <Button
                            type="submit"
                            variant="contained"
                            size="large"
                            disabled={fpLoading}
                            startIcon={
                                fpLoading ? (
                                    <CircularProgress
                                        size={18}
                                        color="inherit"
                                    />
                                ) : null
                            }
                        >
                            {fpLoading ? "Verifying…" : "Verify code"}
                        </Button>

                        <Box
                            className="flex items-center justify-center"
                            sx={{ mt: 1.5 }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                Didn't get a code?
                            </Typography>
                            <Button
                                type="button"
                                onClick={handleResendOtp}
                                disabled={fpResending || fpResendCooldown > 0}
                                size="small"
                                sx={{ textTransform: "none", ml: 0.5 }}
                            >
                                {fpResending
                                    ? "Sending…"
                                    : fpResendCooldown > 0
                                      ? `Resend code (${fpResendCooldown}s)`
                                      : "Resend code"}
                            </Button>
                        </Box>
                    </Box>
                )}

                {/* ── STEP: forgot password — new password ── */}
                {step === "fp-newpw" && (
                    <Box
                        component="form"
                        onSubmit={handleResetPassword}
                        className="flex flex-col gap-1"
                    >
                        <Typography variant="h6" fontWeight={700}>
                            Set a new password
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 3 }}
                        >
                            Choose a new password for your account.
                        </Typography>

                        <TextField
                            label="New password"
                            type="password"
                            placeholder="Enter new password"
                            autoComplete="new-password"
                            value={fpPassword}
                            onChange={(e) => setFpPassword(e.target.value)}
                            fullWidth
                            margin="dense"
                        />
                        <TextField
                            label="Confirm password"
                            type="password"
                            placeholder="Re-enter new password"
                            autoComplete="new-password"
                            value={fpPasswordConfirmation}
                            onChange={(e) =>
                                setFpPasswordConfirmation(e.target.value)
                            }
                            error={!!fpError}
                            helperText={fpError}
                            fullWidth
                            margin="dense"
                            sx={{ mb: 2 }}
                        />

                        <Button
                            type="submit"
                            variant="contained"
                            size="large"
                            disabled={fpLoading}
                            startIcon={
                                fpLoading ? (
                                    <CircularProgress
                                        size={18}
                                        color="inherit"
                                    />
                                ) : null
                            }
                        >
                            {fpLoading ? "Saving…" : "Save new password"}
                        </Button>
                    </Box>
                )}

                {/* ── STEP: forgot password — success ── */}
                {step === "fp-success" && (
                    <Box className="flex flex-col gap-1">
                        <Typography variant="h6" fontWeight={700}>
                            Password updated
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 3 }}
                        >
                            Your password has been changed. You can now sign in
                            with your new password.
                        </Typography>

                        <Button
                            onClick={backToLogin}
                            variant="contained"
                            size="large"
                        >
                            Back to sign in
                        </Button>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}
