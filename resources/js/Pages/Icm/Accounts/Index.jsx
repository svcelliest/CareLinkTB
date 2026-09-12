import { useEffect, useState } from "react";
import { Link, router, useForm, usePage } from "@inertiajs/react";
import {
    FaBan,
    FaCircleCheck,
    FaCopy,
    FaFilter,
    FaPlus,
    FaUsers,
} from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    Button,
    Card,
    EmptyState,
    Field,
    Modal,
    PageToolbar,
    SearchInput,
    StatusPill,
    controlClass,
    cx,
    readOnlyControlClass,
} from "@/Components/ui";

const roleLabels = {
    rhu: "RHU",
    provider: "Provider",
};

const roleDescriptions = {
    rhu: "RHU Staff",
    provider: "Diagnostic Provider",
};

const roleFilters = [
    { value: "all", label: "All Roles" },
    { value: "rhu", label: "RHU" },
    { value: "provider", label: "Provider" },
];

function initials(name) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
}

/**
 * A readable temporary password the coordinator can hand over verbatim. It is
 * generated in the browser purely so it can be shown and copied; the server
 * still applies `Password::defaults()` to whatever is submitted.
 */
function generatePassword() {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnopqrstuvwxyz";
    const digits = "23456789";
    const symbols = "#!@$%";
    const pool = upper + lower + digits + symbols;
    const bytes = new Uint32Array(14);
    crypto.getRandomValues(bytes);

    const characters = [
        upper[bytes[0] % upper.length],
        lower[bytes[1] % lower.length],
        digits[bytes[2] % digits.length],
        symbols[bytes[3] % symbols.length],
        ...Array.from(bytes.slice(4), (value) => pool[value % pool.length]),
    ];

    return characters.join("");
}

