import { useEffect, useState } from "react";
import { Link, router, useForm, usePage } from "@inertiajs/react";
import {
    FaBan,
    FaCircleCheck,
    FaEnvelope,
    FaMagnifyingGlass,
    FaPlus,
    FaShieldHalved,
    FaUserPlus,
    FaUsers,
    FaXmark,
} from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { useLivePoll } from "@/hooks/useLivePoll";

const roleLabels = {
    rhu: "RHU",
    provider: "Service Provider",
};

function formatDate(value) {
    if (!value) return "";

    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(value));
}

function initials(name) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
}

export default function Index({ accounts, filters, stats, locations }) {
    const { flash } = usePage().props;
    const [search, setSearch] = useState(filters.search ?? "");
    const [createOpen, setCreateOpen] = useState(false);
    const [statusAccount, setStatusAccount] = useState(null);
    const [statusProcessing, setStatusProcessing] = useState(false);
    const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
    const createForm = useForm({
        name: "",
        email: "",
        role: "rhu",
        location_id: "",
        password: "",
        password_confirmation: "",
    });

    useLivePoll(["accounts", "stats"]);

    useEffect(() => {
        if (!createOpen && !statusAccount) return undefined;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key !== "Escape") return;

            if (discardConfirmOpen) {
                setDiscardConfirmOpen(false);
            } else if (createOpen && !createForm.processing) {
                requestCloseCreate();
            }
            if (statusAccount && !statusProcessing) setStatusAccount(null);
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [
        createOpen,
        statusAccount,
        statusProcessing,
        createForm.processing,
        discardConfirmOpen,
    ]);

    const visit = (next = {}) => {
        const nextRole = next.role ?? filters.role;
        const nextStatus = next.status ?? filters.status;
        const nextSearch = next.search ?? search;

        router.get(
            route("icm.accounts.index"),
            {
                role: nextRole === "all" ? undefined : nextRole,
                status: nextStatus === "all" ? undefined : nextStatus,
                search: nextSearch.trim() || undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const openCreate = () => {
        createForm.clearErrors();
        setCreateOpen(true);
    };

    const submitCreate = (event) => {
        event.preventDefault();
        createForm.post(route("icm.accounts.store"), {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset();
                createForm.setData("role", "rhu");
                setCreateOpen(false);
            },
        });
    };

    const createFormHasInput = () =>
        createForm.data.name.trim() !== "" ||
        createForm.data.email.trim() !== "" ||
        createForm.data.password !== "" ||
        createForm.data.password_confirmation !== "" ||
        createForm.data.role !== "rhu" ||
        createForm.data.location_id !== "";

    const closeCreate = () => {
        createForm.reset();
        createForm.setData("role", "rhu");
        createForm.clearErrors();
        setDiscardConfirmOpen(false);
        setCreateOpen(false);
    };

    const requestCloseCreate = () => {
        if (createForm.processing) return;

        if (createFormHasInput()) {
            setDiscardConfirmOpen(true);
            return;
        }

        closeCreate();
    };

    const updateStatus = () => {
        if (!statusAccount) return;

        setStatusProcessing(true);
        router.patch(
            route("icm.accounts.status", statusAccount.id),
            { active: !statusAccount.is_active },
            {
                preserveScroll: true,
                onSuccess: () => setStatusAccount(null),
                onFinish: () => setStatusProcessing(false),
            },
        );
    };

    return (
        <DashboardLayout
            role="icm"
            title="Account Management"
            contentClassName="dash-content-accounts"
        >
            <section
                className="accounts-page"
                aria-labelledby="accounts-heading"
            >
                {flash?.success && (
                    <div className="accounts-toast" role="status">
                        <FaCircleCheck aria-hidden="true" />
                        {flash.success}
                    </div>
                )}

                <div className="accounts-hero">
                    <div className="accounts-hero-copy">
                        <span className="accounts-hero-icon" aria-hidden="true">
                            <FaShieldHalved />
                        </span>
                        <div>
                            <h2 id="accounts-heading">
                                Manage partner accounts
                            </h2>
                            <p>
                                Create sign-in access for RHU and diagnostic
                                provider staff, or disable access when it is no
                                longer needed.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="accounts-create"
                        onClick={openCreate}
                    >
                        <FaUserPlus aria-hidden="true" />
                        Create account
                    </button>
                </div>

                <div className="accounts-stats" aria-label="Account summary">
                    <article>
                        <span
                            className="accounts-stat-icon total"
                            aria-hidden="true"
                        >
                            <FaUsers />
                        </span>
                        <div>
                            <strong>{stats.total}</strong>
                            <span>Total accounts</span>
                        </div>
                    </article>
                    <article>
                        <span
                            className="accounts-stat-icon active"
                            aria-hidden="true"
                        >
                            <FaCircleCheck />
                        </span>
                        <div>
                            <strong>{stats.active}</strong>
                            <span>Active</span>
                        </div>
                    </article>
                    <article>
                        <span
                            className="accounts-stat-icon disabled"
                            aria-hidden="true"
                        >
                            <FaBan />
                        </span>
                        <div>
                            <strong>{stats.disabled}</strong>
                            <span>Disabled</span>
                        </div>
                    </article>
                </div>

                <div className="accounts-card">
                    <div className="accounts-controls">
                        <form
                            className="accounts-search"
                            role="search"
                            onSubmit={(event) => {
                                event.preventDefault();
                                visit();
                            }}
                        >
                            <FaMagnifyingGlass aria-hidden="true" />
                            <label htmlFor="account-search" className="sr-only">
                                Search accounts
                            </label>
                            <input
                                id="account-search"
                                type="search"
                                placeholder="Search name, email, or organization"
                                value={search}
                                maxLength={100}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                            />
                            {search && (
                                <button
                                    type="button"
                                    className="accounts-search-clear"
                                    aria-label="Clear account search"
                                    onClick={() => {
                                        setSearch("");
                                        visit({ search: "" });
                                    }}
                                >
                                    <FaXmark />
                                </button>
                            )}
                            <button
                                type="submit"
                                className="accounts-search-submit"
                            >
                                Search
                            </button>
                        </form>

                        <div className="accounts-filters">
                            <label>
                                <span>Account type</span>
                                <select
                                    value={filters.role}
                                    onChange={(event) =>
                                        visit({ role: event.target.value })
                                    }
                                >
                                    <option value="all">
                                        All account types
                                    </option>
                                    <option value="rhu">RHU</option>
                                    <option value="provider">
                                        Service Provider
                                    </option>
                                </select>
                            </label>
                            <label>
                                <span>Status</span>
                                <select
                                    value={filters.status}
                                    onChange={(event) =>
                                        visit({ status: event.target.value })
                                    }
                                >
                                    <option value="all">All statuses</option>
                                    <option value="active">Active</option>
                                    <option value="disabled">Disabled</option>
                                </select>
                            </label>
                        </div>
                    </div>

                    {accounts.data.length ? (
                        <>
                            <div className="accounts-table-wrap">
                                <table className="accounts-table">
                                    <thead>
                                        <tr>
                                            <th>Account</th>
                                            <th>Type</th>
                                            <th>Status</th>
                                            <th>Last Online</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {accounts.data.map((account) => (
                                            <tr key={account.id}>
                                                <td>
                                                    <div className="accounts-identity">
                                                        <span aria-hidden="true">
                                                            {initials(
                                                                account.name,
                                                            )}
                                                        </span>
                                                        <div>
                                                            <strong>
                                                                {account.name}
                                                            </strong>
                                                            <small>
                                                                {account.email}
                                                            </small>
                                                            <code>
                                                                {
                                                                    account.account_id
                                                                }
                                                            </code>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span
                                                        className={`accounts-role ${account.role}`}
                                                    >
                                                        {
                                                            roleLabels[
                                                                account.role
                                                            ]
                                                        }
                                                    </span>
                                                </td>
                                                <td>
                                                    <span
                                                        className={`accounts-status ${
                                                            account.is_active
                                                                ? "active"
                                                                : "disabled"
                                                        }`}
                                                    >
                                                        <i aria-hidden="true" />
                                                        {account.is_active
                                                            ? "Active"
                                                            : "Disabled"}
                                                    </span>
                                                </td>
                                                <td className="accounts-date">
                                                    {formatDate(
                                                        account.last_login_at,
                                                    )}
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className={`accounts-status-action ${
                                                            account.is_active
                                                                ? "disable"
                                                                : "enable"
                                                        }`}
                                                        onClick={() =>
                                                            setStatusAccount(
                                                                account,
                                                            )
                                                        }
                                                    >
                                                        {account.is_active
                                                            ? "Disable"
                                                            : "Enable"}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="accounts-mobile-list">
                                {accounts.data.map((account) => (
                                    <article key={account.id}>
                                        <div className="accounts-mobile-heading">
                                            <div className="accounts-identity">
                                                <span aria-hidden="true">
                                                    {initials(account.name)}
                                                </span>
                                                <div>
                                                    <strong>
                                                        {account.name}
                                                    </strong>
                                                    <small>
                                                        {account.email}
                                                    </small>
                                                    <code>
                                                        {account.account_id}
                                                    </code>
                                                </div>
                                            </div>
                                            <span
                                                className={`accounts-status ${
                                                    account.is_active
                                                        ? "active"
                                                        : "disabled"
                                                }`}
                                            >
                                                <i aria-hidden="true" />
                                                {account.is_active
                                                    ? "Active"
                                                    : "Disabled"}
                                            </span>
                                        </div>
                                        <dl>
                                            <div>
                                                <dt>Account type</dt>
                                                <dd>
                                                    {roleLabels[account.role]}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt>Last Online</dt>
                                                <dd>
                                                    {formatDate(
                                                        account.last_login_at,
                                                    )}
                                                </dd>
                                            </div>
                                        </dl>
                                        <button
                                            type="button"
                                            className={`accounts-status-action ${
                                                account.is_active
                                                    ? "disable"
                                                    : "enable"
                                            }`}
                                            onClick={() =>
                                                setStatusAccount(account)
                                            }
                                        >
                                            {account.is_active
                                                ? "Disable account"
                                                : "Enable account"}
                                        </button>
                                    </article>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="accounts-empty">
                            <span aria-hidden="true">
                                <FaUsers />
                            </span>
                            <h3>No accounts found</h3>
                            <p>
                                {filters.search ||
                                filters.role !== "all" ||
                                filters.status !== "all"
                                    ? "Try changing your search or account filters."
                                    : "Create an RHU or provider account to get started."}
                            </p>
                            {filters.search ||
                            filters.role !== "all" ||
                            filters.status !== "all" ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearch("");
                                        router.get(route("icm.accounts.index"));
                                    }}
                                >
                                    Clear filters
                                </button>
                            ) : (
                                <button type="button" onClick={openCreate}>
                                    <FaPlus /> Create account
                                </button>
                            )}
                        </div>
                    )}

                    {accounts.links.length > 3 && (
                        <nav
                            className="accounts-pagination"
                            aria-label="Account pages"
                        >
                            {accounts.links.map((link, index) =>
                                link.url ? (
                                    <Link
                                        href={link.url}
                                        key={`${link.label}-${index}`}
                                        className={link.active ? "active" : ""}
                                        preserveScroll
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                ) : (
                                    <span
                                        key={`${link.label}-${index}`}
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                ),
                            )}
                        </nav>
                    )}
                </div>
            </section>

            {createOpen && (
                <div
                    className="accounts-modal-overlay"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            requestCloseCreate();
                        }
                    }}
                >
                    <section
                        className="accounts-create-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="create-account-title"
                    >
                        <header>
                            <div>
                                <span
                                    className="accounts-modal-icon"
                                    aria-hidden="true"
                                >
                                    <FaUserPlus />
                                </span>
                                <div>
                                    <h2 id="create-account-title">
                                        Create partner account
                                    </h2>
                                    <p>
                                        Provide the staff member’s access and
                                        organization details.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                aria-label="Close create account form"
                                disabled={createForm.processing}
                                onClick={requestCloseCreate}
                            >
                                <FaXmark />
                            </button>
                        </header>

                        <form onSubmit={submitCreate}>
                            <div className="accounts-form-scroll">
                                <section className="accounts-form-section">
                                    <h3>Account access</h3>
                                    <div className="accounts-form-grid">
                                        <AccountField
                                            label="Account Name"
                                            error={createForm.errors.name}
                                            wide
                                        >
                                            <input
                                                autoFocus
                                                value={createForm.data.name}
                                                onChange={(event) =>
                                                    createForm.setData(
                                                        "name",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="e.g. RHU Kalibo"
                                                autoComplete="name"
                                            />
                                        </AccountField>
                                        <AccountField
                                            label="Account Role"
                                            error={createForm.errors.role}
                                        >
                                            <select
                                                value={createForm.data.role}
                                                onChange={(event) => {
                                                    const nextRole =
                                                        event.target.value;
                                                    createForm.setData({
                                                        ...createForm.data,
                                                        role: nextRole,
                                                        location_id:
                                                            nextRole === "rhu"
                                                                ? createForm
                                                                      .data
                                                                      .location_id
                                                                : "",
                                                    });
                                                }}
                                            >
                                                <option value="rhu">RHU</option>
                                                <option value="provider">
                                                    Service Provider
                                                </option>
                                            </select>
                                        </AccountField>
                                        <AccountField
                                            label="Assigned Location"
                                            error={
                                                createForm.errors.location_id
                                            }
                                        >
                                            <select
                                                value={
                                                    createForm.data.location_id
                                                }
                                                disabled={
                                                    createForm.data.role !==
                                                    "rhu"
                                                }
                                                onChange={(event) =>
                                                    createForm.setData(
                                                        "location_id",
                                                        event.target.value,
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    Select a municipality
                                                </option>
                                                {locations.map((location) => (
                                                    <option
                                                        key={location.id}
                                                        value={location.id}
                                                    >
                                                        {location.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </AccountField>
                                        <AccountField
                                            label="Email Address"
                                            error={createForm.errors.email}
                                        >
                                            <input
                                                type="email"
                                                name="new-account-email"
                                                value={createForm.data.email}
                                                onChange={(event) =>
                                                    createForm.setData(
                                                        "email",
                                                        event.target.value.toLowerCase(),
                                                    )
                                                }
                                                placeholder="name@example.com"
                                                autoComplete="email"
                                            />
                                        </AccountField>
                                        <AccountField
                                            label="Temporary Password"
                                            error={createForm.errors.password}
                                        >
                                            <input
                                                type="password"
                                                name="new-account-password"
                                                value={createForm.data.password}
                                                onChange={(event) =>
                                                    createForm.setData(
                                                        "password",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="At least 8 characters"
                                                autoComplete="new-password"
                                            />
                                        </AccountField>
                                        <AccountField
                                            label="Confirm Password"
                                            error={
                                                createForm.errors
                                                    .password_confirmation
                                            }
                                        >
                                            <input
                                                type="password"
                                                name="new-account-password-confirmation"
                                                value={
                                                    createForm.data
                                                        .password_confirmation
                                                }
                                                onChange={(event) =>
                                                    createForm.setData(
                                                        "password_confirmation",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Repeat temporary password"
                                                autoComplete="new-password"
                                            />
                                        </AccountField>
                                    </div>
                                </section>

                                <div className="accounts-password-note">
                                    <FaEnvelope aria-hidden="true" />
                                    <p>
                                        Share the email address and temporary
                                        password securely with the staff member.
                                        They can change the password from their
                                        profile.
                                    </p>
                                </div>
                            </div>
                            <footer>
                                <button
                                    type="button"
                                    className="secondary"
                                    disabled={createForm.processing}
                                    onClick={requestCloseCreate}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="primary"
                                    disabled={createForm.processing}
                                >
                                    {createForm.processing
                                        ? "Creating…"
                                        : "Create account"}
                                </button>
                            </footer>
                        </form>
                    </section>
                </div>
            )}

            {discardConfirmOpen && (
                <div
                    className="accounts-modal-overlay"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setDiscardConfirmOpen(false);
                        }
                    }}
                >
                    <section
                        className="accounts-status-modal"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="discard-account-title"
                        aria-describedby="discard-account-description"
                    >
                        <span className="danger" aria-hidden="true">
                            <FaBan />
                        </span>
                        <h2 id="discard-account-title">Discard new account?</h2>
                        <p id="discard-account-description">
                            The details you’ve entered for this account will be
                            lost.
                        </p>
                        <div>
                            <button
                                type="button"
                                onClick={() => setDiscardConfirmOpen(false)}
                            >
                                Keep editing
                            </button>
                            <button
                                type="button"
                                className="danger"
                                onClick={closeCreate}
                            >
                                Discard
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {statusAccount && (
                <div
                    className="accounts-modal-overlay"
                    role="presentation"
                    onMouseDown={(event) => {
                        if (
                            event.target === event.currentTarget &&
                            !statusProcessing
                        ) {
                            setStatusAccount(null);
                        }
                    }}
                >
                    <section
                        className="accounts-status-modal"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="account-status-title"
                        aria-describedby="account-status-description"
                    >
                        <span
                            className={
                                statusAccount.is_active ? "danger" : "success"
                            }
                            aria-hidden="true"
                        >
                            {statusAccount.is_active ? (
                                <FaBan />
                            ) : (
                                <FaCircleCheck />
                            )}
                        </span>
                        <h2 id="account-status-title">
                            {statusAccount.is_active
                                ? "Disable account?"
                                : "Enable account?"}
                        </h2>
                        <p id="account-status-description">
                            {statusAccount.is_active
                                ? `${statusAccount.name} will be signed out and unable to access CareLink until this account is enabled again.`
                                : `${statusAccount.name} will regain access and can sign in with their existing credentials.`}
                        </p>
                        <div>
                            <button
                                type="button"
                                disabled={statusProcessing}
                                onClick={() => setStatusAccount(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={
                                    statusAccount.is_active
                                        ? "danger"
                                        : "success"
                                }
                                disabled={statusProcessing}
                                onClick={updateStatus}
                            >
                                {statusProcessing
                                    ? "Saving…"
                                    : statusAccount.is_active
                                      ? "Disable account"
                                      : "Enable account"}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </DashboardLayout>
    );
}

function AccountField({ label, error, wide = false, icon: Icon, children }) {
    return (
        <label className={`accounts-form-field ${wide ? "wide" : ""}`}>
            <span>
                {Icon && <Icon aria-hidden="true" />}
                {label}
            </span>
            {children}
            {error && <small>{error}</small>}
        </label>
    );
}
