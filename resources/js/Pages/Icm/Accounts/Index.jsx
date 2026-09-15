import { useEffect, useMemo, useRef, useState } from "react";
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
import { useLivePoll } from "@/hooks/useLivePoll";
import {
    Button,
    Card,
    EmptyState,
    Field,
    KpiCard,
    Modal,
    PageToolbar,
    SearchInput,
    StatusPill,
    controlClass,
    cx,
    readOnlyControlClass,
    selectClass,
} from "@/Components/ui";

/**
 * Pulled from the medjofinal reference (KPI cards, filters, the account
 * table, the temp-password generator, the enable/disable confirm dialog),
 * with two deliberate departures:
 *
 *  - Location picking is a real Province → Municipality → Barangay cascade
 *    over the `locations` table, not medjofinal's flat free-text municipality
 *    field. But only the *municipality* is ever submitted as `location_id` —
 *    every RHU authorization check in this app compares `location_id` by
 *    exact equality against a program's own municipality-level `location_id`,
 *    so storing a barangay here would silently lock that RHU account out of
 *    everything. Barangay is picked purely to help find the right
 *    municipality (or to double check it), never sent to the server.
 *  - "Last Login" isn't a column here — this schema has no login-tracking
 *    column at all, so it would just be a placeholder with nothing behind it.
 *    Kept "Created" instead (real data, already tracked).
 *
 * Also kept from the pre-pull version: the live poll (`useLivePoll`, so a
 * newly created/disabled account shows up for every open tab without a
 * manual refresh) and the discard-confirmation on the create dialog (not in
 * the reference, but an existing, real protective UX this page already had).
 */

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
    return String(name ?? "")
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

