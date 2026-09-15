import { Link, router, useForm } from "@inertiajs/react";
import { useMemo, useState } from "react";
import {
    FaCircleCheck,
    FaCircleXmark,
    FaFilter,
    FaMagnifyingGlass,
    FaPlus,
    FaUsers,
} from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    Card,
    Field,
    Modal,
    StatusPill,
    controlClass,
    cx,
    readOnlyControlClass,
} from "@/Components/ui";
import { FormSection, StatCard } from "@/Components/rhu";

/**
 * Patient Monitoring — the treatment case list and the Treatment Enrollment
 * form from the reference.
 *
 * The enrolment form's Patient Information and Diagnostic Results are filled
 * from the selected patient's own record and are disabled throughout: the
 * server takes them from the patient row at save time and ignores anything the
 * browser sends for them, so these fields are display, not input.
 */

const statusFilters = [
    { value: "all", label: "Filter By: All" },
    { value: "active", label: "On Treatment" },
    { value: "closed", label: "Closed" },
];

const positiveCodes = [
    { code: "dssm", label: "DSSM" },
    { code: "rr", label: "RR" },
    { code: "t", label: "T" },
    { code: "tt", label: "TT" },
    { code: "ti", label: "TI" },
];

// Local calendar day, not the UTC day `toISOString()` gives (which is still
// yesterday until 8 AM in the Philippines).
const today = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export default function Index({ cases, filters, stats, enrollment, municipality }) {
    const [search, setSearch] = useState(filters.search ?? "");
    const [enrollOpen, setEnrollOpen] = useState(false);

    const visit = (next = {}) =>
        router.get(
            route("rhu.treatment.index"),
            {
                search: (next.search ?? search).trim() || undefined,
                status:
                    (next.status ?? filters.status) === "all"
                        ? undefined
                        : (next.status ?? filters.status),
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );

    return (
        <DashboardLayout role="rhu" title="Patient Monitoring">
            <div className="font-ui">
                <div className="mb-[18px] grid grid-cols-1 gap-[18px] sm:grid-cols-3">
                    <StatCard
                        label="Total enrolled patients"
                        value={stats.total}
                        accent="info"
                        icon={<FaUsers />}
                    />
                    <StatCard
                        label="On treatment"
                        value={stats.active}
                        accent="ok"
                        icon={<FaCircleCheck />}
                    />
                    <StatCard
                        label="Closed records"
                        value={stats.closed}
                        accent="brand"
                        icon={<FaCircleXmark />}
                    />
                </div>

                <Card className="overflow-hidden border border-[#e5e7eb]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb] px-4 py-3.5">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-[9px]">
                            <div className="flex w-full max-w-[360px] items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-[11px] py-[9px] focus-within:border-brand">
                                <FaMagnifyingGlass
                                    className="size-[15px] shrink-0 text-[#a2a7af]"
                                    aria-hidden="true"
                                />
                                <label htmlFor="case-search" className="sr-only">
                                    Search patients
                                </label>
                                <input
                                    id="case-search"
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") visit();
                                    }}
                                    onBlur={() => visit()}
                                    placeholder="Search patients..."
                                    className="w-full border-0 bg-transparent text-[11px] outline-none"
                                />
                            </div>

                            <div className="flex h-9 items-center gap-[7px] rounded-lg border border-[#e5e7eb] bg-white px-2.5 text-[#555]">
                                <FaFilter className="size-3.5 shrink-0 text-[#7f858d]" aria-hidden="true" />
                                <label htmlFor="case-status" className="sr-only">
                                    Filter patients
                                </label>
                                <select
                                    id="case-status"
                                    value={filters.status ?? "all"}
                                    onChange={(event) => visit({ status: event.target.value })}
                                    className="cursor-pointer border-0 bg-transparent pr-1 text-[10.5px] font-semibold text-[#555] outline-none"
                                >
                                    {statusFilters.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setEnrollOpen(true)}
                            className="inline-flex items-center gap-[7px] rounded-md border border-brand bg-brand px-3.5 py-[9px] text-[10.5px] font-bold whitespace-nowrap text-white shadow-[0_2px_5px_rgba(192,57,43,0.16)] hover:border-brand-strong hover:bg-brand-strong"
                        >
                            <FaPlus className="size-3.5" aria-hidden="true" />
                            Enroll Patient
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[780px] border-collapse">
                            <thead>
                                <tr>
                                    {[
                                        "Patient Name",
                                        "TB Case No.",
                                        "Status / Outcome",
                                        "Last Updated",
                                    ].map((heading) => (
                                        <th
                                            key={heading}
                                            className="border-b border-[#e5e7eb] bg-[#fbfafa] px-[18px] py-3 text-left text-[9px] font-extrabold tracking-[0.045em] text-[#333] uppercase"
                                        >
                                            {heading}
                                        </th>
                                    ))}
                                    <th className="w-[110px] min-w-[110px] border-b border-[#e5e7eb] bg-[#fbfafa] px-[18px] py-3 text-center text-[9px] font-extrabold tracking-[0.045em] text-[#333] uppercase">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {cases.data.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-6 py-14 text-center text-[13px] text-muted"
                                        >
                                            {stats.total === 0
                                                ? "No treatment cases yet. Enroll a diagnosed patient to open their first case."
                                                : "No cases match this search or filter."}
                                        </td>
                                    </tr>
                                ) : (
                                    cases.data.map((row) => (
                                        <tr key={row.id} className="hover:bg-[#fffafa]">
                                            <td className="border-b border-[#f0eeee] px-[18px] py-3.5 text-[11.5px] font-bold text-[#1f2937]">
                                                {row.patient_name}
                                            </td>
                                            <td className="border-b border-[#f0eeee] px-[18px] py-3.5 text-[11.5px] font-semibold whitespace-nowrap text-[#58606a]">
                                                {row.case_number}
                                            </td>
                                            <td className="border-b border-[#f0eeee] px-[18px] py-3.5 text-[11.5px]">
                                                <StatusPill
                                                    tone={row.status === "active" ? "active" : "completed"}
                                                >
                                                    {row.status === "active"
                                                        ? `On Treatment · Month ${row.current_month}`
                                                        : row.status_label}
                                                </StatusPill>
                                            </td>
                                            <td className="border-b border-[#f0eeee] px-[18px] py-3.5 text-[11.5px] text-[#666]">
                                                {row.updated_at_label}
                                            </td>
                                            <td className="border-b border-[#f0eeee] px-[18px] py-3.5 text-center">
                                                <Link
                                                    href={route("rhu.treatment.show", row.id)}
                                                    className="text-[11px] font-bold text-brand hover:underline"
                                                >
                                                    View
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {cases.last_page > 1 ? (
                        <nav
                            aria-label="Treatment case pages"
                            className="flex flex-wrap items-center justify-center gap-1.5 border-t border-[#e5e7eb] px-4 py-3"
                        >
                            {cases.links.map((link, index) => (
                                <Link
                                    key={index}
                                    href={link.url ?? "#"}
                                    preserveScroll
                                    aria-disabled={!link.url}
                                    className={cx(
                                        "rounded-md px-2.5 py-1.5 text-[11px] font-semibold",
                                        link.active
                                            ? "bg-brand text-white"
                                            : "text-[#555] hover:bg-shell",
                                        !link.url && "pointer-events-none opacity-40",
                                    )}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </nav>
                    ) : null}
                </Card>
            </div>

            <EnrollModal
                open={enrollOpen}
                onClose={() => setEnrollOpen(false)}
                enrollment={enrollment}
                municipality={municipality}
            />
        </DashboardLayout>
    );
}

function EnrollModal({ open, onClose, enrollment, municipality }) {
    // Registration date and the assigned provider are shown, not posted: the
    // server dates the registration itself and assigns the signed-in RHU.
    const form = useForm({
        patient_id: "",
        registration_group: "",
        regimen: "",
        treatment_start_date: today(),
        baseline_weight: "",
    });

    const selected = useMemo(
        () =>
            enrollment.candidates.find(
                (candidate) => String(candidate.id) === String(form.data.patient_id),
            ) ?? null,
        [enrollment.candidates, form.data.patient_id],
    );

    const close = () => {
        form.reset();
        form.clearErrors();
        onClose();
    };

    const submit = (event) => {
        event.preventDefault();
        form.post(route("rhu.treatment.store"), {
            preserveScroll: true,
            onSuccess: close,
        });
    };

    const readOnly = (value) => value || "—";

    return (
        <Modal
            open={open}
            onClose={close}
            labelledBy="enroll-title"
            locked={form.processing}
            className="max-w-[820px] p-0"
        >
            <form onSubmit={submit}>
                <header className="flex items-start justify-between gap-4 border-b border-[#e5e7eb] px-6 py-5">
                    <div>
                        <h2 id="enroll-title" className="text-base font-bold text-ink">
                            Treatment Enrollment
                        </h2>
                        <p className="mt-0.5 text-[12px] text-muted">
                            Enroll patient and create a TB treatment case
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={close}
                        aria-label="Close"
                        className="text-2xl leading-none text-muted hover:text-brand"
                    >
                        &times;
                    </button>
                </header>

                <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
                    <FormSection title="Patient Information">
                        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                            <Field
                                label="Patient"
                                htmlFor="enroll-patient"
                                className="sm:col-span-2"
                                error={form.errors.patient_id}
                                hint={
                                    enrollment.candidates.length
                                        ? "Diagnosed patients from your Patient Tracker who do not have a treatment case yet."
                                        : "No diagnosed patients are waiting for treatment enrollment."
                                }
                            >
                                <select
                                    id="enroll-patient"
                                    className={controlClass}
                                    value={form.data.patient_id}
                                    disabled={enrollment.candidates.length === 0}
                                    onChange={(event) =>
                                        form.setData("patient_id", event.target.value)
                                    }
                                >
                                    <option value="">— Select patient —</option>
                                    {enrollment.candidates.map((candidate) => (
                                        <option key={candidate.id} value={candidate.id}>
                                            {candidate.name} · {candidate.patient_code}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <ReadOnlyField
                                label="TB Case Number"
                                className="sm:col-span-2"
                                value={
                                    selected
                                        ? enrollment.next_case_number
                                        : "Generated on enrollment"
                                }
                                emphasis
                            />
                            <ReadOnlyField label="Patient Name" value={readOnly(selected?.name)} />
                            <ReadOnlyField label="Birthday" value={readOnly(selected?.birthday)} />
                            <ReadOnlyField
                                label="Address"
                                className="sm:col-span-2"
                                value={readOnly(selected?.address)}
                            />
                            <ReadOnlyField
                                label="Treatment Facility"
                                value={enrollment.treatment_facility}
                            />
                            <ReadOnlyField
                                label="Diagnostic Facility"
                                value={enrollment.diagnostic_facility}
                            />
                        </div>
                    </FormSection>

                    {/* One two-column grid, so the five positive columns pair
                        off and TB Diagnosis closes the last row. */}
                    <FormSection title="Diagnostic Results">
                        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                            {positiveCodes.map((entry) => (
                                <ReadOnlyField
                                    key={entry.code}
                                    label={entry.label}
                                    value={
                                        selected ? (selected.positives[entry.code] ? "✓" : "—") : "—"
                                    }
                                />
                            ))}
                            <ReadOnlyField
                                label="TB Diagnosis"
                                value={readOnly(selected?.tb_diagnosis)}
                            />
                        </div>
                    </FormSection>

                    <FormSection title="Treatment Enrollment">
                        {/* Row 1: the two dates. Row 2: regimen and group.
                            Row 3: the provider and the baseline weight.
                            Registration is dated today and the provider is
                            this account, so both are shown read-only; the
                            server sets them. */}
                        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                            <Field
                                label="Registration Date"
                                htmlFor="enroll-reg-date"
                                required
                                hint="Set automatically to today's date."
                            >
                                <input
                                    id="enroll-reg-date"
                                    type="date"
                                    readOnly
                                    aria-readonly="true"
                                    className={cx(readOnlyControlClass, "text-muted")}
                                    value={today()}
                                />
                            </Field>

                            <Field
                                label="Treatment Start Date"
                                htmlFor="enroll-start"
                                required
                                error={form.errors.treatment_start_date}
                            >
                                <input
                                    id="enroll-start"
                                    type="date"
                                    min={today()}
                                    className={controlClass}
                                    value={form.data.treatment_start_date}
                                    onChange={(event) =>
                                        form.setData("treatment_start_date", event.target.value)
                                    }
                                />
                            </Field>

                            <Field
                                label="Treatment Regimen"
                                htmlFor="enroll-regimen"
                                required
                                error={form.errors.regimen}
                            >
                                <select
                                    id="enroll-regimen"
                                    className={controlClass}
                                    value={form.data.regimen}
                                    onChange={(event) => form.setData("regimen", event.target.value)}
                                >
                                    <option value="">— Select treatment regimen —</option>
                                    {enrollment.regimens.map((regimen) => (
                                        <option key={regimen} value={regimen}>
                                            {regimen}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <Field
                                label="Registration Group / Type"
                                htmlFor="enroll-group"
                                required
                                error={form.errors.registration_group}
                            >
                                <select
                                    id="enroll-group"
                                    className={controlClass}
                                    value={form.data.registration_group}
                                    onChange={(event) =>
                                        form.setData("registration_group", event.target.value)
                                    }
                                >
                                    <option value="">— Select registration group —</option>
                                    {enrollment.registration_groups.map((group) => (
                                        <option key={group} value={group}>
                                            {group}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <Field
                                label="Assigned Treatment Provider"
                                htmlFor="enroll-provider"
                                required
                                hint="Assigned automatically to this RHU account."
                            >
                                <input
                                    id="enroll-provider"
                                    readOnly
                                    aria-readonly="true"
                                    className={cx(readOnlyControlClass, "text-muted")}
                                    value={enrollment.assigned_provider}
                                />
                            </Field>

                            <Field
                                label="Baseline Weight (kg)"
                                htmlFor="enroll-weight"
                                required
                                error={form.errors.baseline_weight}
                                hint="Sets the initial dose band and is kept for treatment monitoring."
                            >
                                <input
                                    id="enroll-weight"
                                    type="number"
                                    step="0.1"
                                    min="1"
                                    max="400"
                                    className={controlClass}
                                    placeholder="e.g. 52.5"
                                    value={form.data.baseline_weight}
                                    onChange={(event) =>
                                        form.setData("baseline_weight", event.target.value)
                                    }
                                />
                            </Field>
                        </div>
                    </FormSection>

                    {municipality ? null : (
                        <p role="alert" className="text-[12px] font-semibold text-brand">
                            This account has no municipality assigned, so no patients can be
                            enrolled.
                        </p>
                    )}
                </div>

                <footer className="flex justify-end gap-2.5 border-t border-[#e5e7eb] px-6 py-4">
                    <button
                        type="button"
                        onClick={close}
                        disabled={form.processing}
                        className="inline-flex items-center rounded-md border border-line bg-white px-3.5 py-[9px] text-[10.5px] font-bold whitespace-nowrap text-[#555] hover:border-brand hover:text-brand disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    {/* Same skin as the Enroll Patient button in the toolbar. */}
                    <button
                        type="submit"
                        disabled={form.processing || enrollment.candidates.length === 0}
                        className="inline-flex items-center gap-[7px] rounded-md border border-brand bg-brand px-3.5 py-[9px] text-[10.5px] font-bold whitespace-nowrap text-white shadow-[0_2px_5px_rgba(192,57,43,0.16)] hover:border-brand-strong hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {form.processing ? "Enrolling…" : "Enroll in Treatment"}
                    </button>
                </footer>
            </form>
        </Modal>
    );
}

/**
 * A field the RHU cannot type into: the value comes from the patient record and
 * is re-read server-side at save time, so this is a display row rather than a
 * disabled input that could be re-enabled from the console.
 */
function ReadOnlyField({ label, value, className = "", emphasis = false }) {
    return (
        <div className={cx("mb-0", className)}>
            <span className="mb-1.5 block text-[11.5px] font-bold text-[#555]">{label}</span>
            <p
                className={cx(
                    readOnlyControlClass,
                    emphasis ? "font-bold text-brand" : "text-muted",
                )}
            >
                {value}
            </p>
        </div>
    );
}
