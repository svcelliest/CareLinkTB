import { Link, router, usePage } from "@inertiajs/react";
import { useState } from "react";
import {
    FaChevronLeft,
    FaCircleCheck,
    FaDownload,
    FaLock,
    FaPen,
} from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import ProgramFormDialog from "@/Components/program/ProgramFormDialog";
import { Button, Card, StatusPill, TreatmentStatus, cx } from "@/Components/ui";

/**
 * The program module. Program Record, Sputum Collection and Diagnostic
 * Assessment are three views over the *same* patient rows — the patient number
 * and name are shared, and each tab edits a different set of columns on the one
 * `patients` record. There is deliberately no separate sputum or diagnostic
 * page or table anywhere else in the app.
 */

const statusLabels = {
    active: "Active",
    upcoming: "Upcoming",
    completed: "Completed",
};

const tabs = [
    { value: "record", label: "Program Record" },
    { value: "sputum", label: "Sputum Collection" },
    { value: "diagnostic", label: "Diagnostic Assessment" },
];

const sputumReasons = [
    "",
    "No RHU Staff or BHW",
    "Patient Refused",
    "Patient Absent",
    "No Supplies",
    "Other",
];

/** Final Classification → TB Diagnosis. Values are what the RHU forms store. */
const tbDiagnoses = [
    { value: "", label: "—" },
    { value: "bc_ds_tb", label: "DSTB BC" },
    { value: "cd_ds_tb", label: "DSTB CD" },
    { value: "rr_tb", label: "RRTB BC" },
    { value: "none", label: "No TB" },
];

const cellClass =
    "border-r border-b border-[#f5f0f0] px-3 py-[9px] text-center align-middle text-[#444]";
const headClass =
    "border-r border-b-2 border-line-soft bg-[#faf7f7] px-3 py-2.5 text-center align-bottom text-[11px] leading-tight font-bold text-[#555]";
const groupHeadClass =
    "border-r border-b-2 border-line-soft bg-line-soft px-3 py-2.5 text-center align-bottom text-[11px] font-bold tracking-wide text-brand uppercase";
const subHeadClass =
    "border-r border-b-2 border-line-soft bg-[#faf7f7] px-3 py-2.5 text-center align-bottom text-[10px] font-bold text-[#666]";
const selectClass =
    "min-w-[110px] rounded border border-line bg-white px-2 py-1 text-[11px] text-[#555] outline-none focus:border-brand disabled:cursor-not-allowed disabled:bg-[#f8f8f8] disabled:opacity-70";
const remarksClass =
    "min-h-[58px] w-full min-w-[190px] resize-y rounded-md border border-[#ddd] bg-white px-2.5 py-2 text-[11px] leading-snug outline-none focus:border-brand disabled:bg-[#f7f7f7] disabled:text-[#666] disabled:opacity-100";

function Checkbox({ checked, disabled, onChange, label }) {
    return (
        <input
            type="checkbox"
            aria-label={label}
            className="size-[15px] accent-brand disabled:opacity-70"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange?.(event.target.checked)}
        />
    );
}

