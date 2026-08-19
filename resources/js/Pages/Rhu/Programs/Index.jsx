import { Link } from "@inertiajs/react";
import { useMemo, useState } from "react";
import {
    FaArrowRight,
    FaCalendarDays,
    FaClipboardCheck,
    FaFileCircleCheck,
    FaLocationDot,
    FaMagnifyingGlass,
} from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";

const filters = [
    { value: "all", label: "All programs" },
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
            role="rhu"
            title="Programs & Forms"
            contentClassName="dash-content-rhu-programs"
        >
            <section className="rhu-programs-page" aria-labelledby="rhu-programs-title">
                <div className="rhu-programs-hero">
                    <div>
                        <span className="rhu-programs-eyebrow">RHU workspace</span>
                        <h2 id="rhu-programs-title">Programs & Forms</h2>
                        <p>
                            Open an ICM program to complete sputum collection
                            and contact tracing records.
                        </p>
                    </div>
                    <div className="rhu-programs-hero-stat">
                        <FaClipboardCheck aria-hidden="true" />
                        <span>
                            <strong>{programs.length}</strong>
                            {programs.length === 1 ? " program" : " programs"}
                        </span>
                    </div>
                </div>

                <div className="rhu-programs-controls">
                    <label className="rhu-programs-search">
                        <FaMagnifyingGlass aria-hidden="true" />
                        <span className="sr-only">Search programs</span>
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search by program or location"
                        />
                    </label>

                    <div className="rhu-programs-filters" aria-label="Filter programs">
                        {filters.map((filter) => (
                            <button
                                key={filter.value}
                                type="button"
                                className={status === filter.value ? "active" : ""}
                                aria-pressed={status === filter.value}
                                onClick={() => setStatus(filter.value)}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rhu-programs-grid" aria-live="polite">
                    {filteredPrograms.length > 0 ? (
                        filteredPrograms.map((program) => {
                            const completion = program.form_entries_count > 0
                                ? Math.round(
                                      (program.completed_entries_count /
                                          program.form_entries_count) *
                                          100,
                                  )
                                : 0;

                            return (
                                <article className="rhu-program-card" key={program.id}>
                                    <div className="rhu-program-card-heading">
                                        <span
                                            className={`programs-status programs-status-${program.status}`}
                                        >
                                            {statusLabels[program.status] ?? program.status}
                                        </span>
                                        <span className="rhu-program-card-date">
                                            <FaCalendarDays aria-hidden="true" />
                                            {program.date_label} · {program.time_label}
                                        </span>
                                    </div>

                                    <h3>{program.name}</h3>
                                    <p className="rhu-program-card-location">
                                        <FaLocationDot aria-hidden="true" />
                                        <span>{program.location}</span>
                                    </p>

                                    <div className="rhu-program-form-counts">
                                        <span>
                                            <strong>{program.sputum_entries_count}</strong>
                                            Sputum records
                                        </span>
                                        <span>
                                            <strong>{program.contact_tracing_entries_count}</strong>
                                            Contact records
                                        </span>
                                    </div>

                                    <div className="rhu-program-progress">
                                        <div>
                                            <span>Form completion</span>
                                            <strong>{completion}%</strong>
                                        </div>
                                        <span className="rhu-program-progress-track">
                                            <span style={{ width: `${completion}%` }} />
                                        </span>
                                    </div>

                                    <Link
                                        href={route("rhu.programs.show", program.id)}
                                        className="rhu-program-open"
                                    >
                                        Open forms
                                        <FaArrowRight aria-hidden="true" />
                                    </Link>
                                </article>
                            );
                        })
                    ) : (
                        <div className="rhu-programs-empty">
                            <FaFileCircleCheck aria-hidden="true" />
                            <h3>No programs found</h3>
                            <p>
                                {programs.length === 0
                                    ? "Programs created by ICM will appear here automatically."
                                    : "Try another search term or status filter."}
                            </p>
                        </div>
                    )}
                </div>
            </section>
        </DashboardLayout>
    );
}
