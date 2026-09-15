import { Link, usePage } from "@inertiajs/react";
import { useMemo, useState } from "react";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import {
    FaChevronLeft,
    FaCircleCheck,
    FaCircleExclamation,
    FaLock,
    FaUserCheck,
    FaUsers,
} from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    Card,
    KpiCard,
    StatusPill,
    TreatmentStatus,
    actionButtonClass,
    cx,
} from "@/Components/ui";

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

/** Final Classification → TB Diagnosis. Values are what the RHU forms store. */
const tbDiagnoses = [
    { value: "bc_ds_tb", label: "DSTB BC" },
    { value: "cd_ds_tb", label: "DSTB CD" },
    { value: "rr_tb", label: "RRTB BC" },
    { value: "rr_dstb", label: "RR DSTB" },
    { value: "none", label: "No TB" },
];

/** The five positive sub-classifications, as the RHU's register labels them. */
const positiveCodes = [
    { code: "dssm", label: "DSSM (4)" },
    { code: "rr", label: "RR (5)" },
    { code: "t", label: "T (6)" },
    { code: "tt", label: "TT (7)" },
    { code: "ti", label: "TI (8)" },
];

// Every table on this screen scrolls inside its card, and its whole <thead>
// is sticky against that scroller. Headings and recorded values read black;
// nothing here is editable, and a greyed-out value is harder to read, not
// more honest.
const cellClass =
    "border-r border-b border-[#f5f0f0] px-3 py-[9px] text-center align-middle text-ink";
const headClass =
    "border-r border-b-2 border-line-soft bg-[#faf7f7] px-3 py-2.5 text-center align-bottom text-[11px] leading-tight font-bold text-ink";
const groupHeadClass =
    "border-r border-b-2 border-line-soft bg-line-soft px-3 py-2.5 text-center align-bottom text-[11px] font-bold tracking-wide text-brand uppercase";
// Alignment is added per column: `text-left` and `text-center` together would
// let whichever the stylesheet lists last win, not the one the column wants.
const registerHeadClass =
    "border-b border-line-soft bg-white px-[18px] py-2.5 text-[11px] font-bold tracking-wide text-ink";

/** Rows in surname-first alphabetical order, as the register lists them. */
const byName = (a, b) =>
    String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, {
        sensitivity: "base",
    });

export default function Show({ program }) {
    const { flash } = usePage().props;
    const [tab, setTab] = useState("record");
    // Every tab is view-only for the coordinator: program details are edited
    // from the program list, and sputum collection and the diagnostic
    // assessment are recorded by the RHU in its Patient Tracker. This screen
    // monitors them.

    const statusLabel = statusLabels[program.status] ?? program.status;
    const isFormTab = tab === "sputum" || tab === "diagnostic";

    const rows = useMemo(() => [...program.patients].sort(byName), [program.patients]);

    const collectedCount = rows.filter(
        (row) => row.sputum_collected === "1",
    ).length;
    const collectedPct = rows.length
        ? Math.round((collectedCount / rows.length) * 100)
        : 0;

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

                {/* The tab body: each table wrap is the scroller so the
                    sticky headers stick to it, not to the page. */}
                <div className="flex min-h-0 flex-1 flex-col px-6 pt-4 pb-6">
                    {tab === "record" && (
                        <ProgramRecord program={program} rows={rows} />
                    )}

                    {isFormTab && (
                        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
                            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-line-soft px-5 py-3.5">
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

                                <ExportButton />
                            </div>

                            <div className="min-h-0 flex-1 overflow-auto">
                                {tab === "sputum" ? (
                                    <SputumTable rows={rows} />
                                ) : (
                                    <DiagnosticTable rows={rows} />
                                )}
                            </div>
                        </Card>
                    )}
                </div>
            </section>
        </DashboardLayout>
    );
}

/** The program's export, in the same skin as the RHU portal's Export File. */
function ExportButton() {
    return (
        <a href={route("icm.programs.export")} className={actionButtonClass}>
            <FileDownloadOutlinedIcon sx={{ fontSize: 15 }} aria-hidden="true" />
            Export File
        </a>
    );
}

