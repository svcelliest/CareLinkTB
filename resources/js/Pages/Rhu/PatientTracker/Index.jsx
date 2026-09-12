import { router, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Card, TreatmentStatus, cx } from "@/Components/ui";
import {
    CountBadge,
    ProgressBar,
    ProgressPill,
    RegisterCheckbox,
    TabStrip,
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
 * Both tabs are the RHU's to record. SPUTUM COLLECTION and DIAGNOSTIC
 * ASSESSMENT are edited here through one Edit / Save flow; the ICM program
 * screen shows the same columns and only monitors them. The keys a save may
 * write are the allow-list in RhuPatientTrackerController — the coordinator's
 * own remark beside the sputum columns is displayed, never posted back.
 */

const tabs = [
    { value: "sputum", label: "Sputum Collection" },
    { value: "diagnostic", label: "Diagnostic Assessment" },
];

/**
 * Final Classification → TB Diagnosis. Same codes and labels the ICM program
 * screen offers, so the one stored value reads identically in both portals.
 * RRTB BC is no longer offered; a record that already holds it still reads
 * as such (see `legacyDiagnosis`), it just cannot be chosen anew.
 */
const tbDiagnoses = [
    { value: "", label: "—" },
    { value: "bc_ds_tb", label: "DSTB BC" },
    { value: "cd_ds_tb", label: "DSTB CD" },
    { value: "none", label: "No TB" },
];

const legacyDiagnosis = { value: "rr_tb", label: "RRTB BC" };

/** The five positive sub-classifications, in register column order. */
const positiveCodes = [
    { code: "dssm", label: "DSSM (4)" },
    { code: "rr", label: "RR (5)" },
    { code: "t", label: "T (6)" },
    { code: "tt", label: "TT (7)" },
    { code: "ti", label: "TI (8)" },
];

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
    sputum_collected: patient.sputum_collected,
    not_collected_reason: patient.not_collected_reason,
    tested_gene_xpert: patient.tested_gene_xpert,
    tested_dssm: patient.tested_dssm,
    diagnostic_result: patient.diagnostic_result,
    positive_classification: patient.positive_classification,
    diagnostic_remarks: patient.diagnostic_remarks,
    tb_case_classification: patient.tb_case_classification,
});

