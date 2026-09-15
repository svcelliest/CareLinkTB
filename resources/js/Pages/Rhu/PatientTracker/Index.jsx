import { router } from "@inertiajs/react";
import { useEffect, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    Card,
    TreatmentStatus,
    actionButtonClass,
    cx,
    secondaryActionButtonClass as secondaryButtonClass,
} from "@/Components/ui";
import {
    ProgressBar,
    ProgressPill,
    RegisterCheckbox,
    TabStrip,
    TableToolbar,
    registerInputClass,
    registerSelectClass,
    tableCellClass,
    tableGroupHeadClass,
    tableHeadClass,
    tableSubHeadClass,
} from "@/Components/rhu";

/**
 * Patient Tracker — the RHU's two-tab view of the patients screened into its
 * municipality.
 *
 * Sputum Collection is ICM-owned and shown read-only here — the ICM program
 * screen records it (see SputumCollectionController). Diagnostic Assessment
 * is the RHU's own, saved one patient at a time through
 * DiagnosticAssessmentController; a GXpert/DSSM read can flag more than one
 * classification at once, so each result column is its own independent
 * checkbox rather than one mutually-exclusive answer.
 */

const tabs = [
    { value: "sputum", label: "Sputum Collection" },
    { value: "diagnostic", label: "Diagnostic Assessment" },
];

const sputumReasonLabels = {
    no_rhu_staff_or_bhw: "No RHU staff/BHW available",
    patient_refused: "Patient refused",
    patient_absent: "Patient absent",
    no_supplies: "No supplies",
    other: "Other",
};

/** Final Classification → TB Diagnosis, as diagnostic_assessments.tb_diagnosis stores it. */
const tbDiagnoses = [
    { value: "", label: "—" },
    { value: "dstb_cd", label: "DSTB, Clinically Diagnosed" },
    { value: "dstb_bc", label: "DSTB, Bacteriologically Confirmed" },
    { value: "rrtb_bc", label: "RR-TB, Bacteriologically Confirmed" },
];

/** The five positive result flags, in register column order. */
const positiveCodes = [
    { field: "result_dssm", label: "DSSM (4)" },
    { field: "result_rr", label: "RR (5)" },
    { field: "result_t", label: "T (6)" },
    { field: "result_tt", label: "TT (7)" },
    { field: "result_ti", label: "TI (8)" },
];

function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? "";
}

async function apiRequest(method, url, payload) {
    const response = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-CSRF-TOKEN": csrfToken(),
        },
        credentials: "same-origin",
        body: JSON.stringify(payload ?? {}),
    });

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        throw new Error(data?.message ?? "The diagnostic assessment could not be saved.");
    }

    return data;
}

function toCsv(rows) {
    return rows
        .map((row) =>
            row
                .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
                .join(","),
        )
        .join("\n");
}

function download(filename, csv) {
    const link = document.createElement("a");
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = filename;
    link.click();
}

/** The editable half of a row, seeded from what the server sent. */
const rowDraft = (patient) => ({
    tested_with_gxpert: patient.tested_with_gxpert,
    tested_with_dssm: patient.tested_with_dssm,
    result_dssm: patient.result_dssm,
    result_rr: patient.result_rr,
    result_t: patient.result_t,
    result_tt: patient.result_tt,
    result_ti: patient.result_ti,
    result_negative: patient.result_negative,
    tb_diagnosis: patient.tb_diagnosis ?? "",
    remarks: patient.diagnostic_remarks ?? "",
});

