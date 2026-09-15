import { router } from "@inertiajs/react";
import { useState } from "react";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Card, actionButtonClass, cx } from "@/Components/ui";
import {
    TableToolbar,
    tableCellClass,
    tableGroupHeadClass,
    tableHeadClass,
} from "@/Components/rhu";

/**
 * ICM Contact Tracing — the ACF contact tracing register.
 *
 * One row per patient currently under treatment (the existing open-case
 * scope, so completed and closed cases drop off on their own), with every
 * answer of the RHU's contact tracing form as a column. Every answer is
 * printed as plain text — no input, select or checkbox anywhere in the row —
 * because nothing here writes: the RHU files the form from Patient
 * Monitoring, and this screen only monitors it.
 *
 * The toolbar and register cells are the RHU Patient Tracker's primitives,
 * reused rather than restyled.
 */

/**
 * The register's columns, in the order the ACF form asks them. `kind` says
 * how a value is read for display (dates are reformatted; everything else is
 * printed as recorded).
 */
const groups = [
    {
        title: "1. ACF Activity",
        columns: [
            { key: "registry_no", label: "TB Registry Number", kind: "text", width: 150 },
            { key: "patient_name", label: "TB Patient Name (Enrolled in TB DOTS)", kind: "name", width: 220 },
            { key: "phone", label: "Patient's Phone Number", kind: "text", width: 150 },
            { key: "patient_address", label: "Patient's Address (Base in Attendance Sheet)", kind: "text", width: 240 },
            { key: "acf_date", label: "Date of ACF Activity", kind: "date", width: 140 },
            { key: "province", label: "Province", kind: "text", width: 130 },
            { key: "municipality", label: "Municipality", kind: "text", width: 130 },
            { key: "community", label: "Community", kind: "text", width: 150 },
        ],
    },
    {
        title: "2. Patient Follow-up",
        columns: [
            { key: "visit_date", label: "Date of Call or Home Visit", kind: "date", width: 140 },
            { key: "visit_type", label: "Call or Home Visit?", kind: "select", width: 140 },
            { key: "rhu_contacted", label: "1. Has the RHU/CHO contacted you?", kind: "select", width: 150 },
            { key: "started_medication", label: "Have you started medication?", kind: "select", width: 150 },
            { key: "accompaniment", label: "2. Do you have accompaniment to the RHU?", kind: "select", width: 160 },
        ],
    },
    {
        title: "3. Household Assessment",
        columns: [
            { key: "household_total", label: "3. How many people live in your household?", kind: "number", width: 150 },
            { key: "household_symptoms", label: "4. How many HH members have symptoms?", kind: "number", width: 150 },
            { key: "household_tb", label: "5. How many HH members have TB?", kind: "number", width: 150 },
            { key: "household_taking_meds", label: "If have, are they taking TB medication?", kind: "select", width: 160 },
            { key: "referral_cards", label: "6. Were referral cards given?", kind: "select", width: 140 },
            { key: "tpt_total", label: "7. If already, how many HH members enrolled in preventive therapy (TPT)?", kind: "number", width: 190 },
        ],
    },
    {
        title: "4. TPT Enrollment",
        columns: [
            { key: "tpt_0_to_4", label: "# enrolled in TPT, 0 to 4 years old", kind: "number", width: 150 },
            { key: "tpt_5_to_14", label: "# enrolled in TPT, 5 to 14 years old", kind: "number", width: 150 },
            { key: "tpt_15_plus", label: "# enrolled in TPT, 15 years old and above", kind: "number", width: 160 },
            { key: "tpt_reason", label: "Reason why HH members not enrolled for TPT", kind: "select", width: 200 },
            { key: "enumerator", label: "Enumerator Name", kind: "text", width: 170 },
        ],
    },
];

const columns = groups.flatMap((group) => group.columns);

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

/** A row's value for a column — the patient's name comes from the case. */
const cellValue = (row, column) =>
    column.kind === "name" ? row.patient_name : (row.tracing[column.key] ?? "");

/**
 * A recorded ISO date as the rest of the portal prints one ("Sep 14, 2026").
 * Anything that is not a plain `YYYY-MM-DD` is shown as recorded.
 */
function dateLabel(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return value;

    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" },
    );
}

