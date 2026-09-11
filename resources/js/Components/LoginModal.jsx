// resources/js/Components/LoginModal.jsx
//
// SECURITY / PHI NOTES (flagging even though not explicitly asked):
// - Credentials are sensitive. The real sign-in submit below uses Inertia's
//   useForm to POST to a Laravel route, so the server (not the client) is the
//   source of truth for authentication, session issuance, and audit logging.
//   Make sure the backend logs login attempts (success + failure, role,
//   timestamp, IP) for audit purposes, and rate-limits attempts.
// - "Keep me signed in" currently persists role + username to localStorage.
//   For a healthcare app, prefer a server-issued "remember" cookie (Laravel's
//   built-in remember-me token) over storing identifying info in
//   localStorage, since localStorage is readable by any script on the page.
//   Left as-is functionally here, but flagging for follow-up.
// - The forgot-password flow (email -> OTP -> new password) below calls the
//   real password.otp.send / password.otp.verify / password.reset routes
//   (see PasswordOtpController). The server, not this component, owns OTP
//   correctness and reset-token validity.
// - Never log username/password/OTP values to the console.

import { useState, useRef, useEffect } from 'react';
import { useForm } from '@inertiajs/react';
import {
  Dialog, DialogContent, Box, Typography, Button, IconButton,
  TextField, Checkbox, FormControlLabel, Link as MuiLink,
  LinearProgress, CircularProgress, Chip, Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import LocalHospitalOutlinedIcon from '@mui/icons-material/LocalHospitalOutlined';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';

// ─── Role config ────────────────────────────────────────────────
// TODO: confirm these against the real Laravel route names
// (e.g. route('icm.dashboard')) once the routes exist — using plain
// paths for now since this is a frontend-only conversion.
const ROLES = [
  {
    key: 'icm',
    label: 'ICM',
    title: 'Login as ICM',
    description: 'International Care Ministries — program coordination & monitoring',
    formTitle: 'ICM Portal Sign In',
    formSubtitle: 'International Care Ministries — program coordination & monitoring',
    icon: HomeWorkOutlinedIcon,
    redirectPath: '/icm/dashboard',
  },
  {
    key: 'rhu',
    label: 'RHU',
    title: 'Login as RHU',
    description: 'Rural Health Unit — patient management, sputum & contact tracing',
    formTitle: 'RHU Portal Sign In',
    formSubtitle: 'Rural Health Unit — patient management & contact tracing',
    icon: LocalHospitalOutlinedIcon,
    redirectPath: '/rhu/dashboard',
  },
  {
    key: 'provider',
    label: 'Provider',
    title: 'Login as Provider',
    description: 'X-ray & diagnostic service provider — handles registration',
    formTitle: 'Provider Portal Sign In',
    formSubtitle: 'X-ray & diagnostic service provider — results and referrals',
    icon: MedicalServicesOutlinedIcon,
    redirectPath: '/provider/dashboard',
  },
];

const RESEND_SECONDS = 60;

function csrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
}

async function apiRequest(method, url, payload) {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-CSRF-TOKEN': csrfToken(),
    },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errors = data?.errors
      ? Object.fromEntries(
          Object.entries(data.errors).map(([key, messages]) => [
            key,
            Array.isArray(messages) ? messages[0] : messages,
          ]),
        )
      : {};
    const error = new Error(data?.message ?? 'Request failed.');
    error.errors = errors;
    throw error;
  }

  return data;
}

function pwStrengthScore(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}
const STRENGTH_COLOR = ['', 'error', 'warning', 'info', 'success'];

