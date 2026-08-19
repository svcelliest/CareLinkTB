import { useEffect, useRef, useState } from "react";
import { router, useForm, usePage } from "@inertiajs/react";
import { FaCheck, FaPen, FaXmark } from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";

const roleDetails = {
    icm: {
        code: "ICM",
        label: "International Care Ministries (ICM)",
    },
    rhu: {
        code: "RHU",
        label: "Rural Health Unit (RHU)",
    },
    provider: {
        code: "PRV",
        label: "Diagnostic Provider (PRV)",
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

export default function Edit({ role }) {
    const { auth, flash, errors = {} } = usePage().props;
    const user = auth.user;
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
        address: user.address ?? "",
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
                    if (avatarInputRef.current) avatarInputRef.current.value = "";
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

    return (
        <DashboardLayout
            role={role}
            title="My Account"
            contentClassName="dash-content-profile account-profile-content"
        >
            <div className="account-profile-page">
                {flash?.success && (
                    <div className="account-profile-toast" role="status">
                        <FaCheck aria-hidden="true" />
                        {flash.success}
                    </div>
                )}

                <section className="account-profile-identity" aria-label="Account identity">
                    <div className="account-profile-avatar">
                        {avatarPreview || user.avatar_url ? (
                            <img src={avatarPreview || user.avatar_url} alt="" />
                        ) : (
                            <span>{initials(user.name)}</span>
                        )}
                        <input
                            ref={avatarInputRef}
                            id="account-avatar"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={uploadAvatar}
                            disabled={avatarProcessing}
                        />
                        <label
                            htmlFor="account-avatar"
                            className={avatarProcessing ? "uploading" : ""}
                            aria-label="Change profile photo"
                            title="Change profile photo"
                        >
                            <FaPen aria-hidden="true" />
                        </label>
                    </div>
                    <div className="account-profile-identity-copy">
                        <h2>{user.name}</h2>
                        <span>{roleDetail.code}</span>
                    </div>
                </section>

                <section className="account-profile-card" aria-labelledby="account-information-title">
                    <h2 id="account-information-title">Account Information</h2>

                    <form onSubmit={saveDetails}>
                        <div className="account-profile-fields">
                            <AccountField
                                label="Full Name"
                                name="name"
                                value={detailsForm.data.name}
                                onChange={(value) => detailsForm.setData("name", value)}
                                error={detailsForm.errors.name}
                                required
                            />
                            <AccountField
                                label="User ID"
                                name="account_id"
                                value={user.account_id}
                                disabled
                            />
                            <AccountField
                                label="Role"
                                name="role"
                                value={roleDetail.label}
                                disabled
                            />
                            <AccountField
                                label="Barangay"
                                name="address"
                                value={detailsForm.data.address}
                                onChange={(value) => detailsForm.setData("address", value)}
                                error={detailsForm.errors.address}
                                placeholder="Enter barangay and municipality"
                            />
                            <AccountField
                                label="Email Address"
                                name="email"
                                type="email"
                                value={detailsForm.data.email}
                                onChange={(value) => detailsForm.setData("email", value)}
                                error={detailsForm.errors.email}
                                required
                            />
                            <AccountField
                                label="Contact Number"
                                name="phone"
                                type="tel"
                                value={detailsForm.data.phone}
                                onChange={(value) => detailsForm.setData("phone", value)}
                                error={detailsForm.errors.phone}
                                placeholder="e.g. +63 912 345 6789"
                            />
                        </div>

                        <div className="account-profile-save-row">
                            <button type="submit" disabled={detailsForm.processing}>
                                {detailsForm.processing ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </section>

                <section className="account-security-card" aria-labelledby="password-security-title">
                    <div>
                        <h2 id="password-security-title">Password &amp; Security</h2>
                        <p>Update your account password regularly to keep your CareLink TB account secure.</p>
                    </div>
                    <button type="button" onClick={() => setPasswordOpen(true)}>
                        Change Password
                    </button>
                </section>
            </div>

            {passwordOpen && (
                <div
                    className="account-password-overlay"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closePasswordModal();
                    }}
                >
                    <section
                        className="account-password-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="change-password-title"
                    >
                        <div className="account-password-modal-header">
                            <div>
                                <h2 id="change-password-title">Change Password</h2>
                                <p>Enter your current password before choosing a new one.</p>
                            </div>
                            <button
                                type="button"
                                onClick={closePasswordModal}
                                disabled={passwordForm.processing}
                                aria-label="Close password dialog"
                            >
                                <FaXmark />
                            </button>
                        </div>

                        <form onSubmit={savePassword}>
                            <AccountField
                                label="Current Password"
                                name="current_password"
                                type="password"
                                value={passwordForm.data.current_password}
                                onChange={(value) =>
                                    passwordForm.setData("current_password", value)
                                }
                                error={passwordForm.errors.current_password}
                                autoComplete="current-password"
                                required
                                autoFocus
                            />
                            <AccountField
                                label="New Password"
                                name="password"
                                type="password"
                                value={passwordForm.data.password}
                                onChange={(value) => passwordForm.setData("password", value)}
                                error={passwordForm.errors.password}
                                autoComplete="new-password"
                                required
                            />
                            <AccountField
                                label="Confirm New Password"
                                name="password_confirmation"
                                type="password"
                                value={passwordForm.data.password_confirmation}
                                onChange={(value) =>
                                    passwordForm.setData("password_confirmation", value)
                                }
                                error={passwordForm.errors.password_confirmation}
                                autoComplete="new-password"
                                required
                            />

                            <div className="account-password-actions">
                                <button
                                    type="button"
                                    onClick={closePasswordModal}
                                    disabled={passwordForm.processing}
                                >
                                    Cancel
                                </button>
                                <button type="submit" disabled={passwordForm.processing}>
                                    {passwordForm.processing ? "Updating..." : "Update Password"}
                                </button>
                            </div>
                        </form>
                    </section>
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

function AccountField({
    label,
    name,
    type = "text",
    value,
    onChange,
    error,
    placeholder,
    autoComplete,
    required = false,
    disabled = false,
    autoFocus = false,
}) {
    return (
        <label className="account-profile-field">
            <span>{label}</span>
            <input
                type={type}
                name={name}
                value={value ?? ""}
                onChange={onChange ? (event) => onChange(event.target.value) : undefined}
                placeholder={placeholder}
                autoComplete={autoComplete}
                required={required}
                disabled={disabled}
                autoFocus={autoFocus}
                aria-invalid={Boolean(error)}
            />
            {error && <small>{error}</small>}
        </label>
    );
}
