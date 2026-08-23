import { Link } from "@inertiajs/react";
import {
    FaChevronLeft,
    FaDownload,
    FaLock,
} from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";

const statusLabels = {
    active: "Active",
    upcoming: "Upcoming",
    completed: "Completed",
};

export default function Show({ program }) {
    const statusLabel = statusLabels[program.status] ?? program.status;
    const scheduleDate = new Date(program.scheduled_at);
    const scheduleLabel = Number.isNaN(scheduleDate.getTime())
        ? ""
        : `${scheduleDate.toLocaleDateString()} ${scheduleDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

    return (
        <DashboardLayout
            role="icm"
            title={program.name}
            contentClassName="dash-content-program-detail"
        >
            <section className="program-detail-page">
                <div className="program-detail-header-card">
                    <div className="program-detail-header-top">
                        <Link
                            href={route("icm.programs.index")}
                            className="program-detail-back"
                        >
                            <FaChevronLeft aria-hidden="true" />
                            <span>{program.name}</span>
                        </Link>

                        <a
                            href={route("icm.programs.export", program.id)}
                            className="program-detail-export"
                        >
                            <FaDownload aria-hidden="true" />
                            Export
                        </a>
                    </div>

                    <p className="program-detail-schedule">
                        <span>{program.location}</span>
                        <span aria-hidden="true">•</span>
                        <span>{scheduleLabel}</span>
                    </p>

                    <div className="program-detail-status-line">
                        <span
                            className={`program-detail-dot program-detail-dot-${program.status}`}
                            aria-hidden="true"
                        />
                        <strong>Status: {statusLabel}</strong>
                        <span>Read-only monitoring view</span>
                    </div>
                </div>

                <div className="program-detail-body">
                    <div className="program-detail-stats">
                        <article>
                            <span>Total Patients</span>
                            <strong>{program.patient_counts.total}</strong>
                        </article>
                        <article>
                            <span>Normal</span>
                            <strong>{program.patient_counts.normal}</strong>
                        </article>
                        <article>
                            <span>Presumptive TB</span>
                            <strong className="is-red">
                                {program.patient_counts.presumptive}
                            </strong>
                        </article>
                        <article>
                            <span>Status</span>
                            <strong
                                className={`programs-status programs-status-${program.status}`}
                            >
                                {statusLabel}
                            </strong>
                        </article>
                    </div>

                    <div className="program-patients-card">
                        <div className="program-patients-heading">
                            <h2>Registered Patients</h2>
                            <span>
                                <FaLock aria-hidden="true" />
                                View Only
                            </span>
                        </div>

                        <div className="program-patients-table-wrap">
                            <table>
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
                                                    <strong>{patient.name}</strong>
                                                </td>
                                                <td>
                                                    {patient.age} / {patient.sex}
                                                </td>
                                                <td>{patient.address}</td>
                                                <td>{patient.contact}</td>
                                                <td>{patient.status}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan="6"
                                                className="program-patients-empty"
                                            >
                                                No patients registered for this
                                                program yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </section>
        </DashboardLayout>
    );
}