export default function Index({ accounts, filters, stats, locations }) {
    const { flash } = usePage().props;
    const [search, setSearch] = useState(filters.search ?? "");
    const [createOpen, setCreateOpen] = useState(false);
    const [confirmingDiscard, setConfirmingDiscard] = useState(false);
    const [statusAccount, setStatusAccount] = useState(null);
    const [statusProcessing, setStatusProcessing] = useState(false);
    const [copied, setCopied] = useState(false);
    const nameInput = useRef(null);

    useLivePoll(["accounts", "stats"]);

    const provinces = useMemo(
        () => locations.filter((location) => location.level === "province"),
        [locations],
    );

    const createForm = useForm({
        name: "",
        email: "",
        role: "rhu",
        province_id: "",
        location_id: "",
        barangay_id: "",
        password: "",
        password_confirmation: "",
    });

    const isRhu = createForm.data.role === "rhu";

    const municipalities = useMemo(() => {
        if (!createForm.data.province_id) return [];

        return locations.filter(
            (location) =>
                location.level === "municipality" &&
                String(location.parent_id) === String(createForm.data.province_id),
        );
    }, [locations, createForm.data.province_id]);

    const barangays = useMemo(
        () =>
            locations.filter(
                (location) =>
                    location.level === "barangay" &&
                    String(location.parent_id) === String(createForm.data.location_id),
            ),
        [locations, createForm.data.location_id],
    );

    useEffect(() => {
        if (!createOpen && !statusAccount) return undefined;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key !== "Escape") return;

            if (confirmingDiscard) {
                setConfirmingDiscard(false);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createOpen, statusAccount, statusProcessing, createForm.processing, confirmingDiscard]);

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
            province_id: "",
            location_id: "",
            barangay_id: "",
            password,
            password_confirmation: password,
        });
        setCopied(false);
        setCreateOpen(true);
        window.setTimeout(() => nameInput.current?.focus(), 0);
    };

    const setRole = (role) => {
        // Only an RHU account carries a location; the fields are hidden for a
        // provider, so a choice made before switching is not posted blind.
        createForm.setData((current) => ({
            ...current,
            role,
            province_id: role === "rhu" ? current.province_id : "",
            location_id: role === "rhu" ? current.location_id : "",
            barangay_id: role === "rhu" ? current.barangay_id : "",
        }));
    };

    const setProvince = (provinceId) => {
        createForm.setData((current) => ({
            ...current,
            province_id: provinceId,
            location_id: "",
            barangay_id: "",
        }));
    };

    const setMunicipality = (locationId) => {
        createForm.setData((current) => ({
            ...current,
            location_id: locationId,
            barangay_id: "",
        }));
    };

    const createFormHasInput = () =>
        createForm.data.name.trim() !== "" ||
        createForm.data.email.trim() !== "" ||
        createForm.data.location_id !== "" ||
        createForm.data.role !== "rhu";

    const discardAndClose = () => {
        setConfirmingDiscard(false);
        createForm.reset();
        createForm.clearErrors();
        setCreateOpen(false);
    };

    const requestCloseCreate = () => {
        if (createForm.processing) return;
        if (createFormHasInput()) {
            setConfirmingDiscard(true);
            return;
        }
        discardAndClose();
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
        // `province_id`/`barangay_id` are cascade-navigation state only —
        // the server only ever receives `location_id` (the municipality).
        createForm.transform(({ province_id, barangay_id, ...data }) => data);
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
        {
            key: "total",
            label: "Total Accounts",
            value: stats.total,
            sub: "RHU and provider accounts",
            icon: <FaUsers />,
            accent: { bg: "#fdecec", fg: "#c0392b" },
        },
        {
            key: "active",
            label: "Active",
            value: stats.active,
            sub: "Able to sign in",
            icon: <FaCircleCheck />,
            accent: { bg: "#edfaf3", fg: "#27ae60" },
        },
        {
            key: "disabled",
            label: "Disabled",
            value: stats.disabled,
            sub: "Sign-in switched off",
            icon: <FaBan />,
            accent: { bg: "#f2eeee", fg: "#777777" },
        },
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

                <div className="mb-4 grid gap-[14px] sm:grid-cols-3" aria-label="Account summary">
                    {summary.map((card) => (
                        <KpiCard
                            key={card.key}
                            label={card.label}
                            value={card.value}
                            sub={card.sub}
                            icon={card.icon}
                            accent={card.accent}
                        />
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
                            <FaFilter className="size-3.5 text-[#aaa]" aria-hidden="true" />
                            <span className="sr-only">Filter by role</span>
                            <select
                                value={filters.role}
                                onChange={(event) => visit({ role: event.target.value })}
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
                                onChange={(event) => visit({ status: event.target.value })}
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
                                        {["Account Name", "Role", "Email", "Created", "Status"].map(
                                            (heading) => (
                                                <th
                                                    key={heading}
                                                    className={cx(
                                                        "border-b border-line-soft px-5 py-3 text-[11px] font-bold tracking-wide text-[#bbb] uppercase",
                                                        heading === "Role" || heading === "Status"
                                                            ? "text-center"
                                                            : "text-left",
                                                    )}
                                                >
                                                    {heading}
                                                </th>
                                            ),
                                        )}
                                        <th className="border-b border-line-soft px-5 py-3 text-center text-[11px] font-bold tracking-wide text-[#bbb] uppercase">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {accounts.data.map((account) => (
                                        <tr key={account.id} className="hover:bg-[#fdf8f8]">
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
                                                            {account.location ?? account.account_id}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5 text-center">
                                                <span
                                                    className={cx(
                                                        "inline-block rounded-full px-3 py-[3px] text-[11px] font-bold",
                                                        account.role === "rhu"
                                                            ? "bg-info-soft text-info"
                                                            : "bg-warn-soft text-warn",
                                                    )}
                                                    title={roleDescriptions[account.role]}
                                                >
                                                    {roleLabels[account.role]}
                                                </span>
                                            </td>
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5 text-[13px] text-[#444]">
                                                {account.email}
                                            </td>
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5 text-[12.5px] text-muted">
                                                {account.created_at
                                                    ? new Date(account.created_at).toLocaleDateString()
                                                    : "—"}
                                            </td>
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5 text-center">
                                                <StatusPill tone={account.is_active ? "active" : "disabled"}>
                                                    {account.is_active ? "Active" : "Disabled"}
                                                </StatusPill>
                                            </td>
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setStatusAccount(account)}
                                                    className={cx(
                                                        "rounded-lg border-[1.5px] px-3.5 py-1.5 text-xs font-semibold transition-colors",
                                                        account.is_active
                                                            ? "border-line text-[#555] hover:border-brand hover:text-brand"
                                                            : "border-ok/40 text-ok hover:bg-ok-soft",
                                                    )}
                                                >
                                                    {account.is_active ? "Disable" : "Enable"}
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
                                filters.search || filters.role !== "all" || filters.status !== "all"
                                    ? "Try changing your search or account filters."
                                    : "Create an RHU or provider account to get started."
                            }
                        >
                            {filters.search || filters.role !== "all" || filters.status !== "all" ? (
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
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ) : (
                                    <span
                                        key={`${link.label}-${index}`}
                                        className="px-3 py-1.5 text-xs text-[#ccc]"
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ),
                            )}
                        </nav>
                    )}
                </Card>
            </section>

            <Modal
                open={createOpen}
                onClose={requestCloseCreate}
                locked={createForm.processing}
                labelledBy="create-account-title"
                describedBy="create-account-description"
                className="relative max-w-[520px]"
            >
                {confirmingDiscard ? (
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="account-discard-title"
                        className="absolute inset-0 z-10 flex flex-col justify-center rounded-2xl bg-white/97 p-7"
                    >
                        <h3 id="account-discard-title" className="mb-1 text-[15.5px] font-bold text-ink">
                            Discard this account?
                        </h3>
                        <p className="mb-5 text-[13px] text-muted">
                            The details you've entered for this account will be lost.
                        </p>
                        <div className="flex justify-end gap-2.5">
                            <Button variant="secondary" onClick={() => setConfirmingDiscard(false)}>
                                Keep editing
                            </Button>
                            <Button variant="danger" onClick={discardAndClose}>
                                Discard
                            </Button>
                        </div>
                    </div>
                ) : null}

                <h2 id="create-account-title" className="mb-1 text-[17px] font-bold text-ink">
                    Create Account
                </h2>
                <p id="create-account-description" className="mb-5 text-[13px] text-muted">
                    Create a new account for RHU or Provider staff.
                </p>

                <form onSubmit={submitCreate} noValidate>
                    <Field label="Account Name" htmlFor="account-name" error={createForm.errors.name}>
                        <input
                            id="account-name"
                            ref={nameInput}
                            className={controlClass}
                            value={createForm.data.name}
                            onChange={(event) => createForm.setData("name", event.target.value)}
                            placeholder="e.g. RHU Kalibo Staff"
                            autoComplete="off"
                        />
                    </Field>

                    <Field label="Role" htmlFor="account-role" error={createForm.errors.role}>
                        <select
                            id="account-role"
                            className={selectClass}
                            value={createForm.data.role}
                            onChange={(event) => setRole(event.target.value)}
                        >
                            <option value="rhu">RHU</option>
                            <option value="provider">Provider</option>
                        </select>
                    </Field>

                    {/* Location scopes an RHU account — it is what the account
                        may see, so it is required. A provider is not scoped
                        by it and sets their own address from their profile,
                        so the fields are not asked for.

                        One field, revealed a level at a time: Municipality
                        only appears once a Province is picked, and Barangay
                        only once a Municipality is picked — rather than
                        showing all three up front with the later ones merely
                        disabled. */}
                    {isRhu && (
                        <Field
                            label="Location"
                            htmlFor="account-province"
                            error={createForm.errors.location_id}
                            hint="Province narrows the list to its municipalities. Only the municipality is saved on the account — barangay is just to help confirm you picked the right one."
                        >
                            <div className="flex flex-col gap-2.5">
                                <select
                                    id="account-province"
                                    className={selectClass}
                                    value={createForm.data.province_id}
                                    onChange={(event) => setProvince(event.target.value)}
                                >
                                    <option value="">— Select Province —</option>
                                    {provinces.map((province) => (
                                        <option key={province.id} value={province.id}>
                                            {province.name}
                                        </option>
                                    ))}
                                </select>

                                {createForm.data.province_id ? (
                                    <select
                                        id="account-municipality"
                                        className={selectClass}
                                        value={createForm.data.location_id}
                                        onChange={(event) => setMunicipality(event.target.value)}
                                    >
                                        <option value="">— Select Municipality —</option>
                                        {municipalities.map((location) => (
                                            <option key={location.id} value={location.id}>
                                                {location.name}
                                            </option>
                                        ))}
                                    </select>
                                ) : null}

                                {createForm.data.location_id ? (
                                    <select
                                        id="account-barangay"
                                        className={selectClass}
                                        value={createForm.data.barangay_id}
                                        onChange={(event) =>
                                            createForm.setData("barangay_id", event.target.value)
                                        }
                                    >
                                        <option value="">— Select Barangay (optional) —</option>
                                        {barangays.map((barangay) => (
                                            <option key={barangay.id} value={barangay.id}>
                                                {barangay.name}
                                            </option>
                                        ))}
                                    </select>
                                ) : null}
                            </div>
                        </Field>
                    )}

                    <Field label="Email" htmlFor="account-email" error={createForm.errors.email}>
                        <input
                            id="account-email"
                            type="email"
                            className={controlClass}
                            value={createForm.data.email}
                            onChange={(event) =>
                                createForm.setData("email", event.target.value.toLowerCase())
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
                        <Button variant="secondary" onClick={requestCloseCreate} disabled={createForm.processing}>
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
                        if (event.target === event.currentTarget && !statusProcessing) {
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
                                statusAccount.is_active ? "bg-brand-soft text-brand" : "bg-ok-soft text-ok",
                            )}
                        >
                            {statusAccount.is_active ? <FaBan /> : <FaCircleCheck />}
                        </span>
                        <h2 id="account-status-title" className="mb-1.5 text-[17px] font-bold text-ink">
                            {statusAccount.is_active ? "Disable account?" : "Enable account?"}
                        </h2>
                        <p id="account-status-description" className="mb-5 text-[13px] text-muted">
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
                            <Button disabled={statusProcessing} onClick={updateStatus}>
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