export default function LoginModal({ open, onClose }) {
  const [step, setStep] = useState('role'); // role | login | fp-email | fp-otp | fp-newpw | fp-success
  const [role, setRole] = useState(null);

  // Main sign-in form (server-validated via Inertia). Field is `email`,
  // matching LoginRequest's expected `email` credential (not `username`).
  const loginForm = useForm({ role: '', email: '', password: '', remember: false });

  // Forgot-password flow — kept as local demo state (see security note above)
  const [fpEmail, setFpEmail] = useState('');
  const [fpEmailError, setFpEmailError] = useState('');
  const [fpSending, setFpSending] = useState(false);

  const [otp, setOtp] = useState(Array(6).fill(''));
  const [otpError, setOtpError] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [resendSecs, setResendSecs] = useState(0);
  const otpRefs = useRef([]);

  const [resetToken, setResetToken] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [newPwError, setNewPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  // Resend-OTP countdown
  useEffect(() => {
    if (resendSecs <= 0) return undefined;
    const id = setInterval(() => setResendSecs((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [resendSecs]);

  function resetAll() {
    setStep('role');
    setRole(null);
    loginForm.reset();
    loginForm.clearErrors();
    setFpEmail('');
    setFpEmailError('');
    setOtp(Array(6).fill(''));
    setOtpError('');
    setResetToken('');
    setNewPw('');
    setConfirmPw('');
    setNewPwError('');
    setResendSecs(0);
  }

  function handleClose() {
    onClose();
    // Let the close transition finish before wiping state
    setTimeout(resetAll, 200);
  }

  function selectRole(r) {
    setRole(r);
    loginForm.setData((data) => ({ ...data, role: r.key }));
    setStep('login');
  }

  function handleSignIn(e) {
    e.preventDefault();
    if (!loginForm.data.email.trim() || !loginForm.data.password.trim()) {
      // Inertia's `errors` only reflects server validation; surface a quick
      // client-side check too so empty submits don't round-trip needlessly.
      loginForm.setError({
        email: !loginForm.data.email.trim() ? 'Please enter your email.' : undefined,
        password: !loginForm.data.password.trim() ? 'Please enter your password.' : undefined,
      });
      return;
    }
    loginForm.post('/login', { preserveScroll: true });
  }

  async function handleSendOtp(e) {
    e.preventDefault();
    const val = fpEmail.trim();
    setFpEmailError('');
    if (!val) return setFpEmailError('Please enter your email address.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      return setFpEmailError('Please enter a valid email address.');
    }
    setFpSending(true);
    try {
      await apiRequest('POST', route('password.otp.send'), { email: val });
      setOtp(Array(6).fill(''));
      setOtpError('');
      setStep('fp-otp');
      setResendSecs(RESEND_SECONDS);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      setFpEmailError(err.message);
    } finally {
      setFpSending(false);
    }
  }

  function handleOtpChange(index, value) {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerifyOtp() {
    const code = otp.join('');
    setOtpError('');
    if (code.length < 6) {
      setOtpError('Please enter all 6 digits.');
      return;
    }
    setOtpVerifying(true);
    try {
      const data = await apiRequest('POST', route('password.otp.verify'), {
        email: fpEmail,
        otp: code,
      });
      setResetToken(data.reset_token);
      setNewPw('');
      setConfirmPw('');
      setNewPwError('');
      setStep('fp-newpw');
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpVerifying(false);
    }
  }

  async function handleResendOtp() {
    if (resendSecs > 0) return;
    setOtp(Array(6).fill(''));
    setOtpError('');
    otpRefs.current[0]?.focus();
    try {
      await apiRequest('POST', route('password.otp.send'), { email: fpEmail });
      setResendSecs(RESEND_SECONDS);
    } catch (err) {
      setOtpError(err.message);
    }
  }

  async function handleSaveNewPassword() {
    setNewPwError('');
    if (!newPw) return setNewPwError('Please enter a new password.');
    if (newPw.length < 8) return setNewPwError('Password must be at least 8 characters.');
    if (newPw !== confirmPw) return setNewPwError('Passwords do not match.');
    setSavingPw(true);
    try {
      await apiRequest('POST', route('password.reset'), {
        email: fpEmail,
        reset_token: resetToken,
        password: newPw,
        password_confirmation: confirmPw,
      });
      setStep('fp-success');
    } catch (err) {
      setNewPwError(err.message);
    } finally {
      setSavingPw(false);
    }
  }

  const strength = pwStrengthScore(newPw);
  const matchState = confirmPw ? (newPw === confirmPw ? 'ok' : 'err') : null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: '20px', p: { xs: 1, sm: 2 }, position: 'relative' } }}
    >
      <IconButton
        aria-label="Close"
        onClick={handleClose}
        sx={{ position: 'absolute', top: 12, right: 12, color: 'grey.400' }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>

      <DialogContent className="flex flex-col gap-1 pt-4 pb-6 px-4 sm:px-6">
        {/* Logo */}
        <Box
          className="flex items-center justify-center mx-auto mb-2"
          sx={{ width: 64, height: 64, bgcolor: 'primary.main', borderRadius: '16px' }}
        >
          <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
            <polyline
              points="2,18 8,18 12,8 16,26 20,14 24,22 28,18 34,18"
              stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </Box>

        {/* ── STEP: role selection ── */}
        {step === 'role' && (
          <Box>
            <Typography variant="h6" fontWeight={700} textAlign="center">
              Welcome to CareLink TB
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
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
                      border: '1.5px solid #e8e8e8',
                      borderRadius: '14px',
                      bgcolor: 'background.paper',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'border-color .2s, box-shadow .2s, transform .1s',
                      '&:hover': {
                        borderColor: 'primary.main',
                        boxShadow: '0 4px 20px rgba(217,79,79,0.12)',
                        transform: 'translateY(-2px)',
                        bgcolor: '#fff8f8',
                      },
                    }}
                  >
                    <Box
                      className="flex items-center justify-center"
                      sx={{ width: 52, height: 52, borderRadius: '14px', bgcolor: '#fef0f0' }}
                    >
                      <Icon sx={{ color: 'primary.main' }} />
                    </Box>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>
                        Login as {r.label}
                      </Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1.3 }}>
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
        {step === 'login' && role && (
          <Box component="form" onSubmit={handleSignIn} className="flex flex-col gap-1">
            <Button
              onClick={() => setStep('role')}
              startIcon={<ArrowBackIcon fontSize="small" />}
              size="small"
              sx={{ alignSelf: 'flex-start', color: 'text.secondary', mb: 2 }}
            >
              Back
            </Button>

            <Chip
              label={role.label}
              size="small"
              sx={{ alignSelf: 'flex-start', bgcolor: '#fef0f0', color: 'primary.main', fontWeight: 700, mb: 2 }}
            />

            <Typography variant="h6" fontWeight={700}>{role.formTitle}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {role.formSubtitle}
            </Typography>

            <TextField
              label="Email"
              type="email"
              placeholder="Enter email"
              autoComplete="username"
              value={loginForm.data.email}
              onChange={(e) => loginForm.setData('email', e.target.value)}
              error={!!loginForm.errors.email}
              helperText={loginForm.errors.email}
              fullWidth
              margin="dense"
            />
            <TextField
              label="Password"
              type="password"
              placeholder="Enter password"
              autoComplete="current-password"
              value={loginForm.data.password}
              onChange={(e) => loginForm.setData('password', e.target.value)}
              error={!!loginForm.errors.password}
              helperText={loginForm.errors.password}
              fullWidth
              margin="dense"
              sx={{ mb: 1 }}
            />

            <Box className="flex items-center justify-between" sx={{ my: 1.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={loginForm.data.remember}
                    onChange={(e) => loginForm.setData('remember', e.target.checked)}
                  />
                }
                label={<Typography variant="body2">Keep me signed in</Typography>}
              />
              <MuiLink
                component="button"
                type="button"
                variant="body2"
                underline="hover"
                onClick={() => setStep('fp-email')}
              >
                Forgot password?
              </MuiLink>
            </Box>

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loginForm.processing}
              startIcon={loginForm.processing ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {loginForm.processing ? 'Signing in…' : `Sign in as ${role.label}`}
            </Button>
          </Box>
        )}

        {/* ── STEP: forgot password — email ── */}
        {step === 'fp-email' && (
          <Box component="form" onSubmit={handleSendOtp} className="flex flex-col gap-1">
            <Button
              onClick={() => setStep('login')}
              startIcon={<ArrowBackIcon fontSize="small" />}
              size="small"
              sx={{ alignSelf: 'flex-start', color: 'text.secondary', mb: 2 }}
            >
              Back to Sign In
            </Button>
            <Typography variant="h6" fontWeight={700}>Forgot Password</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter your email address and we&apos;ll send you a 6-digit OTP to reset your password.
            </Typography>
            <TextField
              label="Email Address"
              type="email"
              placeholder="yourname@example.com"
              value={fpEmail}
              onChange={(e) => { setFpEmail(e.target.value); setFpEmailError(''); }}
              error={!!fpEmailError}
              helperText={fpEmailError}
              fullWidth
              margin="dense"
            />
            <Button
              type="submit"
              variant="contained"
              size="large"
              sx={{ mt: 2 }}
              disabled={fpSending}
              startIcon={fpSending ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {fpSending ? 'Sending…' : 'Send OTP'}
            </Button>
          </Box>
        )}

        {/* ── STEP: forgot password — OTP ── */}
        {step === 'fp-otp' && (
          <Box className="flex flex-col gap-1">
            <Button
              onClick={() => setStep('fp-email')}
              startIcon={<ArrowBackIcon fontSize="small" />}
              size="small"
              sx={{ alignSelf: 'flex-start', color: 'text.secondary', mb: 2 }}
            >
              Back
            </Button>
            <Typography variant="h6" fontWeight={700}>Enter OTP</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              We sent a 6-digit code to <strong>{fpEmail}</strong>. Enter it below.
            </Typography>

            <Box className="flex justify-center gap-2 mb-1">
              {otp.map((digit, i) => (
                <TextField
                  key={i}
                  inputRef={(el) => { otpRefs.current[i] = el; }}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  error={!!otpError}
                  inputProps={{
                    maxLength: 1,
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                    style: { textAlign: 'center', fontSize: '1.3rem', fontWeight: 700, padding: '14px 0' },
                  }}
                  sx={{ width: 52 }}
                />
              ))}
            </Box>
            {otpError && (
              <Typography variant="caption" color="error" textAlign="center" sx={{ mb: 1 }}>
                {otpError}
              </Typography>
            )}

            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ my: 1.5 }}>
              Didn&apos;t receive it?{' '}
              <MuiLink
                component="button"
                type="button"
                underline={resendSecs > 0 ? 'none' : 'hover'}
                onClick={handleResendOtp}
                sx={{ color: resendSecs > 0 ? 'text.disabled' : 'primary.main', pointerEvents: resendSecs > 0 ? 'none' : 'auto' }}
              >
                Resend OTP
              </MuiLink>
              {resendSecs > 0 && <> in <strong>{resendSecs}</strong>s</>}
            </Typography>

            <Button
              variant="contained"
              size="large"
              onClick={handleVerifyOtp}
              disabled={otpVerifying}
              startIcon={otpVerifying ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {otpVerifying ? 'Verifying…' : 'Verify OTP'}
            </Button>
          </Box>
        )}

        {/* ── STEP: forgot password — new password ── */}
        {step === 'fp-newpw' && (
          <Box className="flex flex-col gap-1">
            <Typography variant="h6" fontWeight={700}>Set New Password</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Choose a strong new password for your account.
            </Typography>

            <TextField
              label="New Password"
              type="password"
              placeholder="Enter new password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              fullWidth
              margin="dense"
            />
            <LinearProgress
              variant="determinate"
              value={(strength / 4) * 100}
              color={STRENGTH_COLOR[strength] || 'inherit'}
              sx={{ height: 4, borderRadius: 4, my: 1 }}
            />

            <TextField
              label="Confirm Password"
              type="password"
              placeholder="Re-enter new password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              fullWidth
              margin="dense"
              sx={{ mt: 1 }}
            />
            {matchState && (
              <Typography variant="caption" color={matchState === 'ok' ? 'success.main' : 'error'} sx={{ mb: 1 }}>
                {matchState === 'ok' ? '✓ Passwords match' : '✗ Passwords do not match'}
              </Typography>
            )}
            {newPwError && (
              <Typography variant="caption" color="error" sx={{ mb: 1 }}>
                {newPwError}
              </Typography>
            )}

            <Button
              variant="contained"
              size="large"
              sx={{ mt: 2 }}
              onClick={handleSaveNewPassword}
              disabled={savingPw}
              startIcon={savingPw ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {savingPw ? 'Saving…' : 'Save New Password'}
            </Button>
          </Box>
        )}

        {/* ── STEP: success ── */}
        {step === 'fp-success' && (
          <Box className="flex flex-col items-center text-center gap-1">
            <Box
              className="flex items-center justify-center mb-2"
              sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: '#eafaf1' }}
            >
              <CheckCircleOutlineIcon sx={{ color: 'success.main', fontSize: 32 }} />
            </Box>
            <Typography variant="h6" fontWeight={700}>Password Reset!</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Your password has been updated successfully. You can now sign in with your new password.
            </Typography>
            <Button variant="contained" size="large" fullWidth onClick={() => setStep('login')}>
              Back to Sign In
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