export default function Index({ cases, filters, stats }) {
    const [search, setSearch] = useState(filters.search ?? "");

    const visit = () =>
        router.get(
            route("icm.contact-tracing.index"),
            { search: search.trim() || undefined },
            { preserveState: true, preserveScroll: true, replace: true },
        );

    const exportCsv = () =>
        download(
            "contact-tracing-register.csv",
            toCsv([
                ["No.", "TB Registry No.", ...columns.map((column) => column.label)],
                ...cases.map((row) => [
                    row.number,
                    row.case_number,
                    ...columns.map((column) => cellValue(row, column)),
                ]),
            ]),
        );

    return (
        <DashboardLayout
            role="icm"
            title="Contact Tracing"
            contentClassName="dash-content-program-detail"
        >
            <section className="flex h-full min-h-0 flex-col p-6 font-ui">
                <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <TableToolbar
                        badge="Total # of TB Patients"
                        total={stats.under_treatment}
                        label="Tracing Progress"
                        done={stats.traced}
                    >
                        <label htmlFor="tracing-search" className="sr-only">
                            Search patient or case number
                        </label>
                        <div className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-[7px] focus-within:border-brand">
                            <SearchRoundedIcon
                                sx={{ fontSize: 16, color: "#aaa" }}
                                aria-hidden="true"
                            />
                            <input
                                id="tracing-search"
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") visit();
                                }}
                                onBlur={visit}
                                placeholder="Search…"
                                className="w-[160px] border-0 p-0 text-[12px] outline-none placeholder:text-[#aaa] [&::-webkit-search-cancel-button]:hidden"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={exportCsv}
                            disabled={cases.length === 0}
                            className={actionButtonClass}
                        >
                            <FileDownloadOutlinedIcon sx={{ fontSize: 15 }} aria-hidden="true" />
                            Export File
                        </button>
                    </TableToolbar>

                    {/* The wrap is the scroller, so the two header rows stay
                        put while the register scrolls under them. Separate
                        borders, not collapsed: Chrome and Edge drop collapsed
                        cell borders from a sticky header, so its rule would
                        scroll away with the rows. */}
                    <div className="min-h-0 flex-1 overflow-auto">
                        <table className="w-full border-separate border-spacing-0 text-xs whitespace-nowrap">
                            <thead className="sticky top-0 z-[2]">
                                <tr>
                                    <th
                                        className={cx(tableHeadClass, "min-w-[56px] text-ink")}
                                        rowSpan={2}
                                    >
                                        No.
                                    </th>
                                    {groups.map((group) => (
                                        <th
                                            key={group.title}
                                            className={tableGroupHeadClass}
                                            colSpan={group.columns.length}
                                        >
                                            {group.title}
                                        </th>
                                    ))}
                                </tr>
                                <tr>
                                    {columns.map((column) => (
                                        <th
                                            key={column.key}
                                            className={cx(tableHeadClass, "text-ink")}
                                            style={{ minWidth: column.width }}
                                        >
                                            {column.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {cases.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={columns.length + 1}
                                            className="px-6 py-12 text-center text-[13px] text-[#bbb]"
                                        >
                                            {filters.search
                                                ? "No patient under treatment matches this search."
                                                : "Patients appear here once an RHU enrolls them in TB treatment."}
                                        </td>
                                    </tr>
                                ) : (
                                    cases.map((row) => (
                                        <tr key={row.id} className="hover:bg-[#fdf8f8]">
                                            <td className={cx(tableCellClass, "text-ink")}>
                                                {row.number}
                                            </td>
                                            {columns.map((column) => (
                                                <td key={column.key} className={tableCellClass}>
                                                    <RegisterCell row={row} column={column} />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </section>
        </DashboardLayout>
    );
}

/**
 * One register cell: the recorded answer as plain text, or a dash.
 *
 * Free text (a name, an address) wraps inside its own column width instead of
 * stretching the register wider; dates, counts and chosen answers are short
 * and stay on one line.
 */
function RegisterCell({ row, column }) {
    const value = cellValue(row, column);
    const wrapStyle = { maxWidth: column.width - 24 };

    if (column.kind === "name") {
        return (
            <span
                className="block text-left text-[12px] font-semibold break-words whitespace-normal text-ink"
                style={wrapStyle}
            >
                {value}
            </span>
        );
    }

    // Nothing filed yet: a dash, never an empty box — there is nothing here
    // for the coordinator to type into.
    if (value === "") {
        return (
            <span
                className="text-[#bbb]"
                aria-label={`${column.label}: ${row.patient_name} (not recorded)`}
            >
                —
            </span>
        );
    }

    if (column.kind === "text") {
        return (
            <span
                className="mx-auto block text-[12px] break-words whitespace-normal text-ink"
                style={wrapStyle}
            >
                {value}
            </span>
        );
    }

    return (
        <span className="text-[12px] text-ink">
            {column.kind === "date" ? dateLabel(value) : value}
        </span>
    );
}