export default function Show({ program, scheduleWindow }) {
    const { flash } = usePage().props;
    const [tab, setTab] = useState("record");
    // The header's Edit button opens the same create/edit dialog the program
    // list uses. The register tabs below are view-only for the coordinator:
    // sputum collection and the diagnostic assessment are recorded by the RHU
    // in its Patient Tracker, and this screen monitors them.
    const [editOpen, setEditOpen] = useState(false);
    const editing = false;

    const statusLabel = statusLabels[program.status] ?? program.status;
    const isFormTab = tab === "sputum" || tab === "diagnostic";

    const rows = program.patients;

    const collectedCount = rows.filter(
        (row) => row.sputum_collected === "1",
    ).length;
    const collectedPct = rows.length
        ? Math.round((collectedCount / rows.length) * 100)
        : 0;

    // Nothing on this screen writes a row, so a field change is a no-op; the
    // tables keep the same props they had so their markup is unchanged.
    const setField = () => {};

    const switchTab = setTab;

    return (
        <DashboardLayout
            role="icm"
            title={program.name}
            contentClassName="dash-content-program-detail"
        >
            <section className="flex h-full flex-col bg-shell font-ui">
                <Card className="mx-6 mt-5 shrink-0 px-[22px] py-[18px]">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                        <Link
                            href={route("icm.programs.index")}
                            className="flex items-center gap-2 text-[15px] font-bold text-ink hover:text-brand"
                        >
                            <FaChevronLeft
                                className="size-5 text-brand"
                                aria-hidden="true"
                            />
                            <span>{program.name}</span>
                        </Link>

                        <div className="flex items-center gap-2.5">
                            <Button
                                variant="secondary"
                                onClick={() => setEditOpen(true)}
                            >
                                <FaPen className="size-3.5" aria-hidden="true" />
                                Edit
                            </Button>
                            <Button
                                as="a"
                                variant="secondary"
                                href={route("icm.programs.export")}
                            >
                                <FaDownload
                                    className="size-[15px]"
                                    aria-hidden="true"
                                />
                                Export
                            </Button>
                        </div>
                    </div>

                    <div className="mb-2.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>{program.location}</span>
                        <span className="text-[#ddd]" aria-hidden="true">
                            •
                        </span>
                        <span>
                            {program.date_label} {program.time_label}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-5 text-[12.5px]">
                        <span className="flex items-center gap-2">
                            <span
                                className={cx(
                                    "size-2 rounded-full",
                                    program.status === "active"
                                        ? "bg-ok"
                                        : program.status === "upcoming"
                                          ? "bg-info"
                                          : "bg-[#bbb]",
                                )}
                                aria-hidden="true"
                            />
                            <strong className="font-bold text-ink">
                                Status: {statusLabel}
                            </strong>
                        </span>
                        <span className="text-muted">
                            Read-only monitoring view
                        </span>
                    </div>

                    <div
                        className="mt-3.5 flex flex-wrap gap-1.5 border-t border-line-soft pt-3"
                        role="tablist"
                        aria-label="Program module"
                    >
                        {tabs.map((entry) => (
                            <button
                                key={entry.value}
                                type="button"
                                role="tab"
                                aria-selected={tab === entry.value}
                                onClick={() => switchTab(entry.value)}
                                className={cx(
                                    "rounded-lg px-3.5 py-2 text-[13px] font-bold transition-colors",
                                    tab === entry.value
                                        ? "bg-brand-soft text-brand"
                                        : "text-muted hover:bg-[#faf7f7] hover:text-ink",
                                )}
                            >
                                {entry.label}
                            </button>
                        ))}
                    </div>
                </Card>

                {flash?.success && (
                    <div
                        role="status"
                        className="mx-6 mt-4 flex items-center gap-2 rounded-lg bg-ok-soft px-4 py-3 text-[13px] font-semibold text-ok"
                    >
                        <FaCircleCheck aria-hidden="true" />
                        <span>{flash.success}</span>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
                    {tab === "record" && (
                        <ProgramRecord program={program} rows={rows} />
                    )}

                    {isFormTab && (
                        <Card className="overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line-soft px-5 py-3.5">
                                <div className="flex flex-wrap items-center gap-3.5">
                                    <span className="text-sm font-bold text-ink">
                                        {tab === "sputum"
                                            ? "Sputum Collection"
                                            : "Diagnostic Assessment"}
                                    </span>
                                    <span className="rounded-lg bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap text-white">
                                        Total # of Patient: {rows.length}
                                    </span>
                                    {tab === "sputum" && rows.length > 0 && (
                                        <div className="flex min-w-[160px] flex-col gap-1">
                                            <div className="flex justify-between text-[11.5px] font-semibold text-[#666]">
                                                <span>Collection Progress</span>
                                                <span>
                                                    {collectedCount} / {rows.length}
                                                </span>
                                            </div>
                                            <div className="h-2.5 overflow-hidden rounded-full bg-line-soft">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-brand to-[#e74c3c] transition-[width] duration-300"
                                                    style={{
                                                        width: `${collectedPct}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </div>

                            <div className="overflow-x-auto">
                                {tab === "sputum" ? (
                                    <SputumTable
                                        rows={rows}
                                        editing={editing}
                                        setField={setField}
                                    />
                                ) : (
                                    <DiagnosticTable
                                        rows={rows}
                                        editing={editing}
                                        setField={setField}
                                    />
                                )}
                            </div>
                        </Card>
                    )}
                </div>
            </section>

            <ProgramFormDialog
                open={editOpen}
                onClose={() => setEditOpen(false)}
                program={program}
                scheduleWindow={scheduleWindow}
            />
        </DashboardLayout>
    );
}

function ProgramRecord({ program, rows }) {
    return (
        <>
            <div className="mb-[18px] grid gap-3.5 sm:grid-cols-3">
                {[
                    { label: "Total Patients", value: program.patient_counts.total },
                    { label: "Normal", value: program.patient_counts.normal },
                    {
                        label: "Presumptive TB",
                        value: program.patient_counts.presumptive,
                        red: true,
                    },
                ].map((stat) => (
                    <Card
                        key={stat.label}
                        className="rounded-[10px] px-[18px] py-4 text-center"
                    >
                        <div className="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                            {stat.label}
                        </div>
                        <div
                            className={cx(
                                "text-[26px] font-bold",
                                stat.red ? "text-brand" : "text-ink",
                            )}
                        >
                            {stat.value}
                        </div>
                    </Card>
                ))}
            </div>

            <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
                    <span className="text-sm font-bold text-ink">
                        Registered Patients
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f0f0f0] px-2.5 py-1 text-[11px] font-semibold text-muted">
                        <FaLock className="size-3" aria-hidden="true" />
                        View Only
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                {[
                                    "#",
                                    "Name",
                                    "Age / Sex",
                                    "Address",
                                    "Contact",
                                    "Status",
                                ].map((heading) => (
                                    <th
                                        key={heading}
                                        className="border-b border-line-soft px-[18px] py-2.5 text-left text-[11px] font-bold tracking-wide text-[#bbb]"
                                    >
                                        {heading}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length > 0 ? (
                                rows.map((patient) => (
                                    <tr
                                        key={patient.id}
                                        className="hover:bg-[#fdf8f8]"
                                    >
                                        <td className="border-b border-[#f8f2f2] px-[18px] py-3 text-[13px] text-[#444]">
                                            {patient.number}
                                        </td>
                                        <td className="border-b border-[#f8f2f2] px-[18px] py-3 text-[13px] font-semibold text-ink">
                                            {patient.name}
                                        </td>
                                        <td className="border-b border-[#f8f2f2] px-[18px] py-3 text-[13px] text-[#444]">
                                            {patient.age ?? "—"} / {patient.sex ?? "—"}
                                        </td>
                                        <td className="border-b border-[#f8f2f2] px-[18px] py-3 text-[13px] text-[#444]">
                                            {patient.address ?? "—"}
                                        </td>
                                        <td className="border-b border-[#f8f2f2] px-[18px] py-3 text-[13px] text-[#444]">
                                            {patient.contact ?? "—"}
                                        </td>
                                        <td className="border-b border-[#f8f2f2] px-[18px] py-3">
                                            <StatusPill
                                                tone={
                                                    patient.status === "Presumptive"
                                                        ? "presumptive"
                                                        : "normal"
                                                }
                                            >
                                                {patient.status}
                                            </StatusPill>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-6 py-10 text-center text-[13px] text-[#bbb]"
                                    >
                                        No patients registered for this program yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </>
    );
}

function SputumTable({ rows, editing, setField }) {
    return (
        <table className="w-full border-collapse text-xs whitespace-nowrap">
            <thead>
                <tr>
                    <th className={cx(headClass, "min-w-[60px]")}>No.</th>
                    <th className={cx(headClass, "min-w-[120px]")}>Patient Name</th>
                    <th className={cx(headClass, "min-w-[120px]")}>
                        Sputum Collected
                    </th>
                    <th className={cx(headClass, "min-w-[180px]")}>
                        Initial Reason if not Collected
                    </th>
                    <th className={cx(headClass, "min-w-[220px]")}>Remarks</th>
                </tr>
            </thead>
            <tbody>
                {rows.length > 0 ? (
                    rows.map((row) => (
                        <tr
                            key={row.id}
                            className={cx(
                                "hover:bg-[#fdf8f8]",
                                row.sputum_collected === "1" && "bg-[#fff5f5]",
                            )}
                        >
                            <td className={cellClass}>{row.number}</td>
                            <td
                                className={cx(
                                    cellClass,
                                    "text-left font-medium text-ink",
                                )}
                            >
                                {row.name}
                            </td>
                            <td className={cellClass}>
                                <Checkbox
                                    label={`Sputum collected for ${row.name}`}
                                    checked={row.sputum_collected === "1"}
                                    disabled={!editing}
                                    onChange={(checked) =>
                                        setField(
                                            row.id,
                                            "sputum_collected",
                                            checked ? "1" : "0",
                                        )
                                    }
                                />
                            </td>
                            <td className={cellClass}>
                                <select
                                    aria-label={`Reason not collected for ${row.name}`}
                                    className={selectClass}
                                    disabled={!editing}
                                    value={row.not_collected_reason}
                                    onChange={(event) =>
                                        setField(
                                            row.id,
                                            "not_collected_reason",
                                            event.target.value,
                                        )
                                    }
                                >
                                    {sputumReasons.map((reason) => (
                                        <option key={reason || "none"} value={reason}>
                                            {reason || "—"}
                                        </option>
                                    ))}
                                </select>
                            </td>
                            <td className={cellClass}>
                                <RemarksCell
                                    row={row}
                                    editing={editing}
                                    setField={setField}
                                />
                            </td>
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td
                            colSpan={5}
                            className="px-6 py-8 text-center text-[#bbb]"
                        >
                            No patients in this program yet.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}

function DiagnosticTable({ rows, editing, setField }) {
    return (
        <table className="w-full border-collapse text-xs whitespace-nowrap">
            <thead>
                <tr>
                    <th className={cx(headClass, "min-w-[60px] text-ink")} rowSpan={3}>
                        No.
                    </th>
                    <th className={cx(headClass, "min-w-[120px] text-ink")} rowSpan={3}>
                        Patient Name
                    </th>
                    <th className={groupHeadClass} colSpan={7}>
                        Diagnostic Testing
                    </th>
                    <th className={cx(headClass, "min-w-[70px] text-ink")} rowSpan={3}>
                        Negative (9)
                    </th>
                    <th
                        className={cx(groupHeadClass, "text-center")}
                        colSpan={3}
                    >
                        Final Classification
                    </th>
                </tr>
                <tr>
                    <th className={cx(headClass, "min-w-[70px]")} rowSpan={2}>
                        Tested w/ GXpert (3a)
                    </th>
                    <th className={cx(headClass, "min-w-[70px]")} rowSpan={2}>
                        Tested w/ DSSM (3b)
                    </th>
                    <th className={groupHeadClass} colSpan={5}>
                        GXpert or DSSM Result – Positive
                    </th>
                    <th className={cx(groupHeadClass, "min-w-[145px]")} rowSpan={2}>
                        TB Diagnosis
                    </th>
                    <th className={cx(groupHeadClass, "min-w-[145px]")} rowSpan={2}>
                        Treatment Status
                    </th>
                    <th className={cx(groupHeadClass, "min-w-[220px]")} rowSpan={2}>
                        Remarks
                    </th>
                </tr>
                <tr>
                    {["DSSM (4)", "RR (5)", "T (6)", "TT (7)", "TI (8)"].map(
                        (heading) => (
                            <th
                                key={heading}
                                className={cx(subHeadClass, "min-w-[60px]")}
                            >
                                {heading}
                            </th>
                        ),
                    )}
                </tr>
            </thead>
            <tbody>
                {rows.length > 0 ? (
                    rows.map((row) => (
                        <tr key={row.id} className="hover:bg-[#fdf8f8]">
                            <td className={cellClass}>{row.number}</td>
                            <td
                                className={cx(
                                    cellClass,
                                    "text-left font-medium text-ink",
                                )}
                            >
                                {row.name}
                            </td>
                            <td className={cellClass}>
                                <Checkbox
                                    label={`Tested with GeneXpert: ${row.name}`}
                                    checked={row.tested_gene_xpert === "1"}
                                    disabled
                                />
                            </td>
                            <td className={cellClass}>
                                <Checkbox
                                    label={`Tested with DSSM: ${row.name}`}
                                    checked={row.tested_dssm === "1"}
                                    disabled
                                />
                            </td>
                            {["dssm", "rr", "t", "tt", "ti"].map((code) => (
                                <td key={code} className={cellClass}>
                                    <Checkbox
                                        label={`${code.toUpperCase()} positive: ${row.name}`}
                                        checked={
                                            row.diagnostic_result === "positive" &&
                                            row.positive_classification === code
                                        }
                                        disabled
                                    />
                                </td>
                            ))}
                            <td className={cellClass}>
                                <Checkbox
                                    label={`Negative result: ${row.name}`}
                                    checked={row.diagnostic_result === "negative"}
                                    disabled
                                />
                            </td>
                            <td className={cellClass}>
                                <select
                                    aria-label={`TB diagnosis for ${row.name}`}
                                    className={cx(selectClass, "min-w-[135px]")}
                                    disabled={!editing}
                                    value={row.tb_case_classification}
                                    onChange={(event) =>
                                        setField(
                                            row.id,
                                            "tb_case_classification",
                                            event.target.value,
                                        )
                                    }
                                >
                                    {/* The blank option's value is "" and one
                                        real option's value is "none", so a
                                        `value || "none"` fallback collides.
                                        The values are already unique. */}
                                    {tbDiagnoses.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </td>
                            {/* Not editable: the status follows the treatment
                                register, moving to "On Treatment" when the RHU
                                enrols the patient in Patient Monitoring. */}
                            <td className={cellClass}>
                                <TreatmentStatus status={row.treatment_status} />
                            </td>
                            <td className={cellClass}>
                                <RemarksCell
                                    row={row}
                                    editing={editing}
                                    setField={setField}
                                />
                            </td>
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td
                            colSpan={13}
                            className="px-6 py-8 text-center text-[#bbb]"
                        >
                            No patients in this program yet.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}

function RemarksCell({ row, editing, setField }) {
    return (
        <textarea
            aria-label={`Remarks for ${row.name}`}
            className={remarksClass}
            placeholder="Add remarks..."
            disabled={!editing}
            value={row.remarks}
            onChange={(event) => setField(row.id, "remarks", event.target.value)}
        />
    );
}