export default function Index({ patients, programs, filters, progress, municipality }) {
    const [tab, setTab] = useState(filters.tab ?? "sputum");
    const [search, setSearch] = useState(filters.search ?? "");
    const [program, setProgram] = useState(filters.program ?? "");
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    // The edit buffer. Keyed by patient id so a server refresh (a filter
    // change, another tab's save) can reseed it without losing the mapping.
    const [draft, setDraft] = useState({});

    useEffect(() => {
        setDraft(Object.fromEntries(patients.map((patient) => [patient.id, rowDraft(patient)])));
    }, [patients]);

    const visit = (next = {}) => {
        router.get(
            route("rhu.tracker.index"),
            {
                search: (next.search ?? search).trim() || undefined,
                program: (next.program ?? program) || undefined,
                tab: next.tab ?? tab,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const setField = (id, field, value) =>
        setDraft((current) => ({
            ...current,
            [id]: { ...current[id], [field]: value },
        }));

    const save = async () => {
        setSaving(true);
        setSaveError("");

        try {
            await Promise.all(
                patients.map((patient) =>
                    apiRequest("POST", route("rhu.patients.diagnostic-assessment.store", patient.id), draft[patient.id]),
                ),
            );
            setEditing(false);
            router.reload({ only: ["patients", "progress"] });
        } catch (error) {
            setSaveError(error.message ?? "The diagnostic assessment could not be saved.");
        } finally {
            setSaving(false);
        }
    };

    const cancel = () => {
        setEditing(false);
        setSaveError("");
        setDraft(Object.fromEntries(patients.map((patient) => [patient.id, rowDraft(patient)])));
    };

    const exportCsv = () => {
        if (tab === "sputum") {
            download(
                "patient-tracker-sputum-collection.csv",
                toCsv([
                    [
                        "No.",
                        "Patient Name",
                        "Contact Number",
                        "Home Address",
                        "Sputum Collected",
                        "Initial Reason if not Collected",
                        "Remarks",
                    ],
                    ...patients.map((patient) => [
                        patient.number,
                        patient.name,
                        patient.contact_number,
                        patient.address,
                        patient.sputum_collected === "1" ? "Collected" : "Not Collected",
                        sputumReasonLabels[patient.not_collected_reason] ?? patient.not_collected_reason,
                        patient.icm_remarks,
                    ]),
                ]),
            );
            return;
        }

        download(
            "patient-tracker-diagnostic-assessment.csv",
            toCsv([
                [
                    "No.",
                    "Patient Name",
                    "Tested w/ GXpert (3a)",
                    "Tested w/ DSSM (3b)",
                    ...positiveCodes.map((entry) => entry.label),
                    "Negative (9)",
                    "TB Diagnosis",
                    "Treatment Status",
                    "Remarks",
                ],
                ...patients.map((patient) => [
                    patient.number,
                    patient.name,
                    patient.tested_with_gxpert ? "Yes" : "",
                    patient.tested_with_dssm ? "Yes" : "",
                    ...positiveCodes.map((entry) => (patient[entry.field] ? "Yes" : "")),
                    patient.result_negative ? "Yes" : "",
                    tbDiagnoses.find((option) => option.value === patient.tb_diagnosis)?.label ?? "",
                    patient.treatment_status?.label,
                    patient.diagnostic_remarks,
                ]),
            ]),
        );
    };

    return (
        <DashboardLayout role="rhu" title="Patient Tracker">
            <div className="font-ui">
                <Card className="overflow-hidden rounded-[14px] shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
                    {/* Header — the caption only; search and the actions sit
                        on the section toolbar beside the table they act on. */}
                    {municipality ? (
                        <div className="border-b border-line-soft px-[22px] py-4">
                            <p className="text-[11.5px] text-muted">
                                Patients screened into RHU {municipality}
                            </p>
                        </div>
                    ) : null}

                    {/* Patient Tracker Progress */}
                    <div className="border-b border-line-soft px-5 py-4">
                        <h3 className="mb-3 text-[11px] font-bold tracking-[0.5px] text-muted uppercase">
                            Patient Tracker Progress
                        </h3>
                        <div className="mb-3.5 flex flex-wrap gap-2.5">
                            <ProgressStep
                                name="Sputum Collection"
                                done={progress.collected}
                                total={progress.total}
                                unit="patients"
                            />
                            {/* One test per patient — GXpert or DSSM — so a
                                patient is done once either is recorded. */}
                            <ProgressStep
                                name="Diagnostic Assessment"
                                done={progress.tests_completed}
                                total={progress.tests_total}
                                unit="patients"
                            />
                        </div>
                        <ProgressBar
                            label="Overall Progress"
                            done={progress.collected + progress.tests_completed}
                            total={progress.total + progress.tests_total}
                            className="w-full"
                        />
                    </div>

                    <TabStrip
                        tabs={tabs}
                        value={tab}
                        // Both tabs share one draft, so switching tabs while
                        // editing keeps the edits; Save posts every changed row.
                        onChange={setTab}
                        label="Patient Tracker sections"
                    />

                    {saveError ? (
                        <p
                            role="alert"
                            className="border-b border-line-soft bg-brand-soft px-5 py-3 text-[12px] font-semibold text-brand"
                        >
                            {saveError}
                        </p>
                    ) : null}

                    <TableToolbar
                        total={progress.total}
                        label={tab === "sputum" ? "Collection Progress" : "Assessment Progress"}
                        done={tab === "sputum" ? progress.collected : progress.tests_completed}
                        barTotal={tab === "sputum" ? undefined : progress.tests_total}
                    >
                        <label htmlFor="tracker-search" className="sr-only">
                            Search patient
                        </label>
                        <div className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-[7px] focus-within:border-brand">
                            <SearchRoundedIcon
                                sx={{ fontSize: 16, color: "#aaa" }}
                                aria-hidden="true"
                            />
                            <input
                                id="tracker-search"
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") visit();
                                }}
                                onBlur={() => visit()}
                                placeholder="Search patient…"
                                className="w-[160px] border-0 p-0 text-[12px] outline-none placeholder:text-[#aaa] [&::-webkit-search-cancel-button]:hidden"
                            />
                        </div>

                        <label htmlFor="tracker-program" className="sr-only">
                            Filter by program
                        </label>
                        <select
                            id="tracker-program"
                            value={program}
                            onChange={(event) => {
                                setProgram(event.target.value);
                                visit({ program: event.target.value });
                            }}
                            className="rounded-md border border-line bg-white px-2.5 py-[7px] text-[12px] outline-none focus:border-brand"
                        >
                            <option value="">All Programs</option>
                            {programs.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.name} — {option.date_label}
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={exportCsv}
                            disabled={patients.length === 0}
                            className={actionButtonClass}
                        >
                            <FileDownloadOutlinedIcon sx={{ fontSize: 15 }} aria-hidden="true" />
                            Export File
                        </button>

                        {tab === "diagnostic" ? (
                            editing ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={cancel}
                                        disabled={saving}
                                        className={secondaryButtonClass}
                                    >
                                        <CloseRoundedIcon sx={{ fontSize: 15 }} aria-hidden="true" />
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={save}
                                        disabled={saving}
                                        className={actionButtonClass}
                                    >
                                        <SaveOutlinedIcon sx={{ fontSize: 15 }} aria-hidden="true" />
                                        {saving ? "Saving…" : "Save"}
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setEditing(true)}
                                    disabled={patients.length === 0}
                                    className={actionButtonClass}
                                >
                                    <EditOutlinedIcon sx={{ fontSize: 15 }} aria-hidden="true" />
                                    Edit
                                </button>
                            )
                        ) : null}
                    </TableToolbar>

                    {tab === "sputum" ? (
                        <SputumTable patients={patients} />
                    ) : (
                        <DiagnosticTable
                            patients={patients}
                            draft={draft}
                            editing={editing}
                            setField={setField}
                        />
                    )}
                </Card>
            </div>
        </DashboardLayout>
    );
}