function ProgramRecord({ program, rows }) {
    return (
        <>
            <div className="mb-[18px] grid shrink-0 gap-3.5 sm:grid-cols-3">
                <KpiCard
                    label="Total Patients"
                    value={program.patient_counts.total}
                    sub="Registered in this program"
                    icon={<FaUsers />}
                    accent={{ bg: "#eef2ff", fg: "#4a7cf7" }}
                />
                <KpiCard
                    label="Normal"
                    value={program.patient_counts.normal}
                    sub="No TB symptoms found"
                    icon={<FaUserCheck />}
                    accent={{ bg: "#edfaf3", fg: "#27ae60" }}
                />
                <KpiCard
                    label="Presumptive TB"
                    value={program.patient_counts.presumptive}
                    sub="Referred for diagnostic testing"
                    icon={<FaCircleExclamation />}
                    accent={{ bg: "#fff6e6", fg: "#e2941b" }}
                />
            </div>

            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-line-soft px-5 py-3.5">
                    <div className="flex items-center gap-3.5">
                        <span className="text-sm font-bold text-ink">
                            Registered Patients
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f0f0f0] px-2.5 py-1 text-[11px] font-semibold text-muted">
                            <FaLock className="size-3" aria-hidden="true" />
                            View Only
                        </span>
                    </div>
                    <ExportButton />
                </div>

                <div className="min-h-0 flex-1 overflow-auto">
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-[2]">
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
                                        className={cx(
                                            registerHeadClass,
                                            heading === "Status" ? "text-center" : "text-left",
                                        )}
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
                                        <td className="border-b border-[#f8f2f2] px-[18px] py-3 text-center">
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


/** A recorded value, or a quiet dash when the RHU has not filled it yet. */
function Recorded({ value, className = "" }) {
    return value ? (
        <span className={className}>{value}</span>
    ) : (
        <span className="text-[#bbb]">—</span>
    );
}

/**
 * The GXpert (3a) / DSSM (3b) column for one row. The register stores one
 * result — Positive with its sub-classification, or Negative — against
 * whichever test was done, so the tested column carries it and the other
 * reads as not done. A test ticked without a result yet reads as such.
 */
function testResult(row, tested) {
    if (tested !== "1") return "";
    if (row.diagnostic_result === "negative") return "Negative";
    if (row.diagnostic_result === "positive") {
        const code = positiveCodes.find((entry) => entry.code === row.positive_classification);

        return code ? `Positive — ${code.label}` : "Positive";
    }

    return "Tested — no result yet";
}

const diagnosisLabel = (value) =>
    tbDiagnoses.find((option) => option.value === value && value !== "")?.label ?? "";

function SputumTable({ rows }) {
    return (
        <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-[2]">
                <tr>
                    <th className={cx(headClass, "min-w-[60px]")}>No.</th>
                    <th className={cx(headClass, "min-w-[160px] text-left")}>Patient Name</th>
                    <th className={cx(headClass, "min-w-[120px]")}>Sputum Collected</th>
                    <th className={cx(headClass, "min-w-[180px]")}>
                        Initial Reason if not Collected
                    </th>
                    <th className={cx(headClass, "min-w-[220px] text-left")}>Remarks</th>
                </tr>
            </thead>
            <tbody>
                {rows.length > 0 ? (
                    rows.map((row) => (
                        <tr key={row.id} className="hover:bg-[#fdf8f8]">
                            <td className={cellClass}>{row.number}</td>
                            <td className={cx(cellClass, "text-left font-medium")}>{row.name}</td>
                            <td className={cellClass}>
                                {row.sputum_collected === "1" ? (
                                    <StatusPill tone="active">Yes</StatusPill>
                                ) : row.sputum_collected === "0" ? (
                                    <StatusPill tone="disabled">No</StatusPill>
                                ) : (
                                    <span className="text-[#bbb]">—</span>
                                )}
                            </td>
                            <td className={cellClass}>
                                <Recorded value={row.not_collected_reason} />
                            </td>
                            <td className={cx(cellClass, "text-left whitespace-normal")}>
                                <Recorded value={row.remarks} />
                            </td>
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-[#bbb]">
                            No patients in this program yet.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}

function DiagnosticTable({ rows }) {
    return (
        <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-[2]">
                <tr>
                    <th className={cx(headClass, "min-w-[60px]")} rowSpan={2}>
                        No.
                    </th>
                    <th className={cx(headClass, "min-w-[160px] text-left")} rowSpan={2}>
                        Patient Name
                    </th>
                    <th className={groupHeadClass} colSpan={2}>
                        Diagnostic Testing
                    </th>
                    <th className={groupHeadClass} colSpan={3}>
                        Final Classification
                    </th>
                </tr>
                <tr>
                    <th className={cx(headClass, "min-w-[150px]")}>GXpert Result (3a)</th>
                    <th className={cx(headClass, "min-w-[150px]")}>DSSM Result (3b)</th>
                    <th className={cx(headClass, "min-w-[120px]")}>TB Diagnosis</th>
                    <th className={cx(headClass, "min-w-[140px]")}>Treatment Status</th>
                    <th className={cx(headClass, "min-w-[220px] text-left")}>Remarks</th>
                </tr>
            </thead>
            <tbody>
                {rows.length > 0 ? (
                    rows.map((row) => (
                        <tr key={row.id} className="hover:bg-[#fdf8f8]">
                            <td className={cellClass}>{row.number}</td>
                            <td className={cx(cellClass, "text-left font-medium")}>{row.name}</td>
                            <td className={cellClass}>
                                <Recorded value={testResult(row, row.tested_gene_xpert)} />
                            </td>
                            <td className={cellClass}>
                                <Recorded value={testResult(row, row.tested_dssm)} />
                            </td>
                            <td className={cellClass}>
                                <Recorded
                                    value={diagnosisLabel(row.tb_case_classification)}
                                    className="font-semibold"
                                />
                            </td>
                            {/* Follows the treatment register: "On Treatment"
                                once the RHU enrols the patient. */}
                            <td className={cellClass}>
                                <TreatmentStatus status={row.treatment_status} />
                            </td>
                            <td className={cx(cellClass, "text-left whitespace-normal")}>
                                <Recorded value={row.diagnostic_remarks} />
                            </td>
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-[#bbb]">
                            No patients in this program yet.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}
