import { Link } from "@inertiajs/react";
import {
    FaBookOpen,
    FaUsers,
    FaTriangleExclamation,
    FaLocationDot,
    FaCalendarDays,
} from "react-icons/fa6";
import SummaryCards from "@/Components/dashboard/SummaryCards";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { useLivePoll } from "@/hooks/useLivePoll";

const statusLabels = {
    active: "Active",
    upcoming: "Upcoming",
    completed: "Completed",
};

export default function Dashboard({
    user,
    stats,
    ongoing,
    upcoming,
    recent_programs: recentPrograms,
    recent_activities: recentActivities,
}) {
    useLivePoll([
        "stats",
        "ongoing",
        "upcoming",
        "recent_programs",
        "recent_activities",
    ]);
    const cards = [
        {
            label: "Total Programs",
            value: stats.total_programs,
            subtext: `${stats.active_programs} Active`,
            href: route("provider.programs.index"),
            Icon: FaBookOpen,
            tone: "blue",
        },
        {
            label: "Registered Patients",
            value: stats.registered_patients,
            subtext: "Across all programs",
            href: route("provider.programs.index"),
            Icon: FaUsers,
            tone: "green",
        },
        {
            label: "Presumptive TB Cases",
            value: stats.presumptive_count,
            subtext: "Flagged for follow-up",
            href: route("provider.activity"),
            Icon: FaTriangleExclamation,
            tone: "red",
        },
    ];

    return (
        <DashboardLayout
            role="provider"
            title="Provider Dashboard"
            contentClassName="dash-content-provider-overview"
        >
            <section
                className="dashboard-overview-provider"
                aria-label={`${user.name}'s provider summary`}
            >
                <SummaryCards cards={cards} />

                <div className="dash-lower">
                    <div className="dash-lower-top">
                        <div className="activities-card">
                            <div className="activities-header">
                                <h2>Recent Activities</h2>
                                <Link
                                    href={route("provider.activity")}
                                    className="view-all"
                                >
                                    View All
                                </Link>
                            </div>
                            {recentActivities.length > 0 ? (
                                <ul className="provider-activity-list">
                                    {recentActivities.map((activity) => (
                                        <li
                                            key={activity.id}
                                            className="provider-activity-item"
                                        >
                                            <div>
                                                <p className="provider-activity-title">
                                                    <strong>
                                                        {activity.title}
                                                    </strong>
                                                </p>
                                                {activity.description && (
                                                    <div className="provider-activity-meta">
                                                        <span>
                                                            {
                                                                activity.description
                                                            }
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="provider-activity-time">
                                                {activity.time_label}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="activities-empty">
                                    No recent activity yet.
                                </p>
                            )}
                        </div>

                        <div className="right-col">
                            {ongoing ? (
                                <div className="ongoing-card">
                                    <div className="ongoing-dot-row">
                                        <span className="ongoing-dot" />
                                        <span className="ongoing-label">
                                            Active Session
                                        </span>
                                    </div>
                                    <p className="ongoing-prog-name">
                                        {ongoing.name}
                                    </p>
                                    <p className="ongoing-prog-loc">
                                        {ongoing.location}
                                    </p>
                                    <div className="screened-row">
                                        <span className="screened-label">
                                            Patients Screened
                                        </span>
                                        <span className="screened-count">
                                            {ongoing.patients_count}
                                        </span>
                                    </div>
                                    <Link
                                        href={route(
                                            "provider.programs.show",
                                            ongoing.id,
                                        )}
                                        className="continue-btn"
                                    >
                                        Continue Registration
                                    </Link>
                                </div>
                            ) : (
                                <div className="ongoing-card">
                                    <p className="ongoing-label">
                                        No active session
                                    </p>
                                </div>
                            )}

                            <div className="upcoming-card">
                                {upcoming ? (
                                    <>
                                        <p className="upcoming-label">
                                            Upcoming Activity
                                        </p>
                                        <div className="upcoming-item">
                                            <span className="upcoming-icon">
                                                <FaCalendarDays aria-hidden="true" />
                                            </span>
                                            <div>
                                                <p className="upcoming-prog-name">
                                                    {upcoming.name}
                                                </p>
                                                <p className="upcoming-prog-loc">
                                                    {upcoming.location}
                                                </p>
                                            </div>
                                        </div>
                                        <p className="upcoming-sched-label">
                                            Scheduled For
                                        </p>
                                        <p className="upcoming-sched-time">
                                            {upcoming.date_label} ·{" "}
                                            {upcoming.time_label}
                                        </p>
                                        <Link
                                            href={route(
                                                "provider.programs.show",
                                                upcoming.id,
                                            )}
                                            className="open-btn"
                                        >
                                            Open Activity
                                        </Link>
                                    </>
                                ) : (
                                    <p className="upcoming-label">
                                        No upcoming activities
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="active-programs-card">
                        <h3 className="ap-title">Programs</h3>
                        <table className="ap-table">
                            <thead>
                                <tr>
                                    <th>Activity Name</th>
                                    <th>Location</th>
                                    <th>Date &amp; Time</th>
                                    <th>Status</th>
                                    <th>Patients</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentPrograms.map((program) => (
                                    <tr key={program.id}>
                                        <td>
                                            <Link
                                                href={route(
                                                    "provider.programs.show",
                                                    program.id,
                                                )}
                                            >
                                                {program.name}
                                            </Link>
                                        </td>
                                        <td>
                                            <FaLocationDot aria-hidden="true" />{" "}
                                            {program.location}
                                        </td>
                                        <td>
                                            {program.date_label} ·{" "}
                                            {program.time_label}
                                        </td>
                                        <td>
                                            <span
                                                className={`status-pill ${program.status}`}
                                            >
                                                {statusLabels[program.status] ??
                                                    program.status}
                                            </span>
                                        </td>
                                        <td>{program.patients_count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </DashboardLayout>
    );
}
