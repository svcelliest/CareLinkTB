// resources/js/Components/LoginModal.jsx
import { useState, useRef, useEffect } from 'react';
import { useForm } from '@inertiajs/react';
import Groups2OutlinedIcon from '@mui/icons-material/Groups2Outlined';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
/**
 * Landing page login modal, converted from the original page's markup.
 *
 * Six screens: role selection, sign in, and the four-step password recovery
 * flow (email, one-time code, new password, confirmation).
 *
 * Authentication is real and server-owned. Sign in is an Inertia POST to
 * Laravel's `login` route, which validates the role/email/password triple,
 * rejects disabled accounts, rate limits, and redirects to the dashboard for
 * the account's role — so there is no client-side role redirect here.
 *
 * Password recovery calls the `password.otp.*` routes with fetch (the same
 * pattern LogoutModal uses) rather than Inertia visits, because an Inertia
 * redirect re-renders the page and would drop the modal's screen state
 * between steps. The code is generated, stored hashed, mailed, and checked
 * server-side; nothing here decides whether a credential or code is valid.
 *
 * Styling comes from resources/css/landing.css.
 */

/**
 * `logo` is the organisation's seal for the portal-selection card
 * (public/img/logo_img/*.png), sized by `.role-icon img` in landing.css.
 *
 * `Icon` is still an MUI icon component, used only by the small `.role-badge`
 * on the sign-in screen, whose size and colour come from `.role-badge svg`.
 * `label` is that badge's short text and is deliberately separate from
 * `portalLabel`, which titles the selection card.
 */
const ROLES = [
  {
    key: 'icm',
    label: 'ICM',
    portalLabel: 'ICM Portal',
    logo: '/img/logo_img/icm_logo.png',
    title: 'ICM Portal Sign In',
    subtitle: 'International Care Ministries — program coordination & monitoring',
    Icon: MonitorHeartOutlinedIcon,
  },
  {
    key: 'rhu',
    label: 'RHU',
    portalLabel: 'RHU Portal',
    logo: '/img/logo_img/rhu_logo.png',
    title: 'RHU Portal Sign In',
    subtitle: 'Rural Health Unit — patient management & contact tracing',
    Icon: LocalHospitalIcon,
  },
  {
    key: 'provider',
    label: 'Provider',
    portalLabel: 'Provider Portal',
    logo: '/img/logo_img/provider_logo.png',
    title: 'Provider Portal Sign In',
    subtitle: 'X-ray & diagnostic service provider — results and referrals',
    Icon: Groups2OutlinedIcon,
  },
];

const RESEND_SECONDS = 60;

/** Mirrors the server rule (Password::defaults() requires at least 8 characters). */
const MIN_PASSWORD_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST JSON to a Laravel endpoint using the page's CSRF token.
 * Returns { ok, data } so callers can read `data.errors` on a 422.
 */
