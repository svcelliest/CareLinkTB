import { useEffect, useRef, useState } from "react";
import { router, useForm, usePage } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import "../../../css/app/12e-activity-reference.css";

/**
 * Account page in the reference portal's layout: identity header card,
 * two-column Account Information grid, and a Password & Security card that
 * opens the change-password dialog.
 *
 * All of the existing behaviour is retained — avatar upload with preview and
 * server-side errors, profile patch with per-field validation, and the
 * password update flow with its current-password check. The reference mockup
 * has no error or busy states; those are kept because the backend produces
 * them.
 */

/**
 * `addressPlaceholder` names what the Address field means for each role: a
 * coordinator records an office, a provider a diagnostic facility. An RHU has
 * neither — its address is derived from the municipality on the account (see
 * `derivedAddress` below), so its placeholder is never shown.
 */
const roleDetails = {
    icm: {
        code: "ICM",
        label: "International Care Ministries (ICM)",
        addressPlaceholder: "Enter Office Location",
    },
    rhu: {
        code: "RHU",
        label: "Rural Health Unit (RHU)",
        addressPlaceholder: "Enter Location",
    },
    provider: {
        code: "PRV",
        label: "Diagnostic Provider (PRV)",
        addressPlaceholder: "Enter Facility Location",
    },
};

function initials(name) {
    return (name ?? "User")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
}

function InfoField({
    label,
    name,
    type = "text",
    value,
    onChange,
    error,
    placeholder,
    autoComplete,
    required = false,
    readOnly = false,
    hint,
}) {
    return (
        <div className="account-info-row">
            <label className="account-info-label" htmlFor={`account-${name}`}>
                {label}
            </label>
            <input
                id={`account-${name}`}
                className="account-info-input"
                type={type}
                name={name}
                value={value ?? ""}
                onChange={
                    onChange
                        ? (event) => onChange(event.target.value)
                        : undefined
                }
                placeholder={placeholder}
                autoComplete={autoComplete}
                required={required}
                readOnly={readOnly}
                aria-invalid={Boolean(error)}
                aria-describedby={hint ? `account-${name}-hint` : undefined}
            />
            {error && <small className="account-info-error">{error}</small>}
            {hint && !error && (
                <small className="account-info-hint" id={`account-${name}-hint`}>
                    {hint}
                </small>
            )}
        </div>
    );
}

