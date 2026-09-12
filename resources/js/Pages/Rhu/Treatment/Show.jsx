import { Link, useForm } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaLock } from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    Card,
    Field,
    Modal,
    StatusPill,
    controlClass,
    cx,
    readOnlyControlClass,
    selectClass,
} from "@/Components/ui";
import {
    Alert,
    CellSub,
    CheckDropdown,
    ContactGroup,
    FactsGrid,
    FormSection,
    InfoSummary,
    MedicineBar,
    MonthButton,
    RecordTable,
    TabStrip,
    WeekCard,
    recordCellClass,
} from "@/Components/rhu";

/**
 * The treatment record, following the RHU reference's six tabs.
 *
 * Every derived figure — scheduled doses, expected tablets, adherence, the week
 * states, the month summary — arrives already computed from
 * TreatmentRecordPresenter. The one exception is the dispensing form's live
 * preview, which recalculates as the RHU types; the server recomputes all of it
 * on save, so a preview can never become the stored value.
 */

const tabs = [
    { value: "overview", label: "Patient Summary" },
    { value: "monthly", label: "Treatment Monitoring" },
    { value: "followup", label: "Follow-up Diagnostic Tests" },
    { value: "contact", label: "Contact Tracing" },
    { value: "outcome", label: "Treatment Outcome" },
    { value: "audit", label: "Audit Trail" },
];

