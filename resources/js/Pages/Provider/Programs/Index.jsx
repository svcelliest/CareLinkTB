import { Link } from "@inertiajs/react";
import { useMemo, useState } from "react";
import {
    FaCalendarDays,
    FaChevronRight,
    FaLocationDot,
    FaMagnifyingGlass,
    FaUsers,
} from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";

const tabs = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "upcoming", label: "Upcoming" },
    { value: "completed", label: "Completed" },
];

const statusLabels = {
    active: "Active",
    upcoming: "Upcoming",
    completed: "Completed",
};

export default function Index({ programs }) {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");

    const filteredPrograms = useMemo(() => {
        const query = search.trim().toLowerCase();

        return programs.filter((program) => {
            const matchesStatus =
                status === "all" || program.status === status;
            const matchesSearch =
                !query ||
                program.name.toLowerCase().includes(query) ||
                program.location.toLowerCase().includes(query);

            return matchesStatus && matchesSearch;
        });
    }, [programs, search, status]);

    return (
        <DashboardLayout
            role="provider"
            title="Program"
            contentClassName="dash-content-provider-programs"
        >
            <div className="prog-page">
                <div className="page-toolbar">
                    <label className="toolbar-search">
                        <FaMagnifyingGlass aria-hidden="true" />
                        <span className="sr-only">Search programs</span>
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by program or location"
                        />
                    </label>
                </div>

                <div className="prog-tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            className={`prog-tab ${status === tab.value ? "active" : ""}`}
                            onClick={() => setStatus(tab.value)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="prog-list">
                    {filteredPrograms.length > 0 ? (
                        filteredPrograms.map((program) => (
                            <Link
                                key={program.id}
                                href={route(
                                    "provider.programs.show",
                                    program.id,
                                )}
                                className={`prog-card ${program.status === "active" ? "active-prog" : ""}`}
                            >
                                <div className="prog-info">
                                    <div className="prog-name-row">
                                        <span className="prog-name">
                                            {program.name}
                                        </span>
                                        <span
                                            className={`prog-badge ${program.status}`}
                                        >
                                            {statusLabels[program.status] ??
                                                program.status}
                                        </span>
                                    </div>
                                    <p className="prog-loc-row">
                                        <FaLocationDot aria-hidden="true" />
                                        <span>{program.location}</span>
                                    </p>
                                </div>

                                <div className="prog-meta-row">
                                    <span className="prog-meta-item">
                                        <FaCalendarDays aria-hidden="true" />
                                        <span>
                                            {program.date_label} ·{" "}
                                            {program.time_label}
                                        </span>
                                    </span>
                                    <span className="prog-meta-item">
                                        <FaUsers aria-hidden="true" />
                                        <span>
                                            {program.patients_count}{" "}
                                            {program.patients_count === 1
                                                ? "patient"
                                                : "patients"}
                                        </span>
                                    </span>
                                </div>

                                <span className="prog-arrow">
                                    <FaChevronRight aria-hidden="true" />
                                </span>
                            </Link>
                        ))
                    ) : (
                        <p>No programs found.</p>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