export default function Edit({
    role,
    derivedAddress = null,
    assignedAddress = null,
}) {
    const { auth, flash, errors = {} } = usePage().props;
    const user = auth.user;
    // An RHU's address comes from the municipality on its account, so the
    // field is shown filled and locked. The server writes the same value on
    // save, so this is a display of the stored address rather than a
    // divergence from it.
    const addressIsDerived = derivedAddress !== null;
    const roleDetail = roleDetails[role] ?? {
        code: role?.toUpperCase() ?? "USER",
        label: role ?? "CareLink User",
    };
    const avatarInputRef = useRef(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [avatarProcessing, setAvatarProcessing] = useState(false);
    const [passwordOpen, setPasswordOpen] = useState(false);

    const detailsForm = useForm({
        name: user.name ?? "",
        email: user.email ?? "",
        // Falls back to the municipality the account was created with, so a
        // provider opening this page for the first time already sees it
        // rather than being asked to name it again.
        address: user.address || assignedAddress || "",
        phone: user.phone ?? "",
    });
    const passwordForm = useForm({
        current_password: "",
        password: "",
        password_confirmation: "",
    });

    useEffect(() => {
        if (!passwordOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        const closeOnEscape = (event) => {
            if (event.key === "Escape" && !passwordForm.processing) {
                setPasswordOpen(false);
                passwordForm.clearErrors();
                passwordForm.reset();
            }
        };

        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", closeOnEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [passwordOpen, passwordForm.processing]);

    useEffect(
        () => () => {
            if (avatarPreview) URL.revokeObjectURL(avatarPreview);
        },
        [avatarPreview],
    );

    const saveDetails = (event) => {
        event.preventDefault();
        detailsForm.patch(route("profile.update"), { preserveScroll: true });
    };

    const uploadAvatar = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (avatarPreview) URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(URL.createObjectURL(file));
        setAvatarProcessing(true);

        router.post(
            route("profile.avatar.update"),
            { avatar: file },
            {
                preserveScroll: true,
                forceFormData: true,
                onError: () => setAvatarPreview(null),
                onFinish: () => {
                    setAvatarProcessing(false);
                    if (avatarInputRef.current) {
                        avatarInputRef.current.value = "";
                    }
                },
            },
        );
    };

    const closePasswordModal = () => {
        if (passwordForm.processing) return;
        setPasswordOpen(false);
        passwordForm.clearErrors();
        passwordForm.reset();
    };

    const savePassword = (event) => {
        event.preventDefault();
        passwordForm.put(route("profile.password.update"), {
            preserveScroll: true,
            onSuccess: () => {
                passwordForm.reset();
                setPasswordOpen(false);
            },
        });
    };

    const passwordError =
        passwordForm.errors.current_password ||
        passwordForm.errors.password ||
        passwordForm.errors.password_confirmation;

    return (
        <DashboardLayout
            role={role}
            title="Profile"
            contentClassName="dash-content-profile account-profile-content"
        >
            <div className="account-page">
                <div className="page-title-block">My Profile</div>

                {flash?.success && (
                    <div className="account-profile-toast" role="status">
                        {flash.success}
                    </div>
                )}

                <div className="account-header-card">
                    <div className="account-profile-row">
                        <div className="account-avatar-wrap">
                            <div className="account-avatar">
                                {avatarPreview || user.avatar_url ? (
                                    <img
                                        src={avatarPreview || user.avatar_url}
                                        alt=""
                                    />
                                ) : (
                                    <span className="account-avatar-initials">
                                        {initials(user.name)}
                                    </span>
                                )}
                            </div>
                            <label
                                htmlFor="account-avatar-upload"
                                className={`account-avatar-edit ${avatarProcessing ? "uploading" : ""}`}
                                aria-label="Change profile photo"
                                title="Change profile photo"
                            >
                                {avatarProcessing ? (
                                    <span
                                        className="action-spinner"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M12 20h9" />
                                        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                                    </svg>
                                )}
                            </label>
                            <input
                                ref={avatarInputRef}
                                id="account-avatar-upload"
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={uploadAvatar}
                                disabled={avatarProcessing}
                                style={{ display: "none" }}
                            />
                        </div>
                        <div className="account-name-block">
                            <div className="account-display-name">
                                {user.name}
                            </div>
                            <div className="account-display-role">
                                <span className="account-role-badge">
                                    {roleDetail.code}
                                </span>
                                {roleDetail.label}
                            </div>
                        </div>
                    </div>
                </div>

                <form className="account-info-card" onSubmit={saveDetails}>
                    <div className="account-info-title">
                        Account Information
                    </div>
                    <div className="account-info-grid">
                        <InfoField
                            label="Full Name"
                            name="name"
                            value={detailsForm.data.name}
                            onChange={(value) =>
                                detailsForm.setData("name", value)
                            }
                            error={detailsForm.errors.name}
                            placeholder="Enter your name"
                            required
                        />
                        <InfoField
                            label="User ID"
                            name="account_id"
                            value={user.account_id}
                            readOnly
                        />
                        <InfoField
                            label="Role"
                            name="role"
                            value={roleDetail.label}
                            readOnly
                        />
                        <InfoField
                            label="Address"
                            name="address"
                            value={
                                addressIsDerived
                                    ? derivedAddress
                                    : detailsForm.data.address
                            }
                            onChange={
                                addressIsDerived
                                    ? undefined
                                    : (value) =>
                                          detailsForm.setData("address", value)
                            }
                            error={detailsForm.errors.address}
                            placeholder={roleDetail.addressPlaceholder}
                            readOnly={addressIsDerived}
                            hint={
                                addressIsDerived
                                    ? "Set from the municipality assigned to this RHU account."
                                    : undefined
                            }
                        />
                        <InfoField
                            label="Email Address"
                            name="email"
                            type="email"
                            value={detailsForm.data.email}
                            onChange={(value) =>
                                detailsForm.setData("email", value)
                            }
                            error={detailsForm.errors.email}
                            required
                        />
                        <InfoField
                            label="Contact Number"
                            name="phone"
                            type="tel"
                            value={detailsForm.data.phone}
                            onChange={(value) =>
                                detailsForm.setData("phone", value)
                            }
                            error={detailsForm.errors.phone}
                            placeholder="e.g. +63 912 345 6789"
                        />
                    </div>
                    <div className="account-btn-row">
                        <button
                            type="submit"
                            className="account-save-btn"
                            disabled={detailsForm.processing}
                        >
                            {detailsForm.processing && (
                                <span
                                    className="action-spinner"
                                    aria-hidden="true"
                                />
                            )}
                            Save Changes
                        </button>
                    </div>
                </form>

                <div className="change-password-card">
                    <div className="change-password-header">
                        <div>
                            <div className="change-password-title">
                                Password &amp; Security
                            </div>
                            <div className="change-password-sub">
                                Update your account password regularly to keep
                                your CareLink TB account secure.
                            </div>
                        </div>
                        <button
                            type="button"
                            className="change-password-btn"
                            onClick={() => setPasswordOpen(true)}
                        >
                            Change Password
                        </button>
                    </div>
                </div>
            </div>

            {passwordOpen && (
                <div
                    className="change-password-modal-overlay visible"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closePasswordModal();
                        }
                    }}
                >
                    <form
                        className="change-password-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="change-password-title"
                        onSubmit={savePassword}
                    >
                        <h3 id="change-password-title">Change Password</h3>
                        <p>
                            Enter your current password and choose a new
                            password for your account.
                        </p>

                        <div className="cp-field">
                            <label htmlFor="cp-current-password">
                                Current Password
                            </label>
                            <input
                                id="cp-current-password"
                                type="password"
                                autoComplete="current-password"
                                placeholder="Enter current password"
                                value={passwordForm.data.current_password}
                                onChange={(event) =>
                                    passwordForm.setData(
                                        "current_password",
                                        event.target.value,
                                    )
                                }
                                required
                                autoFocus
                            />
                        </div>
                        <div className="cp-field">
                            <label htmlFor="cp-new-password">
                                New Password
                            </label>
                            <input
                                id="cp-new-password"
                                type="password"
                                autoComplete="new-password"
                                placeholder="At least 8 characters"
                                value={passwordForm.data.password}
                                onChange={(event) =>
                                    passwordForm.setData(
                                        "password",
                                        event.target.value,
                                    )
                                }
                                required
                            />
                        </div>
                        <div className="cp-field">
                            <label htmlFor="cp-confirm-password">
                                Confirm New Password
                            </label>
                            <input
                                id="cp-confirm-password"
                                type="password"
                                autoComplete="new-password"
                                placeholder="Re-enter new password"
                                value={passwordForm.data.password_confirmation}
                                onChange={(event) =>
                                    passwordForm.setData(
                                        "password_confirmation",
                                        event.target.value,
                                    )
                                }
                                required
                            />
                        </div>

                        {passwordError && (
                            <div className="change-password-error visible">
                                {passwordError}
                            </div>
                        )}

                        <div className="change-password-actions">
                            <button
                                type="button"
                                className="cp-cancel-btn"
                                onClick={closePasswordModal}
                                disabled={passwordForm.processing}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="cp-save-btn"
                                disabled={passwordForm.processing}
                            >
                                {passwordForm.processing && (
                                    <span
                                        className="action-spinner"
                                        aria-hidden="true"
                                    />
                                )}
                                Save Password
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {errors.avatar && !passwordOpen && (
                <div className="account-profile-error-toast" role="alert">
                    {errors.avatar}
                </div>
            )}
        </DashboardLayout>
    );
}
