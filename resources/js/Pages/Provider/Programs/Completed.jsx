import { Deferred, Link } from "@inertiajs/react";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { SkeletonLine, TableSkeleton } from "@/Components/provider/Skeleton";
import { useToast } from "@/Components/ui/Toast";
import "../../../../css/app/12d-provider-dashboard.css";

/**
 * Read-only view of a completed or not-yet-started program. Nothing here
 * mutates: the roster and its counts come straight from the program's
 * patients, with presumptive status derived server-side.
 */

// `center` marks the columns whose heading and cells share a centred
// alignment; the rest are left-aligned text.
const patientColumns = [
    { label: "#" },
    { label: "Name" },
    { label: "Age / Sex" },
    { label: "Address" },
    { label: "Contact" },
    { label: "Status", center: true },
];

function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/**
 * Alphabetical by name. Copies first — `patients` is an Inertia prop and
 * sorting in place would mutate it. `#` stays the server's registration
 * sequence, so it is intentionally no longer in ascending order.
 */
function sortByName(patients) {
    return [...patients].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
}

function exportPatientsCsv(patients, programName) {
    const header = ["#", "Name", "Age", "Sex", "Address", "Contact", "Status"];
    const rows = sortByName(patients).map((patient) => [
        patient.number,
        patient.name,
        patient.age,
        patient.sex,
        patient.address,
        patient.contact,
        patient.status,
    ]);
    const csv = [header, ...rows]
        .map((row) => row.map(csvEscape).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${programName.replace(/\s+/g, "_")}_patients.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * The three KPI cards — the same `.stat-card` the provider dashboard draws,
 * so the two rows read as one system. Status is deliberately not a tile: the
 * header above already states it, so repeating it left a fourth card
 * carrying a word where the other three carry a figure.
 */
const statCards = [
    {
        key: "total",
        label: "Total Patients",
        sub: "Registered in this program",
        accent: "#3b82f6",
        tone: "blue",
        Icon: GroupsOutlinedIcon,
        value: (counts) => counts.total,
    },
    {
        key: "normal",
        label: "Normal",
        sub: "No presumptive signs",
        accent: "#27ae60",
        tone: "green",
        Icon: CheckCircleOutlineRoundedIcon,
        value: (counts) => counts.normal,
    },
    {
        key: "presumptive",
        label: "Presumptive TB",
        sub: "Flagged for referral",
        accent: "#c0392b",
        tone: "red",
        Icon: ErrorOutlineRoundedIcon,
        value: (counts) => counts.presumptive,
    },
];

function StatRow({ counts }) {
    return statCards.map(({ key, label, sub, accent, tone, Icon, value }) => (
        <div
            key={key}
            className="stat-card"
            style={{ "--kpi-accent": accent }}
        >
            <div className="stat-card-top">
                <span className="stat-label">{label}</span>
                <div className={`stat-icon ${tone}`}>
                    <Icon sx={{ color: accent }} />
                </div>
            </div>
            <span className="stat-value">{value(counts)}</span>
            <span className="stat-sub">{sub}</span>
        </div>
    ));
}

function StatRowSkeleton() {
    return statCards.map(({ key, accent, tone }) => (
        <div
            key={key}
            className="stat-card is-skeleton"
            style={{ "--kpi-accent": accent }}
        >
            <div className="stat-card-top">
                <SkeletonLine width="84px" height={10} />
                <div className={`stat-icon ${tone}`} />
            </div>
            <SkeletonLine width="48px" height={30} />
            <SkeletonLine width="120px" height={10} />
        </div>
    ));
}

function PatientRows({ patients }) {
    if (patients.length === 0) {
        return (
            <tr>
                <td colSpan="6" className="completed-patient-empty">
                    No patients recorded.
                </td>
            </tr>
        );
    }

    return sortByName(patients).map((patient) => (
        <tr key={patient.id}>
            <td>{patient.number}</td>
            <td>
                <span className="pt-name">{patient.name}</span>
            </td>
            <td>
                {patient.age} / {patient.sex}
            </td>
            <td>{patient.address}</td>
            <td>{patient.contact}</td>
            <td className="col-center">
                <span
                    className={
                        patient.status === "Presumptive"
                            ? "status-pill-presumptive"
                            : "status-pill-normal"
                    }
                >
                    {patient.status}
                </span>
            </td>
        </tr>
    ));
}

function ExportButton({ patients, programName }) {
    const toast = useToast();

    /** Same CSV the button always wrote — the toast only reports the outcome. */
    const handleExport = () => {
        if (!patients.length) {
            toast.error("There are no patients to export");
            return;
        }

        try {
            exportPatientsCsv(patients, programName);
            toast.success("Export completed successfully");
        } catch {
            toast.error("Export failed. Please try again.");
        }
    };

    return (
        <button
            type="button"
            className="completed-export-btn"
            onClick={handleExport}
        >
            <FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />
            Export
        </button>
    );
}

export default function Completed({ program, patient_counts: counts, patients }) {
    const isUpcoming = program.status === "upcoming";

    return (
        <DashboardLayout
            role="provider"
            title="Program Details"
            contentClassName="dash-content-completed"
        >
            <div className="completed-view">
                <div className="completed-header">
                    <div className="completed-header-top">
                        <Link
                            href={route("provider.programs.index")}
                            className="completed-back"
                        >
                            <ChevronLeftRoundedIcon sx={{ fontSize: 20 }} />
                            <span>{program.name}</span>
                        </Link>
                        <Deferred
                            data="patients"
                            fallback={
                                <button
                                    type="button"
                                    className="completed-export-btn"
                                    disabled
                                >
                                    Export
                                </button>
                            }
                        >
                            <ExportButton
                                patients={patients}
                                programName={program.name}
                            />
                        </Deferred>
                    </div>
                    <div className="completed-sub">
                        <span>{program.location}</span>
                        <span>•</span>
                        <span>
                            {program.iso_date_label} {program.time24_label}
                        </span>
                    </div>
                    <div className="completed-status-row">
                        <div
                            className="completed-status-dot"
                            style={{
                                background: isUpcoming ? "#6366f1" : "#27ae60",
                            }}
                        />
                        <span className="completed-status-label">
                            Status: {isUpcoming ? "Upcoming" : "Completed"}
                        </span>
                        <span className="completed-status-sub">
                            {isUpcoming
                                ? "This program has not started yet"
                                : "Read-only monitoring view"}
                        </span>
                    </div>
                </div>

                <div className="completed-stat-row">
                    <Deferred
                        data="patient_counts"
                        fallback={<StatRowSkeleton />}
                    >
                        <StatRow counts={counts} />
                    </Deferred>
                </div>

                {isUpcoming && (
                    <div className="upcoming-banner">
                        <span className="upcoming-banner-icon">
                            <InfoOutlinedIcon sx={{ fontSize: 22 }} />
                        </span>
                        <div>
                            <p className="upcoming-banner-title">
                                Scheduled for {program.iso_date_label}{" "}
                                {program.time_label}
                            </p>
                            <p className="upcoming-banner-body">
                                Registration will be available once the activity
                                date begins.
                            </p>
                        </div>
                    </div>
                )}

                <div className="completed-patients-section">
                    <div className="completed-patients-card">
                        <div className="completed-patients-header">
                            <div className="completed-patients-title">
                                Registered Patients
                            </div>
                            <div className="view-only-badge">
                                <LockOutlinedIcon sx={{ fontSize: 14 }} />
                                View Only
                            </div>
                        </div>
                        <div className="completed-table-wrap">
                            <Deferred
                                data="patients"
                                fallback={
                                    <TableSkeleton
                                        className="completed-patient-table"
                                        columns={patientColumns.map(
                                            (column) => column.label,
                                        )}
                                    />
                                }
                            >
                                <table className="completed-patient-table">
                                    <thead>
                                        <tr>
                                            {patientColumns.map((column) => (
                                                <th
                                                    key={column.label}
                                                    className={
                                                        column.center
                                                            ? "col-center"
                                                            : undefined
                                                    }
                                                >
                                                    {column.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <PatientRows patients={patients} />
                                    </tbody>
                                </table>
                            </Deferred>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