export default function Index({ accounts, filters, stats, municipalities }) {
    const { flash } = usePage().props;
    const [search, setSearch] = useState(filters.search ?? "");
    const [createOpen, setCreateOpen] = useState(false);
    const [statusAccount, setStatusAccount] = useState(null);
    const [statusProcessing, setStatusProcessing] = useState(false);
    const [copied, setCopied] = useState(false);

    // Organization, position and phone are not asked for here — the staff
    // member fills them in from their own profile. The controller still
    // accepts them as nullable, so omitting them is not a validation change.
    const createForm = useForm({
        name: "",
        email: "",
        role: "rhu",
        municipality: "",
        password: "",
        password_confirmation: "",
    });

    const isRhu = createForm.data.role === "rhu";

    useEffect(() => {
        if (!statusAccount) return undefined;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key === "Escape" && !statusProcessing) setStatusAccount(null);
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [statusAccount, statusProcessing]);

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
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const openCreate = () => {
        const password = generatePassword();
        createForm.clearErrors();
        createForm.setData({
            name: "",
            email: "",
            role: "rhu",
            municipality: "",
            password,
            password_confirmation: password,
        });
        setCopied(false);
        setCreateOpen(true);
    };

    const setRole = (role) => {
        // Municipality means different things per role — the catchment an RHU
        // covers, versus the place a provider's profile starts from — but the
        // selection itself carries over, so switching role does not throw away
        // a choice that is still valid.
        createForm.setData((current) => ({ ...current, role }));
    };

    const copyPassword = async () => {
        try {
            await navigator.clipboard.writeText(createForm.data.password);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    const submitCreate = (event) => {
        event.preventDefault();
        createForm.post(route("icm.accounts.store"), {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset();
                setCreateOpen(false);
            },
        });
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

    const summary = [
        { key: "total", label: "Total accounts", value: stats.total, icon: <FaUsers />, tone: "bg-[#fbeceb] text-[#b5382e]" },
        { key: "active", label: "Active", value: stats.active, icon: <FaCircleCheck />, tone: "bg-[#e9f7ef] text-[#279154]" },
        { key: "disabled", label: "Disabled", value: stats.disabled, icon: <FaBan />, tone: "bg-[#f2eeee] text-[#777]" },
    ];

    return (
        <DashboardLayout
            role="icm"
            title="Account Management"
            contentClassName="dash-content-accounts"
        >
            <section className="mx-auto w-full max-w-[1240px] font-ui">
                {flash?.success && (
                    <div
                        role="status"
                        className="mb-4 flex items-center gap-2 rounded-lg bg-ok-soft px-4 py-3 text-[13px] font-semibold text-ok"
                    >
                        <FaCircleCheck aria-hidden="true" />
                        {flash.success}
                    </div>
                )}

                <div
                    className="mb-4 grid gap-[14px] sm:grid-cols-3"
                    aria-label="Account summary"
                >
                    {summary.map((card) => (
                        <Card
                            key={card.key}
                            className="flex min-h-[74px] items-center gap-3 rounded-xl border border-[#eadfdf] px-[18px] py-[14px] shadow-[0_2px_9px_rgba(66,38,38,0.045)]"
                        >
                            <span
                                className={cx(
                                    "flex size-[38px] shrink-0 items-center justify-center rounded-[9px] text-[18px]",
                                    card.tone,
                                )}
                                aria-hidden="true"
                            >
                                {card.icon}
                            </span>
                            <div className="flex min-w-0 flex-col gap-0.5">
                                <strong className="text-[18px] leading-none font-extrabold text-[#202020]">
                                    {card.value}
                                </strong>
                                <span className="text-[10.5px] font-medium whitespace-nowrap text-[#8b8b8b]">
                                    {card.label}
                                </span>
                            </div>
                        </Card>
                    ))}
                </div>

                <Card className="overflow-hidden">
                    <PageToolbar>
                        <SearchInput
                            id="account-search"
                            value={search}
                            onChange={(value) => {
                                setSearch(value);
                                if (value === "") visit({ search: "" });
                            }}
                            placeholder="Search accounts..."
                            label="Search accounts"
                        />

                        <label className="flex items-center gap-2 rounded-lg border-[1.5px] border-line bg-white px-3.5 py-[9px] text-[13.5px] font-semibold text-[#555] focus-within:border-brand">
                            <FaFilter
                                className="size-3.5 text-[#aaa]"
                                aria-hidden="true"
                            />
                            <span className="sr-only">Filter by role</span>
                            <select
                                value={filters.role}
                                onChange={(event) =>
                                    visit({ role: event.target.value })
                                }
                                className="bg-transparent outline-none"
                            >
                                {roleFilters.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex items-center gap-2 rounded-lg border-[1.5px] border-line bg-white px-3.5 py-[9px] text-[13.5px] font-semibold text-[#555] focus-within:border-brand">
                            <span className="sr-only">Filter by status</span>
                            <select
                                value={filters.status}
                                onChange={(event) =>
                                    visit({ status: event.target.value })
                                }
                                className="bg-transparent outline-none"
                            >
                                <option value="all">All statuses</option>
                                <option value="active">Active</option>
                                <option value="disabled">Disabled</option>
                            </select>
                        </label>

                        <div className="ml-auto">
                            <Button onClick={openCreate}>
                                <FaPlus className="size-4" aria-hidden="true" />
                                Create Account
                            </Button>
                        </div>
                    </PageToolbar>

                    {accounts.data.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        {[
                                            "Account Name",
                                            "Role",
                                            "Email",
                                            "Last Login",
                                            "Status",
                                        ].map((heading) => (
                                            <th
                                                key={heading}
                                                className="border-b border-line-soft px-5 py-3 text-left text-[11px] font-bold tracking-wide text-[#bbb] uppercase"
                                            >
                                                {heading}
                                            </th>
                                        ))}
                                        <th className="border-b border-line-soft px-5 py-3 text-center text-[11px] font-bold tracking-wide text-[#bbb] uppercase">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {accounts.data.map((account) => (
                                        <tr
                                            key={account.id}
                                            className="hover:bg-[#fdf8f8]"
                                        >
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <span
                                                        aria-hidden="true"
                                                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand"
                                                    >
                                                        {initials(account.name)}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <strong className="block text-[13px] font-semibold text-ink">
                                                            {account.name}
                                                        </strong>
                                                        <span className="block text-[11px] text-muted">
                                                            {account.location ??
                                                                account.organization ??
                                                                account.account_id}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5">
                                                <span
                                                    className={cx(
                                                        "inline-block rounded-full px-3 py-[3px] text-[11px] font-bold",
                                                        account.role === "rhu"
                                                            ? "bg-info-soft text-info"
                                                            : "bg-warn-soft text-warn",
                                                    )}
                                                    title={
                                                        roleDescriptions[account.role]
                                                    }
                                                >
                                                    {roleLabels[account.role]}
                                                </span>
                                            </td>
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5 text-[13px] text-[#444]">
                                                {account.email}
                                            </td>
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5 text-[12.5px] text-muted">
                                                {account.last_login_label}
                                            </td>
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5">
                                                <StatusPill
                                                    tone={
                                                        account.is_active
                                                            ? "active"
                                                            : "disabled"
                                                    }
                                                >
                                                    {account.is_active
                                                        ? "Active"
                                                        : "Disabled"}
                                                </StatusPill>
                                            </td>
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setStatusAccount(account)
                                                    }
                                                    className={cx(
                                                        "rounded-lg border-[1.5px] px-3.5 py-1.5 text-xs font-semibold transition-colors",
                                                        account.is_active
                                                            ? "border-line text-[#555] hover:border-brand hover:text-brand"
                                                            : "border-ok/40 text-ok hover:bg-ok-soft",
                                                    )}
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
                    ) : (
                        <EmptyState
                            icon={<FaUsers />}
                            title="No accounts found"
                            description={
                                filters.search ||
                                filters.role !== "all" ||
                                filters.status !== "all"
                                    ? "Try changing your search or account filters."
                                    : "Create an RHU or provider account to get started."
                            }
                        >
                            {filters.search ||
                            filters.role !== "all" ||
                            filters.status !== "all" ? (
                                <Button
                                    variant="secondary"
                                    className="mt-2"
                                    onClick={() => {
                                        setSearch("");
                                        router.get(route("icm.accounts.index"));
                                    }}
                                >
                                    Clear filters
                                </Button>
                            ) : (
                                <Button className="mt-2" onClick={openCreate}>
                                    <FaPlus className="size-4" aria-hidden="true" />
                                    Create Account
                                </Button>
                            )}
                        </EmptyState>
                    )}

                    {accounts.links.length > 3 && (
                        <nav
                            className="flex flex-wrap items-center justify-center gap-1.5 border-t border-line-soft px-5 py-4"
                            aria-label="Account pages"
                        >
                            {accounts.links.map((link, index) =>
                                link.url ? (
                                    <Link
                                        href={link.url}
                                        key={`${link.label}-${index}`}
                                        preserveScroll
                                        className={cx(
                                            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                                            link.active
                                                ? "bg-brand text-white"
                                                : "text-muted hover:bg-shell hover:text-ink",
                                        )}
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                ) : (
                                    <span
                                        key={`${link.label}-${index}`}
                                        className="px-3 py-1.5 text-xs text-[#ccc]"
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                ),
                            )}
                        </nav>
                    )}
                </Card>
            </section>

            <Modal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                locked={createForm.processing}
                labelledBy="create-account-title"
                describedBy="create-account-description"
                className="max-w-[480px]"
            >
                <h2
                    id="create-account-title"
                    className="mb-1 text-[17px] font-bold text-ink"
                >
                    Create Account
                </h2>
                <p
                    id="create-account-description"
                    className="mb-5 text-[13px] text-muted"
                >
                    Create a new account for RHU or Provider staff.
                </p>

                <form onSubmit={submitCreate} noValidate>
                    <Field
                        label="Account Name"
                        htmlFor="account-name"
                        error={createForm.errors.name}
                    >
                        <input
                            id="account-name"
                            autoFocus
                            className={controlClass}
                            value={createForm.data.name}
                            onChange={(event) =>
                                createForm.setData("name", event.target.value)
                            }
                            placeholder="e.g. RHU Kalibo Staff"
                            autoComplete="off"
                        />
                    </Field>

                    <Field
                        label="Role"
                        htmlFor="account-role"
                        error={createForm.errors.role}
                    >
                        <select
                            id="account-role"
                            className={controlClass}
                            value={createForm.data.role}
                            onChange={(event) => setRole(event.target.value)}
                        >
                            <option value="rhu">RHU</option>
                            <option value="provider">Provider</option>
                        </select>
                    </Field>

                    {/* Municipality scopes an RHU account — it is what the
                        account may see, so it is required. A provider is not
                        scoped by it; it is recorded so the provider's profile
                        opens with its address already filled in, and stays
                        optional. */}
                    <Field
                        label={isRhu ? "Municipality" : "Municipality (optional)"}
                        htmlFor="account-municipality"
                        error={createForm.errors.municipality}
                        hint={
                            isRhu
                                ? "The municipality this RHU account covers."
                                : "Used as the starting address on this provider's profile."
                        }
                    >
                        <select
                            id="account-municipality"
                            className={controlClass}
                            value={createForm.data.municipality}
                            onChange={(event) =>
                                createForm.setData(
                                    "municipality",
                                    event.target.value,
                                )
                            }
                        >
                            <option value="">— Select Municipality —</option>
                            {municipalities.map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field
                        label="Email"
                        htmlFor="account-email"
                        error={createForm.errors.email}
                    >
                        <input
                            id="account-email"
                            type="email"
                            className={controlClass}
                            value={createForm.data.email}
                            onChange={(event) =>
                                createForm.setData(
                                    "email",
                                    event.target.value.toLowerCase(),
                                )
                            }
                            placeholder="e.g. staff@carelink.test"
                            autoComplete="off"
                        />
                    </Field>

                    <Field
                        label="Auto-generated Password"
                        htmlFor="account-password"
                        error={createForm.errors.password}
                        hint="Share this with the staff member. They can change it from their profile."
                    >
                        <div className="flex items-center gap-2">
                            <input
                                id="account-password"
                                readOnly
                                className={cx(readOnlyControlClass, "font-mono text-[13px] text-muted")}
                                value={createForm.data.password}
                                aria-label="Auto-generated password"
                            />
                            <button
                                type="button"
                                onClick={copyPassword}
                                className="flex shrink-0 items-center gap-1.5 rounded-lg border-[1.5px] border-line px-3 py-[11px] text-xs font-semibold text-[#555] transition-colors hover:border-brand hover:text-brand"
                            >
                                <FaCopy className="size-3.5" aria-hidden="true" />
                                {copied ? "Copied" : "Copy"}
                            </button>
                        </div>
                    </Field>

                    <div className="mt-1.5 flex justify-end gap-2.5">
                        <Button
                            variant="secondary"
                            onClick={() => setCreateOpen(false)}
                            disabled={createForm.processing}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createForm.processing}>
                            {createForm.processing ? "Creating…" : "Create Account"}
                        </Button>
                    </div>
                </form>
            </Modal>

            {statusAccount && (
                <div
                    className="fixed inset-0 z-500 flex items-center justify-center bg-black/45 p-4 font-ui"
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
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="account-status-title"
                        aria-describedby="account-status-description"
                        className="w-full max-w-[420px] rounded-2xl bg-white p-7 text-center shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
                    >
                        <span
                            aria-hidden="true"
                            className={cx(
                                "mx-auto mb-3 flex size-12 items-center justify-center rounded-full text-xl",
                                statusAccount.is_active
                                    ? "bg-brand-soft text-brand"
                                    : "bg-ok-soft text-ok",
                            )}
                        >
                            {statusAccount.is_active ? <FaBan /> : <FaCircleCheck />}
                        </span>
                        <h2
                            id="account-status-title"
                            className="mb-1.5 text-[17px] font-bold text-ink"
                        >
                            {statusAccount.is_active
                                ? "Disable account?"
                                : "Enable account?"}
                        </h2>
                        <p
                            id="account-status-description"
                            className="mb-5 text-[13px] text-muted"
                        >
                            {statusAccount.is_active
                                ? `${statusAccount.name} will be signed out and unable to access CareLink until this account is enabled again.`
                                : `${statusAccount.name} will regain access and can sign in with their existing credentials.`}
                        </p>
                        <div className="flex justify-center gap-2.5">
                            <Button
                                variant="secondary"
                                disabled={statusProcessing}
                                onClick={() => setStatusAccount(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                disabled={statusProcessing}
                                onClick={updateStatus}
                            >
                                {statusProcessing
                                    ? "Saving…"
                                    : statusAccount.is_active
                                      ? "Disable account"
                                      : "Enable account"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
