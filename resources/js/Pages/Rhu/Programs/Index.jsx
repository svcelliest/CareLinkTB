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
import { usePolledReload } from "@/hooks/usePolledReload";

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

export default function Index({ programs, municipality }) {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");

    // Same status the other portals show, and it moves with the schedule, so
    // this list refreshes itself rather than going stale on the day.
    usePolledReload(["programs"]);

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
                        <h2 id="rhu-programs-title">Programs</h2>
                        <p>
                            {municipality
                                ? `ICM programs covering ${municipality}. Open one to review the patients screened into it.`
                                : "ICM programs covering your municipality."}
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
                            // Patient Tracker completion for this program: the
                            // two steps the tracker itself counts — sputum
                            // collected and diagnostic assessment recorded.
                            const completion = program.patients_count > 0
                                ? Math.round(
                                      ((program.collected_count + program.assessed_count) /
                                          (program.patients_count * 2)) *
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
                                            <strong>{program.patients_count}</strong>
                                            Patients
                                        </span>
                                        <span>
                                            <strong>{program.presumptive_count}</strong>
                                            Presumptive
                                        </span>
                                    </div>

                                    <div className="rhu-program-progress">
                                        <div>
                                            <span>Patient Tracker progress</span>
                                            <strong>{completion}%</strong>
                                        </div>
                                        <span className="rhu-program-progress-track">
                                            <span style={{ width: `${completion}%` }} />
                                        </span>
                                    </div>

                                    <Link
                                        href={route("rhu.tracker.index", {
                                            program: program.id,
                                        })}
                                        className="rhu-program-open"
                                    >
                                        Open Patient Tracker
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