async function postJson(url, payload) {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

  const response = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...(csrfToken ? { 'X-CSRF-TOKEN': csrfToken } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

/** Pull the first message for `field` out of a Laravel error response. */
function errorMessage(result, field, fallback) {
  if (result.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (result.status === 419) return 'Your session expired. Please reload the page and try again.';
  return result.data?.errors?.[field]?.[0] ?? result.data?.message ?? fallback;
}

function FieldErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function FieldError({ message, style }) {
  if (!message) return null;
  return (
    <div className="field-error visible" style={style}>
      <FieldErrorIcon />
      {message}
    </div>
  );
}

function BackButton({ onClick, children }) {
  return (
    <button type="button" className="back-btn" onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {children}
    </button>
  );
}

function pwStrengthStyle(value) {
  let score = 0;
  if (value.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  const colors = ['', '#e74c3c', '#e67e22', '#f1c40f', '#27ae60'];
  return { width: `${(score / 4) * 100}%`, background: colors[score] || '#eee' };
}

export default function LoginModal({ open, onClose }) {
  const [screen, setScreen] = useState('role');
  const [role, setRole] = useState(null);
  const overlayRef = useRef(null);

  // Sign in stays an Inertia visit: success is a server-side redirect.
  const loginForm = useForm({ role: '', email: '', password: '', remember: false });
  const [localLoginErrors, setLocalLoginErrors] = useState({});

  // Password recovery state.
  const [fpEmail, setFpEmail] = useState('');
  const [fpEmailError, setFpEmailError] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);

  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const otpRefs = useRef([]);

  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [newPwError, setNewPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  // Resend countdown
  useEffect(() => {
    if (resendCountdown <= 0) return undefined;
    const timer = setTimeout(() => setResendCountdown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Lock background scrolling while the modal is open, and close on Escape.
  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  function resetRecovery() {
    setFpEmail('');
    setFpEmailError('');
    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
    setResendCountdown(0);
    setNewPw('');
    setConfirmPw('');
    setNewPwError('');
  }

  // Reset whenever the modal closes, no matter what closed it — the X button,
  // the overlay, Escape, or the parent — so it always reopens on role select
  // rather than mid-recovery.
  useEffect(() => {
    if (open) return;
    setScreen('role');
    setRole(null);
    setLocalLoginErrors({});
    loginForm.reset();
    loginForm.clearErrors();
    resetRecovery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    // Keep the modal open while a sign in is in flight, as the loading screen
    // used to do — the submit button carries the spinner now.
    if (loginForm.processing) return;
    onClose?.();
  }

  function selectRole(nextRole) {
    setRole(nextRole);
    setLocalLoginErrors({});
    loginForm.clearErrors();
    loginForm.setData({ role: nextRole.key, email: '', password: '', remember: false });
    setScreen('form');
  }

  function goBackToRoles() {
    setScreen('role');
    setRole(null);
    setLocalLoginErrors({});
    loginForm.clearErrors();
  }

  // ── Sign in ───────────────────────────────────────────────────────────
  function handleSignIn(e) {
    e?.preventDefault();
    const errors = {};
    if (!loginForm.data.email.trim()) errors.email = 'Please enter your email address.';
    if (!loginForm.data.password.trim()) errors.password = 'Please enter your password.';
    setLocalLoginErrors(errors);
    if (Object.keys(errors).length) return;

    // `loginForm.processing` drives the submit button's spinner for the
    // duration of the request. The authentication and redirect flow is
    // entirely server-side and unchanged.
    loginForm.post(route('login'), {
      errorBag: 'login',
      preserveState: true,
      preserveScroll: true,
    });
  }

  // ── Password recovery ─────────────────────────────────────────────────
  function openForgotPassword() {
    resetRecovery();
    setFpEmail(loginForm.data.email || '');
    setScreen('fpEmail');
  }

  async function requestOtp(email) {
    return postJson(route('password.otp.send'), { email });
  }

  async function submitEmail(e) {
    e?.preventDefault();
    const value = fpEmail.trim();

    if (!value) {
      setFpEmailError('Please enter your email address.');
      return;
    }
    if (!EMAIL_PATTERN.test(value)) {
      setFpEmailError('Please enter a valid email address.');
      return;
    }

    setFpEmailError('');
    setSendingOtp(true);
    const result = await requestOtp(value);
    setSendingOtp(false);

    if (!result.ok) {
      setFpEmailError(errorMessage(result, 'email', 'Could not send a code. Please try again.'));
      return;
    }

    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
    setResendCountdown(RESEND_SECONDS);
    setScreen('fpOtp');
    setTimeout(() => otpRefs.current[0]?.focus(), 50);
  }

  async function resendOtp() {
    if (resendCountdown > 0 || sendingOtp) return;

    setOtpDigits(['', '', '', '', '', '']);
    setOtpError('');
    setSendingOtp(true);
    const result = await requestOtp(fpEmail.trim());
    setSendingOtp(false);

    if (!result.ok) {
      setOtpError(errorMessage(result, 'email', 'Could not resend the code. Please try again.'));
      return;
    }

    setResendCountdown(RESEND_SECONDS);
    otpRefs.current[0]?.focus();
  }

  function handleOtpChange(index, value) {
    if (!/^[0-9]*$/.test(value)) return;
    const next = [...otpDigits];
    next[index] = value.slice(-1);
    setOtpDigits(next);
    setOtpError('');
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  async function submitOtp() {
    const code = otpDigits.join('');
    if (code.length < 6) {
      setOtpError('Please enter all 6 digits.');
      return;
    }

    setOtpError('');
    setVerifyingOtp(true);
    // The server decides whether this code is correct, current, and unspent.
    const result = await postJson(route('password.otp.verify'), { email: fpEmail.trim(), otp: code });
    setVerifyingOtp(false);

    if (!result.ok) {
      setOtpError(errorMessage(result, 'otp', 'Incorrect OTP. Please try again.'));
      return;
    }

    setNewPw('');
    setConfirmPw('');
    setNewPwError('');
    setScreen('fpNewpw');
  }

  async function submitNewPassword() {
    if (!newPw) {
      setNewPwError('Please enter a new password.');
      return;
    }
    if (newPw.length < MIN_PASSWORD_LENGTH) {
      setNewPwError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPw !== confirmPw) {
      setNewPwError('Passwords do not match.');
      return;
    }

    setNewPwError('');
    setSavingPw(true);
    const result = await postJson(route('password.otp.reset'), {
      password: newPw,
      password_confirmation: confirmPw,
    });
    setSavingPw(false);

    if (!result.ok) {
      setNewPwError(errorMessage(result, 'password', 'Could not reset your password. Please try again.'));
      return;
    }

    setScreen('fpSuccess');
  }

  const pwMatchMsg = confirmPw
    ? newPw === confirmPw
      ? '✓ Passwords match'
      : '✗ Passwords do not match'
    : '';

  const emailError = localLoginErrors.email || loginForm.errors.email;
  const passwordError = localLoginErrors.password || loginForm.errors.password;

  return (
    <div
      id="login-overlay"
      ref={overlayRef}
      className={open ? 'active' : ''}
      style={{ display: open ? 'flex' : 'none' }}
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
    >
      <div className="login-card">
        <button type="button" className="close-btn" onClick={handleClose} aria-label="Close">
          ✕
        </button>

        <img className="login-logo" src="/img/logo_img/carelink_logo.svg" alt="CareLink TB" />

        {/* SCREEN 1: Role Selection */}
        {screen === 'role' && (
          <div className="role-screen">
            <h2>Welcome to CareLink TB</h2>
            <p className="subtitle">Select your account role to continue</p>
            <div className="role-grid">
              {ROLES.map((r) => (
                <button key={r.key} type="button" className="role-btn" onClick={() => selectRole(r)}>
                  <div className="role-icon">
                    <img src={r.logo} alt="" aria-hidden="true" />
                  </div>
                  <div className="role-info">
                    <div className="role-label">{r.portalLabel}</div>
                    <div className="role-desc">{r.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SCREEN 2: Login Form */}
        {screen === 'form' && role && (
          <form className="form-screen visible" onSubmit={handleSignIn}>
            <BackButton onClick={goBackToRoles}>Back</BackButton>

            <div className="role-badge">
              <role.Icon fontSize="inherit" />
              <span>{role.label}</span>
            </div>
            
            <h2>{role.title}</h2>
            <p className="subtitle">{role.subtitle}</p>

            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              type="email"
              id="email"
              placeholder="Enter email"
              value={loginForm.data.email}
              onChange={(e) => {
                loginForm.setData('email', e.target.value);
                setLocalLoginErrors((prev) => ({ ...prev, email: undefined }));
                loginForm.clearErrors('email');
              }}
              className={emailError ? 'input-error' : ''}
              autoComplete="username"
            />
            <FieldError message={emailError} />

            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              placeholder="Enter password"
              value={loginForm.data.password}
              onChange={(e) => {
                loginForm.setData('password', e.target.value);
                setLocalLoginErrors((prev) => ({ ...prev, password: undefined }));
                loginForm.clearErrors('password');
              }}
              className={passwordError ? 'input-error' : ''}
              autoComplete="current-password"
            />
            <FieldError message={passwordError} />

            <div className="login-row">
              <label>
                <input
                  type="checkbox"
                  id="keep-signed"
                  checked={loginForm.data.remember}
                  onChange={(e) => loginForm.setData('remember', e.target.checked)}
                />{' '}
                Keep me signed in
              </label>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  openForgotPassword();
                }}
              >
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              className={`btn-signin ${loginForm.processing ? 'loading' : ''}`}
              disabled={loginForm.processing}
            >
              Sign in
              <div className="spinner" />
            </button>
          </form>
        )}

        {/* SCREEN 3: Forgot Password — Email */}
        {screen === 'fpEmail' && (
          <form className="fp-screen visible" onSubmit={submitEmail}>
            <BackButton onClick={() => setScreen('form')}>Back to Sign In</BackButton>
            <h2>Forgot Password</h2>
            <p className="subtitle">
              Enter your email address and we&apos;ll send you a 6-digit OTP to reset your password.
            </p>
            <label className="field-label" htmlFor="fp-email">
              Email Address
            </label>
            <input
              type="email"
              id="fp-email"
              placeholder="yourname@example.com"
              value={fpEmail}
              onChange={(e) => {
                setFpEmail(e.target.value);
                setFpEmailError('');
              }}
              className={fpEmailError ? 'input-error' : ''}
            />
            <FieldError message={fpEmailError} />
            <button type="submit" className={`btn-fp ${sendingOtp ? 'loading' : ''}`} disabled={sendingOtp}>
              Send OTP
              <div className="spinner" />
            </button>
          </form>
        )}

        {/* SCREEN 4: OTP Verification */}
        {screen === 'fpOtp' && (
          <div className="fp-screen visible">
            <BackButton
              onClick={() => {
                setScreen('fpEmail');
                setResendCountdown(0);
              }}
            >
              Back
            </BackButton>
            <h2>Enter OTP</h2>
            <p className="subtitle">
              We sent a 6-digit code to <span className="fp-email-display">{fpEmail}</span>. Enter it below.
            </p>
            <div className="otp-group">
              {otpDigits.map((digit, index) => (
                <input
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  id={`otp-input-${index}`}
                  ref={(el) => {
                    otpRefs.current[index] = el;
                  }}
                  type="text"
                  maxLength="1"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className={otpError ? 'input-error' : ''}
                />
              ))}
            </div>
            <FieldError message={otpError} style={{ justifyContent: 'center' }} />

            <div className="resend-row">
              Didn&apos;t receive it?{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  resendOtp();
                }}
                className={resendCountdown > 0 ? 'disabled' : ''}
              >
                Resend OTP
              </a>
              {resendCountdown > 0 && (
                <span style={{ marginLeft: '8px' }}>
                  in <strong>{resendCountdown}</strong>s
                </span>
              )}
            </div>

            <button
              type="button"
              className={`btn-fp ${verifyingOtp ? 'loading' : ''}`}
              onClick={submitOtp}
              disabled={verifyingOtp}
            >
              Verify OTP
              <div className="spinner" />
            </button>
          </div>
        )}

        {/* SCREEN 5: Change Password */}
        {screen === 'fpNewpw' && (
          <div className="fp-screen visible">
            <h2>Set New Password</h2>
            <p className="subtitle">Choose a strong new password for your account.</p>
            <label className="field-label" htmlFor="fp-newpw">
              New Password
            </label>
            <input
              type="password"
              id="fp-newpw"
              placeholder="Enter new password"
              value={newPw}
              onChange={(e) => {
                setNewPw(e.target.value);
                setNewPwError('');
              }}
              autoComplete="new-password"
            />
            <div className="pw-strength-bar">
              <div className="pw-strength-fill" style={pwStrengthStyle(newPw)} />
            </div>

            <label className="field-label" htmlFor="fp-confirmpw">
              Confirm Password
            </label>
            <input
              type="password"
              id="fp-confirmpw"
              placeholder="Re-enter new password"
              value={confirmPw}
              onChange={(e) => {
                setConfirmPw(e.target.value);
                setNewPwError('');
              }}
              autoComplete="new-password"
            />
            {pwMatchMsg && (
              <div className={`pw-match-msg show ${pwMatchMsg.startsWith('✓') ? 'ok' : 'err'}`}>
                {pwMatchMsg}
              </div>
            )}

            <FieldError message={newPwError} />

            <button
              type="button"
              className={`btn-fp ${savingPw ? 'loading' : ''}`}
              onClick={submitNewPassword}
              disabled={savingPw}
            >
              Save New Password
              <div className="spinner" />
            </button>
          </div>
        )}

        {/* SCREEN 6: Success */}
        {screen === 'fpSuccess' && (
          <div className="fp-screen visible">
            <div className="success-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ textAlign: 'center' }}>Password Reset!</h2>
            <p className="subtitle" style={{ textAlign: 'center' }}>
              Your password has been updated successfully. You can now sign in with your new password.
            </p>
            <button
              type="button"
              className="btn-fp"
              onClick={() => {
                resetRecovery();
                setScreen(role ? 'form' : 'role');
              }}
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}