function initials(name) {
    return String(name ?? "")
        .split(" ")
        .map((word) => word[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

/**
 * ISO date for a local calendar day. Built from the local date parts rather
 * than `toISOString()`, which renders the UTC day — in the Philippines (UTC+8)
 * that is yesterday until 8 AM, and shifts every "+7 days" back by one.
 */
function isoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

const today = () => isoDate(new Date());

/** Whole days from ISO date `a` to ISO date `b`. */
function daysBetween(a, b) {
    if (!a || !b) return 0;
    return Math.round(
        (new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000,
    );
}

const smallButton =
    "rounded-[7px] border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#4b5563] hover:border-brand hover:text-brand disabled:opacity-60";
const smallPrimaryButton =
    "rounded-[7px] border border-brand bg-brand px-2.5 py-1.5 text-[10px] font-semibold text-white hover:bg-brand-strong disabled:opacity-60";

export default function Show({
    case: record,
    timeline,
    months,
    supply,
    dispensing_history: dispensingHistory,
    followups,
    followup_schedule: followupSchedule,
    contact_tracing: contactTracing,
    acf_defaults: acfDefaults,
    current_month: currentMonth,
    audit,
    options,
}) {
    const [tab, setTab] = useState("overview");
    const [month, setMonth] = useState(currentMonth);
    const closed = record.status === "closed";

    return (
        <DashboardLayout role="rhu" title="Patient Profile">
            <div className="font-ui">
                <Link
                    href={route("rhu.treatment.index")}
                    className="mb-3.5 inline-flex items-center gap-1.5 rounded-[7px] border border-[#e5e7eb] bg-white px-3.5 py-[9px] text-[11px] font-semibold text-[#4b5563] hover:bg-[#f9fafb] hover:text-brand"
                >
                    <FaArrowLeft className="size-3" aria-hidden="true" />
                    Back to Patient List
                </Link>

                <Card className="mb-[18px] flex flex-wrap items-center justify-between gap-5 border border-[#e5e7eb] p-5">
                    <div className="flex items-center gap-3.5">
                        <div
                            className="grid size-[52px] place-items-center rounded-xl bg-brand-soft font-extrabold text-brand"
                            aria-hidden="true"
                        >
                            {initials(record.patient.name)}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-[#1f2937]">
                                {record.patient.name}
                            </h2>
                            <div className="mt-1 flex flex-wrap items-center gap-2.5">
                                <span className="text-[11.5px] font-semibold text-[#6b7280]">
                                    Case No. {record.case_number}
                                </span>
                                <StatusPill tone={closed ? "completed" : "active"}>
                                    {closed ? record.status_label : "On Treatment"}
                                </StatusPill>
                            </div>
                        </div>
                    </div>
                </Card>

                {closed ? (
                    <Alert tone="neutral">
                        This record is <b>CLOSED</b> ({record.status_label}
                        {record.outcome_date ? ` · ${record.outcome_date}` : ""}). Monitoring
                        entries are locked. Any correction requires supervisor authorization
                        and is recorded in the Audit Trail.
                    </Alert>
                ) : null}

                <Card className="mb-[18px] border border-[#e5e7eb] p-5">
                    <h3 className="mb-3.5 text-[13px] font-extrabold text-[#1f2937]">
                        6-Month Treatment Progress
                    </h3>
                    <Timeline
                        timeline={timeline}
                        options={options}
                        selected={month}
                        onSelect={(value) => {
                            setMonth(value);
                            setTab("monthly");
                        }}
                    />
                    <PhaseNotice timeline={timeline} closed={closed} options={options} />
                </Card>

                <Card className="overflow-hidden border border-[#e5e7eb]">
                    <TabStrip
                        tabs={tabs}
                        value={tab}
                        onChange={setTab}
                        label="Treatment record sections"
                    />

                    <div className="p-5">
                        {tab === "overview" ? <Overview record={record} /> : null}
                        {tab === "monthly" ? (
                            <MonthlyTab
                                record={record}
                                months={months}
                                supply={supply}
                                history={dispensingHistory}
                                month={month}
                                setMonth={setMonth}
                                currentMonth={currentMonth}
                                options={options}
                                closed={closed}
                            />
                        ) : null}
                        {tab === "followup" ? (
                            <FollowupTab
                                record={record}
                                followups={followups}
                                schedule={followupSchedule}
                                options={options}
                                closed={closed}
                            />
                        ) : null}
                        {tab === "contact" ? (
                            <ContactTab
                                record={record}
                                tracing={contactTracing}
                                defaults={acfDefaults}
                                options={options}
                                closed={closed}
                            />
                        ) : null}
                        {tab === "outcome" ? (
                            <OutcomeTab record={record} options={options} closed={closed} />
                        ) : null}
                        {tab === "audit" ? <AuditTab audit={audit} /> : null}
                    </div>
                </Card>
            </div>
        </DashboardLayout>
    );
}

/* ── 6-month timeline ──────────────────────────────────────────────────── */

function Timeline({ timeline, options, selected, onSelect }) {
    const intensive = timeline.filter((entry) => entry.month <= options.intensive_months);
    const continuation = timeline.filter((entry) => entry.month > options.intensive_months);

    // Three states, read from the record: completed (review and all four
    // weeks in), current (the one month being worked), locked (everything
    // after it). A locked month cannot be opened — the button is disabled —
    // so the sequence cannot be skipped from here any more than from the
    // month tabs below.
    const block = (title, regimen, entries, columns) => (
        <div className="rounded-[9px] border border-[#e5e7eb] p-3">
            <div className="mb-[11px] flex flex-wrap justify-between gap-2 text-[10px] font-extrabold tracking-[0.05em] text-brand uppercase">
                {title}
                <span className="font-bold tracking-normal text-[#6b7280] normal-case">
                    {regimen}
                </span>
            </div>
            <div className={cx("grid gap-1.5", columns)}>
                {entries.map((entry) => (
                    <button
                        key={entry.month}
                        type="button"
                        onClick={() => onSelect(entry.month)}
                        disabled={entry.locked}
                        aria-pressed={selected === entry.month}
                        title={
                            entry.locked
                                ? "Locked until the previous month is completed"
                                : undefined
                        }
                        className={cx(
                            "relative z-10 text-center",
                            entry.locked && "cursor-not-allowed",
                        )}
                    >
                        <span
                            className={cx(
                                "mx-auto mb-2 grid size-9 place-items-center rounded-full border-2 text-[11px] font-bold",
                                entry.completed
                                    ? "border-ok bg-ok text-white"
                                    : entry.current
                                      ? "border-brand bg-brand text-white shadow-[0_0_0_5px_var(--color-brand-soft)]"
                                      : "border-[#e5e7eb] bg-[#f9fafb] text-[#b8bec8]",
                            )}
                        >
                            {entry.completed ? "✓" : entry.locked ? <FaLock className="size-3" /> : entry.month}
                        </span>
                        <span
                            className={cx(
                                "block text-[10px] font-semibold",
                                entry.locked ? "text-[#b8bec8]" : "text-[#374151]",
                            )}
                        >
                            Month {entry.month}
                        </span>
                        <span className="block text-[9.5px] text-[#6b7280]">
                            {entry.completed
                                ? "Completed"
                                : entry.current
                                  ? "Current"
                                  : "Locked"}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
            {block("Intensive Phase", options.regimen_intensive, intensive, "grid-cols-2")}
            {block(
                "Continuation Phase",
                options.regimen_continuation,
                continuation,
                "grid-cols-2 sm:grid-cols-4",
            )}
        </div>
    );
}

function PhaseNotice({ timeline, closed, options }) {
    const intensiveDone = timeline
        .filter((entry) => entry.month <= options.intensive_months)
        .every((entry) => entry.completed);
    const firstContinuation = timeline.find(
        (entry) => entry.month === options.intensive_months + 1,
    );

    if (closed || !intensiveDone || !firstContinuation?.current) {
        return null;
    }

    return (
        <Alert tone="warning" className="mt-3.5 mb-0">
            <b>Intensive Phase completed.</b> The Continuation Phase regimen (
            {options.regimen_continuation}) must be confirmed by RHU personnel before Month{" "}
            {options.intensive_months + 1} medicine is dispensed.
        </Alert>
    );
}

/* ── tab: Patient Summary ──────────────────────────────────────────────── */

function Overview({ record }) {
    return (
        <FormSection title="Patient Summary">
            <InfoSummary
                items={[
                    { label: "Name", value: record.patient.name },
                    { label: "Gender", value: record.patient.sex ?? "—" },
                    {
                        label: "Age",
                        value: record.patient.age ? `${record.patient.age} years old` : "—",
                    },
                    { label: "Enrolled / Screened As", value: record.enrolled_as ?? "—" },
                    { label: "TB Case Number", value: record.case_number },
                    { label: "Treatment Facility", value: record.treatment_facility },
                    { label: "Diagnosing Facility", value: record.diagnostic_facility },
                    { label: "Registration Group", value: record.registration_group },
                    { label: "Registration Date", value: record.registration_date },
                    { label: "Treatment Start Date", value: record.treatment_start_date },
                    { label: "Birthday", value: record.patient.birthday },
                    { label: "Contact Number", value: record.patient.contact_number ?? "—" },
                    { label: "Treatment Regimen", value: record.regimen, full: true },
                    { label: "Address", value: record.patient.address, full: true },
                    { label: "Assigned Treatment Provider", value: record.assigned_provider },
                    { label: "Enrolled By", value: record.enrolled_by },
                    { label: "Overall Adherence", value: `${record.adherence}%` },
                    { label: "Outcome", value: record.status_label },
                ]}
            />
        </FormSection>
    );
}

/* ── tab: Treatment Monitoring ─────────────────────────────────────────── */

function MonthlyTab({
    record,
    months,
    supply,
    history,
    month,
    setMonth,
    currentMonth,
    options,
    closed,
}) {
    const data = months[month];
    const monthLocked = data.state === "locked";
    const monthCompleted = data.state === "completed";

    // The week on screen. Opens on the week now due (the first without a
    // record), or the last recorded week once the month is complete.
    const defaultWeek =
        data.weeks.find((entry) => entry.can_record)?.week ??
        data.weeks.filter((entry) => entry.record_id).at(-1)?.week ??
        1;
    const [week, setWeek] = useState(defaultWeek);
    // null = closed; { mode: "new" } records a fresh visit; { mode: "edit",
    // id } reopens the latest visit; { mode: "view", id } shows a finalized
    // one read-only.
    const [dispensing, setDispensing] = useState(null);

    useEffect(() => {
        setDispensing(null);
        setWeek(defaultWeek);
        // Re-anchor only when the month changes; the default week is derived
        // from that month's data.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month]);

    const selectedWeek = data.weeks.find((entry) => entry.week === week) ?? data.weeks[0];
    const weekRecord = selectedWeek.record_id
        ? data.history.find((row) => row.id === selectedWeek.record_id)
        : null;

    // A week can be opened once it is recorded, or while it is the one now
    // due. Anything after that stays locked until the week before it is in.
    const weekLocked = (entry) => !entry.record_id && !entry.can_record;

    return (
        <>
            <div className="mb-5 flex flex-wrap gap-[7px] overflow-x-auto">
                {Array.from({ length: options.total_months }, (_, index) => index + 1).map(
                    (value) => (
                        <MonthButton
                            key={value}
                            month={value}
                            active={value === month}
                            complete={months[value].state === "completed"}
                            locked={months[value].state === "locked"}
                            onClick={() => setMonth(value)}
                        />
                    ),
                )}
            </div>

            {monthLocked ? (
                <Alert tone="neutral" className="mb-0">
                    <b>Month {month} is locked.</b> Complete Month {currentMonth} — save its
                    clinical review and record all four weekly dispensings — to unlock it.
                </Alert>
            ) : (
                <>
                    <ClinicalReview
                        key={`review-${month}-${data.review.review_date ?? ""}-${data.review.weight_kg ?? ""}-${data.review.confirmed_dose ?? ""}`}
                        record={record}
                        data={data}
                        month={month}
                        currentMonth={currentMonth}
                        options={options}
                        closed={closed}
                    />

                    {monthCompleted ? (
                        <Alert tone="success" className="mb-4">
                            <b>Month {month} is completed.</b> Its review and weekly records
                            are kept for viewing and can no longer be edited.
                        </Alert>
                    ) : null}

                    <FormSection title="Week of Medication Dispensing">
                        {/* The four week boxes. Clicking one selects it — the
                            Medicine Tracker and Week Summary below follow the
                            selection. A locked week cannot be selected, so the
                            only way to Week 3 is through Week 2. */}
                        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                            {data.weeks.map((entry) => (
                                <WeekCard
                                    key={entry.week}
                                    week={entry}
                                    selected={entry.week === week}
                                    locked={weekLocked(entry)}
                                    onSelect={() => setWeek(entry.week)}
                                >
                                    {entry.can_record ? (
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setWeek(entry.week);
                                                setDispensing({ mode: "new" });
                                            }}
                                            className={cx(smallPrimaryButton, "mt-[7px]")}
                                        >
                                            Record
                                        </button>
                                    ) : null}
                                    {entry.can_edit ? (
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setWeek(entry.week);
                                                setDispensing({
                                                    mode: "edit",
                                                    id: entry.record_id,
                                                });
                                            }}
                                            className={cx(smallButton, "mt-[7px]")}
                                        >
                                            Edit
                                        </button>
                                    ) : entry.can_view ? (
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setWeek(entry.week);
                                                setDispensing({
                                                    mode: "view",
                                                    id: entry.record_id,
                                                });
                                            }}
                                            className={cx(smallButton, "mt-[7px]")}
                                        >
                                            View
                                        </button>
                                    ) : null}
                                </WeekCard>
                            ))}
                        </div>

                        {data.dispensing_form.needs_review && !closed && !monthCompleted ? (
                            <Alert tone="neutral" className="mt-3.5 mb-0">
                                Save the Monthly Clinical Review first so the RHU-prescribed
                                dose is confirmed.
                            </Alert>
                        ) : null}
                    </FormSection>

                    <Modal
                        open={dispensing !== null}
                        onClose={() => setDispensing(null)}
                        labelledBy="dispensing-title"
                        className="max-w-[820px] p-0"
                    >
                        {dispensing !== null ? (
                            <DispensingForm
                                key={`dispensing-${month}-${dispensing.mode}-${dispensing.id ?? "new"}`}
                                record={record}
                                data={data}
                                month={month}
                                editingId={dispensing.mode === "new" ? null : dispensing.id}
                                readOnly={dispensing.mode === "view"}
                                options={options}
                                onClose={() => setDispensing(null)}
                            />
                        ) : null}
                    </Modal>

                    {/* The tracker for the selected week's strip: live for the
                        latest visit, frozen at the following visit otherwise. */}
                    <FormSection title={`Medicine Tracker · Week ${week}`}>
                        <MedicineTracker
                            supply={selectedWeek.supply}
                            week={selectedWeek}
                            options={options}
                        />
                    </FormSection>

                    <FormSection title={`Week ${week} Summary`}>
                        <FactsGrid
                            boxed={false}
                            items={[
                                { label: "Treatment Phase", value: data.summary.phase },
                                {
                                    label: "Dispensing Date",
                                    value: weekRecord?.date_full_label ?? "—",
                                },
                                {
                                    label: "Dose",
                                    value: weekRecord ? `${weekRecord.dose} tablets/day` : "—",
                                },
                                {
                                    label: "Medicine Dispensed",
                                    value: weekRecord
                                        ? `${weekRecord.weekly_supply} tablets`
                                        : "—",
                                },
                                {
                                    label: "Scheduled Doses",
                                    value: weekRecord ? String(weekRecord.scheduled) : "—",
                                },
                                {
                                    label: "Doses Taken",
                                    value: weekRecord ? String(weekRecord.doses_taken) : "—",
                                },
                                {
                                    label: "Missed Doses",
                                    value: weekRecord ? String(weekRecord.missed) : "—",
                                },
                                {
                                    label: "Adherence",
                                    value:
                                        weekRecord?.adherence === null ||
                                        weekRecord?.adherence === undefined
                                            ? "—"
                                            : `${weekRecord.adherence}%`,
                                },
                                {
                                    label: "Side Effects",
                                    value: weekRecord
                                        ? weekRecord.side_effects.length
                                            ? weekRecord.side_effects.join(", ")
                                            : "None"
                                        : "—",
                                },
                                {
                                    label: "Next Dispensing",
                                    value: weekRecord?.next_label ?? "—",
                                },
                            ]}
                        />
                    </FormSection>
                </>
            )}

            {/* The permanent record: every dispensing across the whole
                treatment, regardless of the month or week selected above. */}
            <FormSection title="Medication Dispensing History" className="mt-7">
                <RecordTable
                    headings={[
                        "Month / Week",
                        "Dispensing Date",
                        "Dose",
                        "Medicine",
                        "Balance",
                        "Next Dispensing",
                        "Adherence",
                    ]}
                >
                    {history.length === 0 ? (
                        <tr>
                            <td
                                colSpan={7}
                                className="border-t border-[#e5e7eb] px-2.5 py-7 text-center text-[11.5px] text-[#b8bec8]"
                            >
                                No medication dispensing has been recorded yet.
                            </td>
                        </tr>
                    ) : (
                        history.map((row) => (
                            <tr key={row.id}>
                                <td className={cx(recordCellClass, "font-bold")}>
                                    Month {row.month} · Week {row.week}
                                </td>
                                <td className={recordCellClass}>{row.date_full_label}</td>
                                <td className={recordCellClass}>{row.dose} tabs/day</td>
                                <td className={recordCellClass}>{row.weekly_supply} tablets</td>
                                <td className={recordCellClass}>
                                    Expected {row.expected ?? "—"} · Actual {row.actual ?? "—"}
                                    {row.mismatch ? (
                                        <CellSub tone="red">⚠ Count mismatch</CellSub>
                                    ) : null}
                                </td>
                                <td className={recordCellClass}>{row.next_label}</td>
                                <td className={recordCellClass}>
                                    {row.adherence === null ? "—" : `${row.adherence}%`}
                                    <CellSub>{row.missed} missed</CellSub>
                                </td>
                            </tr>
                        ))
                    )}
                </RecordTable>
            </FormSection>
        </>
    );
}

function ClinicalReview({ record, data, month, currentMonth, options, closed }) {
    const review = data.review;
    const [editing, setEditing] = useState(false);

    const form = useForm({
        month,
        review_date: review.review_date ?? today(),
        weight_kg: review.weight_kg ?? "",
        confirmed_dose: review.shown_dose ?? options.doses[0],
        reviewed_by_name: review.reviewed_by_name || options.current_user,
        clinical_status: review.clinical_status ?? "",
        remarks: review.remarks ?? "",
    });

    // Only the current month is editable. A later month is locked (the tab
    // never opens it, but the guard stays) and a completed month is
    // finalized: shown, never reopened.
    const notDue = data.state === "locked";
    const finalized = data.state === "completed";
    const locked = closed || notDue || finalized || (data.saved && !editing);

    // The weight-band advisory, previewed live against the dose selected now.
    const band = useMemo(() => {
        const weight = Number(form.data.weight_kg);
        if (form.data.weight_kg === "" || Number.isNaN(weight)) return null;
        const indicated = weight <= 37 ? 2 : weight <= 54 ? 3 : weight <= 70 ? 4 : 5;
        return indicated === Number(form.data.confirmed_dose)
            ? null
            : { indicated, weight };
    }, [form.data.weight_kg, form.data.confirmed_dose]);

    const submit = (event) => {
        event.preventDefault();
        form.patch(route("rhu.treatment.monitoring.update", record.id), {
            preserveScroll: true,
            onSuccess: () => setEditing(false),
        });
    };

    return (
        <form onSubmit={submit}>
            <FormSection title="Monthly Clinical Review" tag={data.phase}>
                <FactsGrid
                    items={[
                        {
                            label: "Treatment Month",
                            value: `Month ${month} of ${options.total_months}`,
                        },
                        {
                            label: "Baseline Weight",
                            value: record.baseline_weight
                                ? `${record.baseline_weight} kg`
                                : "—",
                        },
                        month > 1 && {
                            label: "Previous Month Weight",
                            value: review.previous_weight
                                ? `${review.previous_weight} kg`
                                : "—",
                        },
                        {
                            label: "Current Confirmed Dose",
                            value: review.shown_dose ? `${review.shown_dose} tablets/day` : "—",
                        },
                        { label: "Current Regimen", value: data.regimen },
                    ]}
                />

                {notDue ? (
                    <Alert tone="neutral" className="mt-4 mb-0">
                        Month {month} is locked — complete Month {currentMonth} first.
                    </Alert>
                ) : null}

                <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                    <Field
                        label="Current Weight (kg)"
                        htmlFor="rv-weight"
                        error={form.errors.weight_kg}
                    >
                        <input
                            id="rv-weight"
                            type="number"
                            step="0.1"
                            min="1"
                            className={controlClass}
                            disabled={locked}
                            value={form.data.weight_kg}
                            onChange={(event) => form.setData("weight_kg", event.target.value)}
                        />
                    </Field>

                    <Field
                        label="Prescribed Dose (RHU)"
                        htmlFor="rv-dose"
                        error={form.errors.confirmed_dose}
                    >
                        <select
                            id="rv-dose"
                            className={selectClass}
                            disabled={locked}
                            value={form.data.confirmed_dose}
                            onChange={(event) =>
                                form.setData("confirmed_dose", Number(event.target.value))
                            }
                        >
                            {options.doses.map((dose) => (
                                <option key={dose} value={dose}>
                                    {dose} tablets/day
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field
                        label="RHU Personnel"
                        htmlFor="rv-personnel"
                        error={form.errors.reviewed_by_name}
                    >
                        <input
                            id="rv-personnel"
                            className={controlClass}
                            disabled={locked}
                            placeholder="Enter RHU personnel name"
                            value={form.data.reviewed_by_name}
                            onChange={(event) =>
                                form.setData("reviewed_by_name", event.target.value)
                            }
                        />
                    </Field>

                    <Field
                        label="Clinical Status"
                        htmlFor="rv-status"
                        error={form.errors.clinical_status}
                    >
                        <select
                            id="rv-status"
                            className={selectClass}
                            disabled={locked}
                            value={form.data.clinical_status}
                            onChange={(event) =>
                                form.setData("clinical_status", event.target.value)
                            }
                        >
                            <option value="">— Select clinical status —</option>
                            {options.clinical_statuses.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field
                        label="Remarks"
                        htmlFor="rv-remarks"
                        className="sm:col-span-2 xl:col-span-3"
                        error={form.errors.remarks}
                    >
                        <textarea
                            id="rv-remarks"
                            rows={3}
                            className={cx(controlClass, "resize-y")}
                            disabled={locked}
                            value={form.data.remarks}
                            onChange={(event) => form.setData("remarks", event.target.value)}
                        />
                    </Field>
                </div>

                {band ? (
                    <Alert tone="warning" className="mb-0">
                        <b>Weight-band guide: {band.indicated} tablets/day</b>
                        <div className="mt-1 text-[9.5px] text-[#6b7280]">
                            Current weight: {band.weight} kg · RHU prescription:{" "}
                            {form.data.confirmed_dose} tablets/day
                        </div>
                    </Alert>
                ) : null}

                {form.errors.month ? (
                    <p role="alert" className="mt-2 text-[12px] font-semibold text-brand">
                        {form.errors.month}
                    </p>
                ) : null}

                {closed || notDue || finalized ? null : (
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                        {locked ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditing(true);
                                    // Put the cursor in the first field so the switch
                                    // into edit mode is unmistakable.
                                    window.setTimeout(
                                        () => document.getElementById("rv-weight")?.focus(),
                                        0,
                                    );
                                }}
                                className={smallButton}
                            >
                                Edit Review
                            </button>
                        ) : (
                            <>
                                <button
                                    type="submit"
                                    disabled={form.processing}
                                    className={smallPrimaryButton}
                                >
                                    {data.saved ? "Save Changes" : "Save Clinical Review"}
                                </button>
                                {data.saved ? (
                                    <button
                                        type="button"
                                        onClick={() => setEditing(false)}
                                        className={smallButton}
                                    >
                                        Cancel
                                    </button>
                                ) : null}
                            </>
                        )}
                    </div>
                )}
            </FormSection>
        </form>
    );
}

/**
 * The Medicine Tracker for one week's strip. `supply` is that week's balance:
 * live while it is the latest visit, otherwise frozen at the day the next strip
 * was handed over, so a past week keeps the count it ended on.
 */
function MedicineTracker({ supply, week, options }) {
    if (!supply) {
        return (
            <Alert tone="neutral" className="mb-0">
                {week?.can_record
                    ? "No medication has been dispensed for this week yet. Record the dispensing to start its tracker."
                    : "This week has no dispensing record yet."}
            </Alert>
        );
    }

    const dot = supply.tone === "red" ? "🔴" : supply.tone === "yellow" ? "🟡" : "🟢";
    const pillTone =
        supply.tone === "green" ? "active" : supply.tone === "red" ? "presumptive" : "upcoming";

    return (
        <div className="rounded-[10px] border border-[#e5e7eb] p-4">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
                <div>
                    <div className="text-xs font-extrabold text-[#1f2937]">Medicine Tracker</div>
                    <div className="mt-1 text-[10px] text-[#6b7280]">
                        {supply.is_current
                            ? "Tracks the RHU-scheduled return date and current medicine supply."
                            : `Balance of this week's strip as of ${supply.as_of}, when the next strip was dispensed.`}
                    </div>
                </div>
                <StatusPill tone={pillTone}>
                    {dot} {supply.label}
                </StatusPill>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
                <div className="rounded-[9px] border border-[#e5e7eb] bg-[#fafbfc] px-[15px] py-[13px]">
                    <div className="mb-1.5 text-[9px] font-extrabold tracking-[0.04em] text-[#98a1ad] uppercase">
                        Next Scheduled Dispensing
                    </div>
                    <div className="text-lg leading-tight font-extrabold text-[#1f2937]">
                        {supply.next}
                    </div>
                    <div
                        className={cx(
                            "mt-1 text-[10px]",
                            supply.to_pickup < 0
                                ? "font-bold text-[#c53030]"
                                : supply.to_pickup <= 2
                                  ? "font-bold text-[#a36b00]"
                                  : "text-[#6b7280]",
                        )}
                    >
                        {supply.to_pickup < 0
                            ? `${Math.abs(supply.to_pickup)} day${Math.abs(supply.to_pickup) === 1 ? "" : "s"} overdue`
                            : supply.to_pickup === 0
                              ? "Due today"
                              : `${supply.to_pickup} day${supply.to_pickup === 1 ? "" : "s"} remaining`}
                    </div>
                    <div className="mt-1 text-[10px] text-[#6b7280]">
                        Last dispensing {supply.last}
                    </div>
                </div>

                <div className="rounded-[9px] border border-[#e5e7eb] bg-[#fafbfc] px-[15px] py-[13px]">
                    <div className="mb-1.5 text-[9px] font-extrabold tracking-[0.04em] text-[#98a1ad] uppercase">
                        Medicine Coverage
                    </div>
                    <div className="text-lg leading-tight font-extrabold text-[#1f2937]">
                        {supply.remaining}{" "}
                        <small className="text-[10px] font-bold text-[#6b7280]">
                            / {supply.weekly_supply} tablets
                        </small>
                    </div>
                    <div
                        className={cx(
                            "mt-1 text-[10px]",
                            supply.days_left <= 3 ? "font-bold text-[#a36b00]" : "text-[#6b7280]",
                        )}
                    >
                        {supply.days_left} full treatment day
                        {supply.days_left === 1 ? "" : "s"} remaining
                    </div>
                    <div className="mt-1 text-[10px] text-[#6b7280]">
                        Expected run-out {supply.run_out} · Dose at dispensing {supply.dose}{" "}
                        tablets/day
                    </div>

                    <div className="mt-2.5 mb-1.5 flex justify-between gap-3 text-[9px] text-[#6b7280]">
                        <span>{supply.remaining} tablets estimated remaining</span>
                        <span>{supply.percent}%</span>
                    </div>
                    <MedicineBar percent={supply.percent} tone={supply.tone} />
                </div>
            </div>

            {supply.key === "runout" ? (
                <Alert tone="danger" className="mt-[13px] mb-0">
                    <b>🔴 Medicine Expected to Run Out Before Next Dispensing</b>
                    <br />
                    The new {supply.weekly_supply}-tablet strip covers about {supply.coverage}{" "}
                    full treatment days at {supply.dose} tablets/day, while the routine return
                    is {options.pickup_cycle} days after release. Requires RHU review. CareLink
                    does not automatically change the quantity or prescription.
                </Alert>
            ) : null}
            {supply.key === "exhausted" ? (
                <Alert tone="danger" className="mt-[13px] mb-0">
                    <b>🔴 Medicine Supply Exhausted</b>
                    <br />
                    The estimated balance for the active weekly strip has reached zero.
                    Requires RHU review.
                </Alert>
            ) : null}
            {supply.key === "overdue" ? (
                <Alert tone="danger" className="mt-[13px] mb-0">
                    <b>🔴 Scheduled Dispensing Overdue</b>
                    <br />
                    The expected weekly return date has passed. Follow up with the patient. A
                    single missed dispensing visit does not by itself mean the patient is lost
                    to follow-up.
                </Alert>
            ) : null}
            {supply.key === "low" ? (
                <Alert tone="warning" className="mt-[13px] mb-0">
                    <b>🟡 Medicine Running Low</b>
                    <br />
                    About {supply.days_left} full treatment day
                    {supply.days_left === 1 ? "" : "s"} of medicine remain.
                </Alert>
            ) : null}
        </div>
    );
}

/** ISO date `days` after ISO date `from`. */
function addDays(from, days) {
    if (!from) return "";
    const date = new Date(`${from}T00:00:00`);
    date.setDate(date.getDate() + days);
    return isoDate(date);
}

/**
 * Splits a stored `side_effects` array into the checklist ticks and the Other
 * text: anything that is not one of the listed effects is the typed text.
 */
function splitSideEffects(effects, listed) {
    const known = (effects ?? []).filter((effect) => listed.includes(effect));
    const other = (effects ?? []).filter((effect) => !listed.includes(effect)).join(", ");
    return { known, other };
}

/**
 * The Record / Edit / View Medication Dispensing form, rendered inside the
 * shared Modal. `readOnly` is the View mode for a finalized week: the same
 * layout, every control disabled, and no save button.
 */
function DispensingForm({ record, data, month, editingId, readOnly = false, options, onClose }) {
    const existing = editingId ? data.history.find((row) => row.id === editingId) : null;
    const defaults = data.dispensing_form;

    const previousDate = existing ? existing.previous_date : defaults.previous_date;
    const previousSupply = existing ? existing.previous_supply : defaults.previous_supply;
    const previousDose = existing ? existing.previous_dose : defaults.previous_dose;
    const dose = existing ? existing.dose : defaults.dose;

    // The checklist proper is every listed effect except the trailing "Other",
    // which the dropdown draws as its own text row.
    const sideEffectOptions = options.side_effects.filter((effect) => effect !== "Other");
    const initialSideEffects = splitSideEffects(existing?.side_effects, sideEffectOptions);

    const form = useForm({
        dispensed_on: existing?.dispensed_on ?? defaults.suggested_date,
        remaining_tablets: existing?.remaining_tablets ?? "",
        doses_taken: existing?.doses_taken ?? "",
        missed_reason: existing?.missed_reason ?? "",
        missed_intervention: existing?.missed_intervention ?? "",
        side_effects: existing?.side_effects ?? [],
        remarks: existing?.remarks ?? "",
    });

    const [otherSideEffect, setOtherSideEffect] = useState(initialSideEffects.other);

    // Always one pickup cycle after the dispensing date. Shown, not typed —
    // the server derives the stored value the same way.
    const nextDispensing = addDays(form.data.dispensed_on, options.pickup_cycle);

    // Live preview only — every figure is recomputed server-side on save.
    const scheduled = previousDate
        ? Math.max(0, daysBetween(previousDate, form.data.dispensed_on))
        : 0;
    const taken =
        form.data.doses_taken === "" ? scheduled : Number(form.data.doses_taken);
    const missed = previousDate ? Math.max(0, scheduled - taken) : null;
    const expected = previousDate
        ? Math.max(0, Math.min(previousSupply, previousSupply - taken * previousDose))
        : null;
    const actual =
        form.data.remaining_tablets === "" ? null : Number(form.data.remaining_tablets);
    const mismatch = expected !== null && actual !== null && actual !== expected;
    const adherence = scheduled > 0 ? Math.round((taken / scheduled) * 1000) / 10 : null;

    const serious = form.data.side_effects.some((effect) =>
        options.serious_side_effects.includes(effect),
    );

    // `side_effects` is the ticked effects plus the Other text, when typed —
    // the one array the server stores, rebuilt from both pieces on each change.
    const knownSideEffects = form.data.side_effects.filter((effect) =>
        sideEffectOptions.includes(effect),
    );
    const composeSideEffects = (known, other) =>
        form.setData("side_effects", other.trim() ? [...known, other.trim()] : known);

    const toggleSideEffect = (value) =>
        composeSideEffects(
            knownSideEffects.includes(value)
                ? knownSideEffects.filter((item) => item !== value)
                : [...knownSideEffects, value],
            otherSideEffect,
        );

    const typeOtherSideEffect = (value) => {
        setOtherSideEffect(value);
        composeSideEffects(knownSideEffects, value);
    };

    const submit = (event) => {
        event.preventDefault();
        if (readOnly) return;

        const visitOptions = { preserveScroll: true, onSuccess: onClose };

        if (editingId) {
            form.patch(
                route("rhu.treatment.dispensing.update", [record.id, editingId]),
                visitOptions,
            );
        } else {
            form.post(route("rhu.treatment.dispensing.store", record.id), visitOptions);
        }
    };

    const title = readOnly
        ? "Medication Dispensing"
        : `${editingId ? "Edit" : "Record"} Medication Dispensing`;

    return (
        <form onSubmit={submit}>
            <header className="flex items-start justify-between gap-4 border-b border-[#e5e7eb] px-6 py-5">
                <div>
                    <h2 id="dispensing-title" className="text-base font-bold text-ink">
                        {title}
                    </h2>
                    <p className="mt-0.5 text-[12px] text-muted">
                        Month {month} · Week {existing?.week ?? data.weeks.find((w) => w.can_record)?.week ?? "—"} · {data.phase}
                        {readOnly ? " · View only" : ""}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="text-2xl leading-none text-muted hover:text-brand"
                >
                    &times;
                </button>
            </header>

            <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
                <FactsGrid
                    items={[
                        {
                            label: "Previous Dispensing",
                            value: existing
                                ? (existing.previous_date ?? "—")
                                : defaults.previous_label,
                        },
                        { label: "Prescribed Dose", value: `${dose} tablets/day` },
                        { label: "New Supply", value: `${options.strip_tablets} tablets` },
                        {
                            label: "Scheduled Doses",
                            value: previousDate ? String(scheduled) : "—",
                        },
                        {
                            label: "Expected Tablets Left",
                            value: expected === null ? "—" : `${expected} tablets`,
                        },
                        { label: "Missed Doses", value: missed === null ? "—" : String(missed) },
                        {
                            label: "Adherence",
                            value: adherence === null ? "—" : `${adherence}%`,
                        },
                    ]}
                />

                <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                    <Field
                        label="Dispensing Date"
                        htmlFor="pk-date"
                        required
                        error={form.errors.dispensed_on}
                    >
                        <input
                            id="pk-date"
                            type="date"
                            className={controlClass}
                            disabled={readOnly}
                            value={form.data.dispensed_on}
                            onChange={(event) => form.setData("dispensed_on", event.target.value)}
                        />
                    </Field>

                    <Field
                        label="Next Dispensing Date"
                        htmlFor="pk-next"
                        hint={`${options.pickup_cycle} days after the dispensing date.`}
                    >
                        <input
                            id="pk-next"
                            type="date"
                            readOnly
                            aria-readonly="true"
                            className={cx(readOnlyControlClass, "text-muted")}
                            value={nextDispensing}
                        />
                    </Field>

                    <Field
                        label="Remaining Tablets"
                        htmlFor="pk-actual"
                        error={form.errors.remaining_tablets}
                    >
                        <input
                            id="pk-actual"
                            type="number"
                            min="0"
                            max={options.strip_tablets}
                            step="1"
                            className={controlClass}
                            disabled={readOnly || !previousDate}
                            placeholder={previousDate ? "Previous supply" : "—"}
                            value={form.data.remaining_tablets}
                            onChange={(event) =>
                                form.setData("remaining_tablets", event.target.value)
                            }
                        />
                        {mismatch && !readOnly ? (
                            <p className="mt-1.5 text-[9.5px] leading-snug font-bold text-[#a36b00]">
                                Counted {actual}, expected {expected}. Confirm the count with
                                the patient before saving.
                            </p>
                        ) : null}
                    </Field>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                    <Field label="Doses Taken" htmlFor="pk-taken" error={form.errors.doses_taken}>
                        <input
                            id="pk-taken"
                            type="number"
                            min="0"
                            max={scheduled}
                            step="1"
                            className={controlClass}
                            disabled={readOnly || !previousDate}
                            placeholder={previousDate ? "Treatment days" : "—"}
                            value={form.data.doses_taken}
                            onChange={(event) => form.setData("doses_taken", event.target.value)}
                        />
                    </Field>

                    <Field
                        label="Side Effects"
                        htmlFor="pk-se-choice"
                        className="sm:col-span-2"
                        error={form.errors.side_effects}
                        hint="Tick every effect reported; use Other for one not listed."
                    >
                        <CheckDropdown
                            id="pk-se-choice"
                            options={sideEffectOptions}
                            selected={knownSideEffects}
                            onToggle={toggleSideEffect}
                            otherValue={otherSideEffect}
                            onOtherChange={typeOtherSideEffect}
                            disabled={readOnly}
                            placeholder="None reported"
                        />
                    </Field>
                </div>

                {serious ? (
                    <Alert tone="danger" className="mt-3 mb-0">
                        <b>⚠ Potentially serious adverse reaction reported.</b>
                        <br />
                        Refer the patient for clinical assessment. CareLink does not stop or
                        change the prescription on its own.
                    </Alert>
                ) : null}

                {missed > 0 ? (
                    <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                        <Field
                            label="Reason for Missed Doses"
                            htmlFor="pk-reason"
                            error={form.errors.missed_reason}
                        >
                            <input
                                id="pk-reason"
                                className={controlClass}
                                disabled={readOnly}
                                value={form.data.missed_reason}
                                onChange={(event) =>
                                    form.setData("missed_reason", event.target.value)
                                }
                            />
                        </Field>
                        <Field
                            label="Intervention"
                            htmlFor="pk-intervention"
                            error={form.errors.missed_intervention}
                        >
                            <input
                                id="pk-intervention"
                                className={controlClass}
                                disabled={readOnly}
                                placeholder="Counseling"
                                value={form.data.missed_intervention}
                                onChange={(event) =>
                                    form.setData("missed_intervention", event.target.value)
                                }
                            />
                        </Field>
                    </div>
                ) : null}

                <div className="mt-4">
                    <Field label="Remarks" htmlFor="pk-remarks" error={form.errors.remarks}>
                        <textarea
                            id="pk-remarks"
                            rows={3}
                            className={cx(controlClass, "resize-y")}
                            disabled={readOnly}
                            value={form.data.remarks}
                            onChange={(event) => form.setData("remarks", event.target.value)}
                        />
                    </Field>
                </div>
            </div>

            <footer className="flex flex-wrap justify-end gap-2.5 border-t border-[#e5e7eb] px-6 py-4">
                <button type="button" onClick={onClose} className={smallButton}>
                    {readOnly ? "Close" : "Cancel"}
                </button>
                {readOnly ? null : (
                    <button
                        type="submit"
                        disabled={form.processing}
                        className={smallPrimaryButton}
                    >
                        {editingId ? "Save Changes" : "Save Medication Dispensing"}
                    </button>
                )}
            </footer>
        </form>
    );
}


/* ── tab: Follow-up Diagnostic Tests ───────────────────────────────────── */

function FollowupTab({ record, followups, schedule, options, closed }) {
    const [recording, setRecording] = useState(null);
    const positive = followups.some((followup) => followup.is_positive);

    return (
        <>
            <Alert tone="neutral">
                Enrolled as <b>{schedule.enrolled_as ?? "—"}</b> — follow-up diagnostic tests
                are scheduled for <b>{schedule.label}</b>. These are separate from the weekly
                medication dispensing.
            </Alert>

            {positive ? (
                <Alert tone="warning">
                    <b>⚠ Positive follow-up result on record</b>
                    <br />
                    Flagged for RHU review. A single positive result does not by itself
                    indicate treatment failure.
                </Alert>
            ) : null}

            <FormSection title="Follow-up Diagnostic Test Schedule">
                <RecordTable headings={["Month", "Due Date", "Status", "Result", ""]}>
                    {followups.length === 0 ? (
                        <tr>
                            <td
                                colSpan={5}
                                className="border-t border-[#e5e7eb] px-2.5 py-7 text-center text-[11.5px] text-[#b8bec8]"
                            >
                                No follow-up diagnostic tests are scheduled for this case.
                            </td>
                        </tr>
                    ) : (
                        followups.map((followup) => (
                            <tr key={followup.id}>
                                <td className={cx(recordCellClass, "font-bold")}>
                                    Month {followup.month}
                                </td>
                                <td className={recordCellClass}>{followup.due_date_label}</td>
                                <td className={recordCellClass}>
                                    <StatusPill
                                        tone={
                                            followup.status === "Completed"
                                                ? "active"
                                                : followup.status === "Due"
                                                  ? "upcoming"
                                                  : "completed"
                                        }
                                    >
                                        {followup.status}
                                    </StatusPill>
                                </td>
                                <td className={recordCellClass}>
                                    {followup.smear_result ? (
                                        <StatusPill
                                            tone={followup.is_positive ? "presumptive" : "active"}
                                        >
                                            {followup.smear_result}
                                            {followup.afb_count ? ` · ${followup.afb_count}` : ""}
                                        </StatusPill>
                                    ) : (
                                        "—"
                                    )}
                                </td>
                                <td className={cx(recordCellClass, "text-center")}>
                                    {followup.collected || closed ? null : (
                                        <button
                                            type="button"
                                            onClick={() => setRecording(followup)}
                                            className={smallButton}
                                        >
                                            Record Result
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                </RecordTable>
            </FormSection>

            <Modal
                open={recording !== null}
                onClose={() => setRecording(null)}
                labelledBy="followup-title"
                className="max-w-[720px] p-0"
            >
                {recording ? (
                    <FollowupForm
                        key={recording.id}
                        record={record}
                        followup={recording}
                        options={options}
                        onClose={() => setRecording(null)}
                    />
                ) : null}
            </Modal>
        </>
    );
}

/** Record Follow-up Result — the body of the modal above. */
function FollowupForm({ record, followup, options, onClose }) {
    const form = useForm({
        collection_date: followup.collection_date ?? today(),
        result_date: followup.result_date ?? today(),
        smear_result: followup.smear_result ?? options.smear_results[0],
        afb_count: followup.afb_count ?? "",
        remarks: followup.remarks ?? "",
    });

    const submit = (event) => {
        event.preventDefault();
        form.patch(route("rhu.treatment.followups.update", [record.id, followup.id]), {
            preserveScroll: true,
            onSuccess: onClose,
        });
    };

    return (
        <form onSubmit={submit}>
            <header className="flex items-start justify-between gap-4 border-b border-[#e5e7eb] px-6 py-5">
                <div>
                    <h2 id="followup-title" className="text-base font-bold text-ink">
                        Record Follow-up Diagnostic Test Result
                    </h2>
                    <p className="mt-0.5 text-[12px] text-muted">
                        Month {followup.month} · due {followup.due_date_label}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="text-2xl leading-none text-muted hover:text-brand"
                >
                    &times;
                </button>
            </header>

            <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <Field
                        label="Collection Date"
                        htmlFor="fu-collection"
                        required
                        error={form.errors.collection_date}
                    >
                        <input
                            id="fu-collection"
                            type="date"
                            className={controlClass}
                            value={form.data.collection_date}
                            onChange={(event) =>
                                form.setData("collection_date", event.target.value)
                            }
                        />
                    </Field>

                    <Field
                        label="Result Date"
                        htmlFor="fu-result"
                        required
                        error={form.errors.result_date}
                    >
                        <input
                            id="fu-result"
                            type="date"
                            className={controlClass}
                            value={form.data.result_date}
                            onChange={(event) => form.setData("result_date", event.target.value)}
                        />
                    </Field>

                    <Field
                        label="Smear Result"
                        htmlFor="fu-smear"
                        required
                        error={form.errors.smear_result}
                    >
                        <select
                            id="fu-smear"
                            className={selectClass}
                            value={form.data.smear_result}
                            onChange={(event) => form.setData("smear_result", event.target.value)}
                        >
                            {options.smear_results.map((result) => (
                                <option key={result} value={result}>
                                    {result}
                                </option>
                            ))}
                        </select>
                    </Field>

                    {/* A count only means anything for a scanty result, which is
                        when the reference reveals this field. */}
                    {form.data.smear_result === "Scanty (+n)" ? (
                        <Field label="AFB Count" htmlFor="fu-afb" error={form.errors.afb_count}>
                            <input
                                id="fu-afb"
                                className={controlClass}
                                placeholder="e.g. 3 AFB / 100 fields"
                                value={form.data.afb_count}
                                onChange={(event) => form.setData("afb_count", event.target.value)}
                            />
                        </Field>
                    ) : null}

                    <Field
                        label="Remarks"
                        htmlFor="fu-remarks"
                        className="sm:col-span-2"
                        error={form.errors.remarks}
                    >
                        <textarea
                            id="fu-remarks"
                            rows={3}
                            className={cx(controlClass, "resize-y")}
                            value={form.data.remarks}
                            onChange={(event) => form.setData("remarks", event.target.value)}
                        />
                    </Field>
                </div>
            </div>

            <footer className="flex flex-wrap justify-end gap-2.5 border-t border-[#e5e7eb] px-6 py-4">
                <button type="button" onClick={onClose} className={smallButton}>
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={form.processing}
                    className={smallPrimaryButton}
                >
                    Save Result
                </button>
            </footer>
        </form>
    );
}


/* ── tab: Contact Tracing ──────────────────────────────────────────────── */

const blankTracing = {
    patient_address: "",
    acf_date: "",
    province: "",
    municipality: "",
    community: "",
    registry_no: "",
    phone: "",
    visit_date: "",
    visit_type: "",
    rhu_contacted: "",
    started_medication: "",
    accompaniment: "",
    household_total: 0,
    household_symptoms: 0,
    household_tb: 0,
    household_taking_meds: "",
    referral_cards: "",
    tpt_total: 0,
    tpt_0_to_4: 0,
    tpt_5_to_14: 0,
    tpt_15_plus: 0,
    tpt_reason: "",
    enumerator: "",
};

function ContactTab({ record, tracing, defaults, options, closed }) {
    const saved = tracing !== null;
    const [editing, setEditing] = useState(false);
    const locked = closed || (saved && !editing);

    // A report not yet filed opens on what the system already knows — the
    // patient's address and phone, the case number, the program's ACF date
    // — so the RHU is not asked to retype it. A saved report shows what was
    // saved. Every field stays editable either way.
    const form = useForm({ ...blankTracing, ...(defaults ?? {}), ...(tracing ?? {}) });

    const submit = (event) => {
        event.preventDefault();
        form.put(route("rhu.treatment.contact-tracing.save", record.id), {
            preserveScroll: true,
            onSuccess: () => setEditing(false),
        });
    };

    // An ACF Activity value the system filled in from the patient, program or
    // case record is shown greyed and read-only: it is on file already and is
    // not the RHU's to retype here. A field the record has no value for stays
    // editable so it can be filled in.
    const automated = (name) => Boolean(defaults?.[name]);

    const text = (name, label, placeholder, type = "text") => (
        <Field
            label={label}
            htmlFor={`ct-${name}`}
            error={form.errors[name]}
            hint={automated(name) ? "From the patient's record." : undefined}
        >
            <input
                id={`ct-${name}`}
                type={type}
                readOnly={automated(name)}
                aria-readonly={automated(name) || undefined}
                className={automated(name) ? cx(readOnlyControlClass, "text-muted") : controlClass}
                disabled={locked && !automated(name)}
                placeholder={placeholder}
                value={form.data[name] ?? ""}
                onChange={(event) => form.setData(name, event.target.value)}
            />
        </Field>
    );

    const number = (name, label) => (
        <Field label={label} htmlFor={`ct-${name}`} error={form.errors[name]}>
            <input
                id={`ct-${name}`}
                type="number"
                min="0"
                step="1"
                className={controlClass}
                disabled={locked}
                value={form.data[name] ?? 0}
                onChange={(event) => form.setData(name, event.target.value)}
            />
        </Field>
    );

    const select = (name, label, choices, placeholder = "— Select —") => (
        <Field label={label} htmlFor={`ct-${name}`} error={form.errors[name]}>
            <select
                id={`ct-${name}`}
                className={selectClass}
                disabled={locked}
                value={form.data[name] ?? ""}
                onChange={(event) => form.setData(name, event.target.value)}
            >
                <option value="">{placeholder}</option>
                {choices.map((choice) => (
                    <option key={choice} value={choice}>
                        {choice}
                    </option>
                ))}
            </select>
        </Field>
    );

    return (
        <form onSubmit={submit}>
            <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-[13px] font-extrabold text-[#1f2937]">
                        ACF Contact Tracing
                    </h3>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-[#6b7280]">
                        Field wording follows the original ACF Contact Tracing Report table.
                        The ACF Activity block is filled from the patient and program records
                        already on file; correct anything that differs.
                    </p>
                </div>
                {saved ? (
                    <span className="inline-flex items-center rounded-full bg-[#edf8f3] px-[9px] py-1 text-[10px] font-bold text-ok">
                        ✓ Saved
                    </span>
                ) : null}
            </div>

            <ContactGroup title="1. ACF Activity">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <Field label="TB Patient Name (Enrolled in TB DOTS)" htmlFor="ct-name">
                        <p id="ct-name" className={cx(readOnlyControlClass, "text-muted")}>
                            {record.patient.name}
                        </p>
                    </Field>
                    {text(
                        "patient_address",
                        "Patient's Address (Base in Attendance Sheet)",
                        "Enter address",
                    )}
                </div>
                <div className="mt-[13px] grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                    {text("acf_date", "Date of ACF Activity", "", "date")}
                    {text("province", "Province", "Enter province")}
                    {text("municipality", "Municipality", "Enter municipality")}
                    {text("community", "Community", "Enter community")}
                    {text("registry_no", "TB Registry Number", "Enter registry number")}
                    {text("phone", "Patient's phone Number if available", "Enter phone number")}
                </div>
            </ContactGroup>

            <ContactGroup title="2. Patient Follow-up">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                    {text("visit_date", "Date of Call or Home Visit", "", "date")}
                    {select("visit_type", "Call or Home Visit?", options.visit_types)}
                    {select("rhu_contacted", "1. Has the RHU/CHO contacted you?", options.yes_no)}
                    {select("started_medication", "Have you started medication?", options.yes_no)}
                    {select(
                        "accompaniment",
                        "2. Do you have accompaniment to the RHU?",
                        options.yes_no,
                    )}
                </div>
            </ContactGroup>

            <ContactGroup title="3. Household Assessment">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                    {number("household_total", "3. How many people live in your household?")}
                    {number("household_symptoms", "4. How many HH members have symptoms?")}
                    {number("household_tb", "5. How many HH members have TB?")}
                </div>
                <div className="mt-[13px] grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                    {select(
                        "household_taking_meds",
                        "If have, are they taking TB medication?",
                        options.taking_meds,
                    )}
                    {select("referral_cards", "6. Were referral cards given?", options.yes_no)}
                    {number(
                        "tpt_total",
                        "7. If already, how many HH members enrolled in preventive therapy (TPT)?",
                    )}
                </div>
            </ContactGroup>

            <ContactGroup title="4. TPT Enrollment">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                    {number(
                        "tpt_0_to_4",
                        "# of HH members enrolled in preventive therapy (TPT) 0 to 4 years old",
                    )}
                    {number(
                        "tpt_5_to_14",
                        "# of HH members enrolled in preventive therapy (TPT) 5 to 14 years old",
                    )}
                    {number(
                        "tpt_15_plus",
                        "# of HH members enrolled in preventive therapy (TPT) 15 years old and above",
                    )}
                </div>
                <div className="mt-[13px] grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    {select(
                        "tpt_reason",
                        "Reason why HH members not enrolled for TPT",
                        options.tpt_reasons,
                        "— Select reason —",
                    )}
                    {text("enumerator", "Enumerator Name", "Enter enumerator name")}
                </div>
            </ContactGroup>

            {closed ? null : (
                <div className="mt-[18px] flex flex-wrap justify-end gap-2">
                    {!saved ? (
                        <button
                            type="submit"
                            disabled={form.processing}
                            className={smallPrimaryButton}
                        >
                            Save Contact Tracing
                        </button>
                    ) : locked ? (
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            className={smallButton}
                        >
                            Edit
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => setEditing(false)}
                                className={smallButton}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={form.processing}
                                className={smallPrimaryButton}
                            >
                                Update Contact Tracing
                            </button>
                        </>
                    )}
                </div>
            )}
        </form>
    );
}

/* ── tab: Treatment Outcome ────────────────────────────────────────────── */

function OutcomeTab({ record, options, closed }) {
    const form = useForm({
        outcome: closed ? (record.status_label ?? "") : "",
        outcome_date: record.outcome_date_value ?? today(),
        outcome_remarks: record.outcome_remarks ?? "",
    });

    const submit = (event) => {
        event.preventDefault();
        form.patch(route("rhu.treatment.outcome.update", record.id), { preserveScroll: true });
    };

    return (
        <form onSubmit={submit}>
            {closed ? (
                <Alert tone="success">
                    Treatment Outcome: <b>{String(record.status_label).toUpperCase()}</b> ·{" "}
                    {record.outcome_date} · Record Status: CLOSED
                </Alert>
            ) : (
                <Alert tone="neutral">
                    The final outcome is assigned by authorized RHU personnel after
                    end-of-treatment review. Reaching Month {options.total_months} does not by
                    itself mark the patient as completed.
                </Alert>
            )}

            <FormSection title="Final Treatment Outcome">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                    <Field label="Treatment Outcome" htmlFor="outcome" error={form.errors.outcome}>
                        <select
                            id="outcome"
                            className={selectClass}
                            disabled={closed}
                            value={form.data.outcome}
                            onChange={(event) => form.setData("outcome", event.target.value)}
                        >
                            <option value="">Select outcome</option>
                            {options.outcomes.map((outcome) => (
                                <option key={outcome} value={outcome}>
                                    {outcome}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field
                        label="Outcome Date"
                        htmlFor="outcome-date"
                        error={form.errors.outcome_date}
                    >
                        <input
                            id="outcome-date"
                            type="date"
                            className={controlClass}
                            disabled={closed}
                            value={form.data.outcome_date}
                            onChange={(event) => form.setData("outcome_date", event.target.value)}
                        />
                    </Field>

                    <Field label="Recorded By" htmlFor="outcome-recorded-by">
                        <input
                            id="outcome-recorded-by"
                            readOnly
                            className={cx(readOnlyControlClass, "text-muted")}
                            value={options.current_user}
                        />
                    </Field>

                    <Field
                        label="Remarks"
                        htmlFor="outcome-remarks"
                        className="sm:col-span-2 xl:col-span-3"
                        error={form.errors.outcome_remarks}
                    >
                        <textarea
                            id="outcome-remarks"
                            rows={3}
                            className={cx(controlClass, "resize-y")}
                            disabled={closed}
                            value={form.data.outcome_remarks}
                            onChange={(event) =>
                                form.setData("outcome_remarks", event.target.value)
                            }
                        />
                    </Field>
                </div>

                {closed ? null : (
                    <div className="mt-4 flex gap-2">
                        <button
                            type="submit"
                            disabled={form.processing}
                            className={smallPrimaryButton}
                        >
                            {form.processing ? "Saving…" : "Save Final Outcome"}
                        </button>
                    </div>
                )}
            </FormSection>
        </form>
    );
}

/* ── tab: Audit Trail ──────────────────────────────────────────────────── */

function AuditTab({ audit }) {
    return (
        <>
            <div className="mb-[18px] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#1f2937]">Record Audit Trail</h3>
            </div>
            <RecordTable headings={["Date / Time", "User", "Action", "Section", "Status"]}>
                {audit.length === 0 ? (
                    <tr>
                        <td
                            colSpan={5}
                            className="border-t border-[#e5e7eb] px-2.5 py-7 text-center text-[11.5px] text-[#b8bec8]"
                        >
                            No recorded actions for this case yet.
                        </td>
                    </tr>
                ) : (
                    audit.map((entry) => (
                        <tr key={entry.id}>
                            <td className={cx(recordCellClass, "whitespace-nowrap")}>
                                {entry.date_label}
                            </td>
                            <td className={recordCellClass}>{entry.user ?? "—"}</td>
                            <td className={recordCellClass}>{entry.action}</td>
                            <td className={recordCellClass}>{entry.section}</td>
                            <td className={recordCellClass}>{entry.status}</td>
                        </tr>
                    ))
                )}
            </RecordTable>
        </>
    );
}