function ProgressStep({ name, done, total, unit }) {
    return (
        <div className="flex min-w-0 flex-1 basis-[220px] items-center justify-between gap-2.5 rounded-[9px] border border-line-soft bg-[#fbf9f9] px-[13px] py-2.5">
            <span className="text-[12.5px] font-semibold text-[#333]">{name}</span>
            <span className="flex items-center gap-[9px] whitespace-nowrap">
                <ProgressPill done={done} total={total} />
                <span className="text-[11px] text-[#999]">
                    {done} / {total}
                    {unit ? ` ${unit}` : ""}
                </span>
            </span>
        </div>
    );
}

function EmptyRow({ colSpan }) {
    return (
        <tr>
            <td colSpan={colSpan} className="px-6 py-12 text-center text-[13px] text-[#bbb]">
                No patients assigned yet. Patients appear here once they are screened into
                a program in your municipality.
            </td>
        </tr>
    );
}

/** Read-only: Sputum Collection is ICM-owned (see SputumCollectionController). */
function SputumTable({ patients }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs whitespace-nowrap">
                <thead>
                    <tr>
                        <th className={cx(tableHeadClass, "min-w-[60px] text-ink")}>No.</th>
                        <th className={cx(tableHeadClass, "min-w-[150px] text-ink")}>
                            Patient Name
                        </th>
                        <th className={cx(tableHeadClass, "min-w-[120px]")}>
                            Contact Number
                        </th>
                        <th className={cx(tableHeadClass, "min-w-[160px]")}>Home Address</th>
                        <th className={cx(tableHeadClass, "min-w-[120px]")}>
                            Sputum Collected
                        </th>
                        <th className={cx(tableHeadClass, "min-w-[180px]")}>
                            Initial Reason if not Collected
                        </th>
                        <th className={cx(tableHeadClass, "min-w-[200px]")}>Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    {patients.length === 0 ? (
                        <EmptyRow colSpan={7} />
                    ) : (
                        patients.map((patient) => (
                            <tr
                                key={patient.id}
                                className={cx(
                                    "hover:bg-[#fdf8f8]",
                                    patient.sputum_collected === "1" && "bg-[#fff5f5]",
                                )}
                            >
                                <td className={tableCellClass}>{patient.number}</td>
                                <td className={cx(tableCellClass, "text-left font-medium text-ink")}>
                                    {patient.name}
                                </td>
                                <td className={tableCellClass}>{patient.contact_number || "—"}</td>
                                <td className={cx(tableCellClass, "text-left text-[11px] text-[#666]")}>
                                    {patient.address || "—"}
                                </td>
                                <td className={tableCellClass}>
                                    <ProgressPill
                                        done={patient.sputum_collected === "1" ? 1 : 0}
                                        total={1}
                                        labels={{
                                            done: "Collected",
                                            idle: "Not Collected",
                                        }}
                                    />
                                </td>
                                <td className={cx(tableCellClass, "text-left")}>
                                    <span
                                        className={cx(
                                            "text-xs",
                                            patient.not_collected_reason ? "text-[#444]" : "text-[#bbb]",
                                        )}
                                    >
                                        {sputumReasonLabels[patient.not_collected_reason] ??
                                            patient.not_collected_reason ??
                                            "—"}
                                    </span>
                                </td>
                                <td className={cx(tableCellClass, "min-w-[200px] text-left")}>
                                    <span
                                        className={cx(
                                            "text-xs",
                                            patient.icm_remarks ? "text-[#444]" : "text-[#bbb]",
                                        )}
                                    >
                                        {patient.icm_remarks || "—"}
                                    </span>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

function DiagnosticTable({ patients, draft, editing, setField }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs whitespace-nowrap">
                <thead>
                    <tr>
                        <th className={cx(tableHeadClass, "min-w-[60px] text-ink")} rowSpan={3}>
                            No.
                        </th>
                        <th className={cx(tableHeadClass, "min-w-[150px] text-ink")} rowSpan={3}>
                            Patient Name
                        </th>
                        <th className={tableGroupHeadClass} colSpan={8}>
                            Diagnostic Testing
                        </th>
                        <th className={tableGroupHeadClass} colSpan={3}>
                            Final Classification
                        </th>
                    </tr>
                    <tr>
                        <th className={cx(tableHeadClass, "min-w-[70px]")} rowSpan={2}>
                            Tested w/ GXpert (3a)
                        </th>
                        <th className={cx(tableHeadClass, "min-w-[70px]")} rowSpan={2}>
                            Tested w/ DSSM (3b)
                        </th>
                        <th className={tableGroupHeadClass} colSpan={5}>
                            GXpert or DSSM Result – Positive
                        </th>
                        <th className={cx(tableHeadClass, "min-w-[70px]")} rowSpan={2}>
                            Negative (9)
                        </th>
                        <th className={cx(tableGroupHeadClass, "min-w-[190px]")} rowSpan={2}>
                            TB Diagnosis
                        </th>
                        <th className={cx(tableGroupHeadClass, "min-w-[145px]")} rowSpan={2}>
                            Treatment Status
                        </th>
                        <th className={cx(tableGroupHeadClass, "min-w-[220px]")} rowSpan={2}>
                            Remarks
                        </th>
                    </tr>
                    <tr>
                        {positiveCodes.map((entry) => (
                            <th
                                key={entry.field}
                                className={cx(tableSubHeadClass, "min-w-[60px]")}
                            >
                                {entry.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {patients.length === 0 ? (
                        <EmptyRow colSpan={13} />
                    ) : (
                        patients.map((patient) => {
                            const row = draft[patient.id] ?? {};

                            return (
                                <tr key={patient.id} className="hover:bg-[#fdf8f8]">
                                    <td className={tableCellClass}>{patient.number}</td>
                                    <td className={cx(tableCellClass, "text-left font-medium text-ink")}>
                                        {patient.name}
                                    </td>
                                    <td className={tableCellClass}>
                                        <RegisterCheckbox
                                            label={`Tested with GXpert: ${patient.name}`}
                                            checked={!!row.tested_with_gxpert}
                                            disabled={!editing}
                                            onChange={(checked) =>
                                                setField(patient.id, "tested_with_gxpert", checked)
                                            }
                                        />
                                    </td>
                                    <td className={tableCellClass}>
                                        <RegisterCheckbox
                                            label={`Tested with DSSM: ${patient.name}`}
                                            checked={!!row.tested_with_dssm}
                                            disabled={!editing}
                                            onChange={(checked) =>
                                                setField(patient.id, "tested_with_dssm", checked)
                                            }
                                        />
                                    </td>
                                    {positiveCodes.map((entry) => (
                                        <td key={entry.field} className={tableCellClass}>
                                            <RegisterCheckbox
                                                label={`${entry.label} positive: ${patient.name}`}
                                                checked={!!row[entry.field]}
                                                disabled={!editing}
                                                onChange={(checked) =>
                                                    setField(patient.id, entry.field, checked)
                                                }
                                            />
                                        </td>
                                    ))}
                                    <td className={tableCellClass}>
                                        <RegisterCheckbox
                                            label={`Negative result: ${patient.name}`}
                                            checked={!!row.result_negative}
                                            disabled={!editing}
                                            onChange={(checked) =>
                                                setField(patient.id, "result_negative", checked)
                                            }
                                        />
                                    </td>
                                    <td className={tableCellClass}>
                                        <select
                                            aria-label={`TB diagnosis for ${patient.name}`}
                                            className={cx(registerSelectClass, "min-w-[135px]")}
                                            disabled={!editing}
                                            value={row.tb_diagnosis ?? ""}
                                            onChange={(event) =>
                                                setField(patient.id, "tb_diagnosis", event.target.value)
                                            }
                                        >
                                            {tbDiagnoses.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    {/* Derived from the treatment register, so
                                        it stays read-only even while editing. */}
                                    <td className={tableCellClass}>
                                        <TreatmentStatus status={patient.treatment_status} />
                                    </td>
                                    <td className={cx(tableCellClass, "min-w-[220px] text-left")}>
                                        {editing ? (
                                            <input
                                                aria-label={`Diagnostic remarks for ${patient.name}`}
                                                className={cx(registerInputClass, "text-left")}
                                                value={row.remarks ?? ""}
                                                onChange={(event) =>
                                                    setField(patient.id, "remarks", event.target.value)
                                                }
                                            />
                                        ) : (
                                            <span
                                                className={cx(
                                                    "text-xs",
                                                    row.remarks ? "text-[#444]" : "text-[#bbb]",
                                                )}
                                            >
                                                {row.remarks || "—"}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
