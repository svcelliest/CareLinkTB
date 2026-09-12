import { Deferred, Link } from "@inertiajs/react";
import { useMemo, useState } from "react";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { ProgramCardSkeleton } from "@/Components/provider/Skeleton";
import "../../../../css/app/12d-provider-dashboard.css";

/**
 * Provider program list. Search and tab filtering run against the programs
 * already delivered with the page, exactly as the reference does; the list
 * itself is a deferred prop so it shows skeleton cards while it loads.
 */

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

/**
 * Icon sizes are set here rather than in CSS because MUI sizes its icons off
 * `font-size`; each value tracks the label it sits beside in `.prog-*`.
 * Colour is left to `currentColor`, which the surrounding rules already set.
 */

function ProgramList({ programs, search, status }) {
    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        return programs.filter((program) => {
            const matchesStatus = status === "all" || program.status === status;
            const matchesSearch =
                !query ||
                program.name.toLowerCase().includes(query) ||
                program.location.toLowerCase().includes(query);

            return matchesStatus && matchesSearch;
        });
    }, [programs, search, status]);

    if (filtered.length === 0) {
        return <div className="prog-list-empty">No programs found.</div>;
    }

    return filtered.map((program) => (
        <Link
            key={program.id}
            href={route("provider.programs.show", program.id)}
            className={`prog-card ${program.status === "active" ? "active-prog" : ""}`}
        >
            <div className="prog-info">
                <div className="prog-name-row">
                    <span className="prog-name">{program.name}</span>
                    <span className={`prog-badge ${program.status}`}>
                        {statusLabels[program.status] ?? program.status}
                    </span>
                </div>
                <div className="prog-loc-row">
                    <LocationOnOutlinedIcon sx={{ fontSize: 14 }} />
                    {program.location}
                </div>
            </div>

            <div className="prog-meta-row">
                <div className="prog-meta-item">
                    <CalendarMonthOutlinedIcon sx={{ fontSize: 15 }} />
                    <span>
                        {program.iso_date_label} {program.time_label}
                    </span>
                </div>
                <div className="prog-meta-item">
                    <PeopleAltOutlinedIcon sx={{ fontSize: 15 }} />
                    <span>{program.patients_count} Registered</span>
                </div>
            </div>

            <div className="prog-arrow">
                <ChevronRightRoundedIcon sx={{ fontSize: 20 }} />
            </div>
        </Link>
    ));
}

export default function Index({ programs }) {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");

    return (
        <DashboardLayout
            role="provider"
            title="Program"
            contentClassName="dash-content-provider-programs"
        >
            <div className="prog-page">
                <div className="page-toolbar">
                    <label className="toolbar-search">
                        {/* sized and coloured by `.toolbar-search svg` */}
                        <SearchRoundedIcon />
                        <span className="sr-only">Search programs</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search programs..."
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
                    <Deferred
                        data="programs"
                        fallback={<ProgramCardSkeleton />}
                    >
                        <ProgramList
                            programs={programs}
                            search={search}
                            status={status}
                        />
                    </Deferred>
                </div>
            </div>
        </DashboardLayout>
    );
}