export default function Index({ patients, filters, progress, municipality }) {
    const { errors } = usePage().props;
    const [tab, setTab] = useState(filters.tab ?? "sputum");
    const [search, setSearch] = useState(filters.search ?? "");
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

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

    /**
     * The five positive ticks and Negative are one stored answer, not six:
     * `diagnostic_result` plus `positive_classification`. Ticking one clears
     * the others, which is what stops a row reading as both positive and
     * negative.
     */
    const setResult = (id, code, checked) => {
        if (!checked) {
            setField(id, "diagnostic_result", "");
            setField(id, "positive_classification", "");
            return;
        }

        if (code === "negative") {
            setField(id, "diagnostic_result", "negative");
            setField(id, "positive_classification", "");
            return;
        }

        setField(id, "diagnostic_result", "positive");
        setField(id, "positive_classification", code);
    };

    const save = () => {
        setSaving(true);
        router.patch(
            route("rhu.tracker.diagnostic.update"),
            {
                patients: patients.map((patient) => ({
                    id: patient.id,
                    ...draft[patient.id],
                })),
            },
            {
                preserveScroll: true,
                onSuccess: () => setEditing(false),
                onFinish: () => setSaving(false),
            },
        );
    };

    const cancel = () => {
        setEditing(false);
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
                        patient.not_collected_reason,
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
                    patient.tested_gene_xpert === "1" ? "Yes" : "",
                    patient.tested_dssm === "1" ? "Yes" : "",
                    ...positiveCodes.map((entry) =>
                        patient.diagnostic_result === "positive" &&
                        patient.positive_classification === entry.code
                            ? "Yes"
                            : "",
                    ),
                    patient.diagnostic_result === "negative" ? "Yes" : "",
                    [...tbDiagnoses, legacyDiagnosis].find(
                        (option) => option.value === patient.tb_case_classification,
                    )?.label ?? "",
                    patient.treatment_status?.label,
                    patient.diagnostic_remarks,
                ]),
            ]),
        );
    };

    const rowError = useMemo(
        () => Object.entries(errors ?? {}).find(([key]) => key.startsWith("patients."))?.[1],
        [errors],
    );

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
                            {/* Diagnostic assessment is measured in tests, not
                                patients: each patient needs both GXpert and
                                DSSM, so one of the two reads as half done. */}
                            <ProgressStep
                                name="Diagnostic Assessment"
                                done={progress.tests_completed}
                                total={progress.tests_total}
                                unit="tests"
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
                        // Both tabs edit the one draft, so switching tabs while
                        // editing keeps the edits; Save posts both at once.
                        onChange={setTab}
                        label="Patient Tracker sections"
                    />

                    {rowError ? (
                        <p
                            role="alert"
                            className="border-b border-line-soft bg-brand-soft px-5 py-3 text-[12px] font-semibold text-brand"
                        >
                            {rowError}
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

                        <button
                            type="button"
                            onClick={exportCsv}
                            disabled={patients.length === 0}
                            className={actionButtonClass}
                        >
                            <FileDownloadOutlinedIcon sx={{ fontSize: 15 }} aria-hidden="true" />
                            Export File
                        </button>

                        {editing ? (
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
                        )}
                    </TableToolbar>

                    {tab === "sputum" ? (
                        <SputumTable
                            patients={patients}
                            draft={draft}
                            editing={editing}
                            setField={setField}
                        />
                    ) : (
                        <DiagnosticTable
                            patients={patients}
                            draft={draft}
                            editing={editing}
                            setField={setField}
                            setResult={setResult}
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

// The same skin as Patient Monitoring's Enroll Patient button, so the
// actions on the two screens match.
const actionButtonClass =
    "inline-flex items-center gap-[7px] rounded-md border border-brand bg-brand px-3.5 py-[9px] text-[10.5px] font-bold whitespace-nowrap text-white shadow-[0_2px_5px_rgba(192,57,43,0.16)] hover:border-brand-strong hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
    "inline-flex items-center gap-[7px] rounded-md border border-line bg-white px-3.5 py-[9px] text-[10.5px] font-bold whitespace-nowrap text-[#555] hover:border-brand hover:text-brand disabled:opacity-60";

/**
 * The strip above the table: the counts on the left, and on the right the
 * controls that act on that table — search, export, and the edit flow.
 *
 * `barTotal` lets the bar count something other than patients — the diagnostic
 * tab measures tests, while the badge beside it still counts patients.
 */
function TableToolbar({ total, label, done, barTotal, children }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line-soft px-5 py-3">
            <div className="flex flex-wrap items-center gap-3.5">
                <CountBadge>Total # of Patient: {total}</CountBadge>
                <ProgressBar label={label} done={done} total={barTotal ?? total} />
            </div>
            <div className="flex flex-wrap items-center gap-2">{children}</div>
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

function SputumTable({ patients, draft, editing, setField }) {
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
                                {/* Editable through the Edit flow; the coordinator's
                                    remark in the last column stays read-only. */}
                                <td className={tableCellClass}>
                                    {editing ? (
                                        <span className="inline-flex items-center gap-2">
                                            <RegisterCheckbox
                                                label={`Sputum collected for ${patient.name}`}
                                                checked={draft[patient.id]?.sputum_collected === "1"}
                                                onChange={(checked) =>
                                                    setField(
                                                        patient.id,
                                                        "sputum_collected",
                                                        checked ? "1" : "0",
                                                    )
                                                }
                                            />
                                            <span className="text-[11px] text-[#555]">Collected</span>
                                        </span>
                                    ) : (
                                        <ProgressPill
                                            done={patient.sputum_collected === "1" ? 1 : 0}
                                            total={1}
                                            labels={{
                                                done: "Collected",
                                                idle: "Not Collected",
                                            }}
                                        />
                                    )}
                                </td>
                                <td className={cx(tableCellClass, "text-left")}>
                                    {editing ? (
                                        <input
                                            type="text"
                                            aria-label={`Reason not collected for ${patient.name}`}
                                            className={registerInputClass}
                                            disabled={draft[patient.id]?.sputum_collected === "1"}
                                            placeholder={
                                                draft[patient.id]?.sputum_collected === "1"
                                                    ? "—"
                                                    : "Reason if not collected"
                                            }
                                            value={draft[patient.id]?.not_collected_reason ?? ""}
                                            onChange={(event) =>
                                                setField(
                                                    patient.id,
                                                    "not_collected_reason",
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    ) : (
                                        <span
                                            className={cx(
                                                "text-xs",
                                                patient.not_collected_reason ? "text-[#444]" : "text-[#bbb]",
                                            )}
                                        >
                                            {patient.not_collected_reason || "—"}
                                        </span>
                                    )}
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

function DiagnosticTable({ patients, draft, editing, setField, setResult }) {
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
                        <th className={cx(tableGroupHeadClass, "min-w-[145px]")} rowSpan={2}>
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
                                key={entry.code}
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
                                            checked={row.tested_gene_xpert === "1"}
                                            disabled={!editing}
                                            onChange={(checked) =>
                                                setField(
                                                    patient.id,
                                                    "tested_gene_xpert",
                                                    checked ? "1" : "",
                                                )
                                            }
                                        />
                                    </td>
                                    <td className={tableCellClass}>
                                        <RegisterCheckbox
                                            label={`Tested with DSSM: ${patient.name}`}
                                            checked={row.tested_dssm === "1"}
                                            disabled={!editing}
                                            onChange={(checked) =>
                                                setField(patient.id, "tested_dssm", checked ? "1" : "")
                                            }
                                        />
                                    </td>
                                    {positiveCodes.map((entry) => (
                                        <td key={entry.code} className={tableCellClass}>
                                            <RegisterCheckbox
                                                label={`${entry.label} positive: ${patient.name}`}
                                                checked={
                                                    row.diagnostic_result === "positive" &&
                                                    row.positive_classification === entry.code
                                                }
                                                disabled={!editing}
                                                onChange={(checked) =>
                                                    setResult(patient.id, entry.code, checked)
                                                }
                                            />
                                        </td>
                                    ))}
                                    <td className={tableCellClass}>
                                        <RegisterCheckbox
                                            label={`Negative result: ${patient.name}`}
                                            checked={row.diagnostic_result === "negative"}
                                            disabled={!editing}
                                            onChange={(checked) =>
                                                setResult(patient.id, "negative", checked)
                                            }
                                        />
                                    </td>
                                    <td className={tableCellClass}>
                                        <select
                                            aria-label={`TB diagnosis for ${patient.name}`}
                                            className={cx(registerSelectClass, "min-w-[135px]")}
                                            disabled={!editing}
                                            value={row.tb_case_classification ?? ""}
                                            onChange={(event) =>
                                                setField(
                                                    patient.id,
                                                    "tb_case_classification",
                                                    event.target.value,
                                                )
                                            }
                                        >
                                            {tbDiagnoses.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                            {/* Only so an existing RRTB BC record still
                                                shows its value; it cannot be picked. */}
                                            {row.tb_case_classification === legacyDiagnosis.value ? (
                                                <option value={legacyDiagnosis.value} disabled>
                                                    {legacyDiagnosis.label}
                                                </option>
                                            ) : null}
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
                                                value={row.diagnostic_remarks ?? ""}
                                                onChange={(event) =>
                                                    setField(
                                                        patient.id,
                                                        "diagnostic_remarks",
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        ) : (
                                            <span
                                                className={cx(
                                                    "text-xs",
                                                    row.diagnostic_remarks
                                                        ? "text-[#444]"
                                                        : "text-[#bbb]",
                                                )}
                                            >
                                                {row.diagnostic_remarks || "—"}
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
