import { Link } from "@inertiajs/react";
import { FaArrowLeft, FaCircleInfo, FaDownload, FaLock } from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { useLivePoll } from "@/hooks/useLivePoll";

function exportPatientsCsv(patients, programName) {
    const header = ["#", "Name", "Age", "Sex", "Address", "Contact", "Status"];
    const rows = patients.map((patient) => [
        patient.number,
        patient.name,
        patient.age,
        patient.sex,
        patient.address,
        patient.contact,
        patient.status,
    ]);
    const csv = [header, ...rows]
        .map((row) =>
            row
                .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
                .join(","),
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${programName.replace(/\s+/g, "_")}_patients.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

useLivePoll(["program"]);

export default function Completed({ program }) {
    const isUpcoming = program.status === "upcoming";

    return (
        <DashboardLayout
            role="provider"
            title={program.name}
            contentClassName="dash-content-completed"
        >
            <div className="completed-view">
                <header className="completed-header">
                    <div className="completed-header-top">
                        <Link
                            href={route("provider.programs.index")}
                            className="completed-back"
                        >
                            <FaArrowLeft aria-hidden="true" />
                            <span>{program.name}</span>
                        </Link>
                        <button
                            type="button"
                            className="completed-export-btn"
                            onClick={() =>
                                exportPatientsCsv(
                                    program.patients,
                                    program.name,
                                )
                            }
                        >
                            <FaDownload aria-hidden="true" />
                            Export
                        </button>
                    </div>
                    <p className="completed-sub">
                        <span>{program.location}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                            {program.date_label} · {program.time_label}
                        </span>
                    </p>
                    <div className="completed-status-row">
                        <span
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
                </header>

                {isUpcoming && (
                    <div className="upcoming-banner">
                        <span className="upcoming-banner-icon">
                            <FaCircleInfo aria-hidden="true" />
                        </span>
                        <div>
                            <p className="upcoming-banner-title">
                                Scheduled for {program.date_label} ·{" "}
                                {program.time_label}
                            </p>
                            <p className="upcoming-banner-body">
                                Registration will be available once the activity
                                date begins.
                            </p>
                        </div>
                    </div>
                )}

                <div className="completed-stat-row">
                    <div className="completed-stat-box">
                        <span className="completed-stat-label">
                            Total Patients
                        </span>
                        <strong className="completed-stat-value">
                            {program.patient_counts.total}
                        </strong>
                    </div>
                    <div className="completed-stat-box">
                        <span className="completed-stat-label">Normal</span>
                        <strong className="completed-stat-value green-text">
                            {program.patient_counts.normal}
                        </strong>
                    </div>
                    <div className="completed-stat-box">
                        <span className="completed-stat-label">
                            Presumptive TB
                        </span>
                        <strong className="completed-stat-value red">
                            {program.patient_counts.presumptive}
                        </strong>
                    </div>
                    <div className="completed-stat-box">
                        <span className="completed-stat-label">Status</span>
                        <strong
                            className={`completed-stat-value ${isUpcoming ? "status-upcoming" : "status-done"}`}
                        >
                            {isUpcoming ? "Upcoming" : "Completed"}
                        </strong>
                    </div>
                </div>

                <div className="completed-patients-section">
                    <div className="completed-patients-card">
                        <div className="completed-patients-header">
                            <h2 className="completed-patients-title">
                                Registered Patients
                            </h2>
                            <span className="view-only-badge">
                                <FaLock aria-hidden="true" />
                                View Only
                            </span>
                        </div>
                        <table className="completed-patient-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Name</th>
                                    <th>Age / Sex</th>
                                    <th>Address</th>
                                    <th>Contact</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {program.patients.length > 0 ? (
                                    program.patients.map((patient) => (
                                        <tr key={patient.id}>
                                            <td>{patient.number}</td>
                                            <td>
                                                <span className="pt-name">
                                                    {patient.name}
                                                </span>
                                            </td>
                                            <td>
                                                {patient.age} / {patient.sex}
                                            </td>
                                            <td>{patient.address}</td>
                                            <td>{patient.contact}</td>
                                            <td>
                                                <span
                                                    className={
                                                        patient.status ===
                                                        "Presumptive"
                                                            ? "status-pill-presumptive"
                                                            : "status-pill-normal"
                                                    }
                                                >
                                                    {patient.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6">
                                            No patients recorded.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
