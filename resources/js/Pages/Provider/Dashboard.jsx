import { Deferred, Link } from "@inertiajs/react";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import TrackChangesRoundedIcon from "@mui/icons-material/TrackChangesRounded";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { usePolledReload } from "@/hooks/usePolledReload";
import {
    ActivityListSkeleton,
    OngoingCardSkeleton,
    StatCardSkeleton,
    TableSkeleton,
    UpcomingCardSkeleton,
} from "@/Components/provider/Skeleton";

/**
 * Provider dashboard, matching the reference portal's markup.
 *
 * The three KPI cards are informational only — they are plain <div>s with no
 * link, handler, or pointer cursor, per the portal spec. Every figure, row and
 * card below is server data; sections with nothing to show render an empty
 * state rather than placeholder rows.
 */

const statusLabels = {
    active: "Active",
    upcoming: "Upcoming",
    completed: "Completed",
};

/** Informational only: no link, no handler, no pointer cursor. */
function StatCard({ accent, label, icon, tone, value, sub }) {
    return (
        <div className="stat-card" style={{ "--kpi-accent": accent }}>
            <div className="stat-card-top">
                <span className="stat-label">{label}</span>
                <div className={`stat-icon ${tone}`}>{icon}</div>
            </div>
            <span className="stat-value">{value}</span>
            <span className="stat-sub">{sub}</span>
        </div>
    );
}

/**
 * Rendered only once the deferred `stats` prop has arrived, so it can read the
 * figures directly.
 */
function StatRow({ stats }) {
    return (
        <div className="stat-row">
            <StatCard
                accent="#3b82f6"
                label={
                    <>
                        Total
                        <br />
                        Programs
                    </>
                }
                icon={
                    <TrackChangesRoundedIcon sx={{ color: "#3b82f6" }} />
                }
                tone="blue"
                value={stats.total_programs}
                sub="Assigned screening programs"
            />
            <StatCard
                accent="#27ae60"
                label={
                    <>
                        Registered
                        <br />
                        Patients
                    </>
                }
                icon={<GroupsOutlinedIcon sx={{ color: "#27ae60" }} />}
                tone="green"
                value={stats.registered_patients}
                sub="Across all programs"
            />
            <StatCard
                accent="#c0392b"
                label={
                    <>
                        Presumptive
                        <br />
                        TB Cases
                    </>
                }
                icon={<ErrorOutlineRoundedIcon sx={{ color: "#c0392b" }} />}
                tone="red"
                value={stats.presumptive_count}
                sub="Flagged for referral"
            />
        </div>
    );
}

function ActivitiesList({ activities }) {
    if (activities.length === 0) {
        return <p className="activities-empty">No recent activity yet.</p>;
    }

    return (
        <ul className="activity-list">
            {activities.map((activity) => (
                <li className="activity-item" key={activity.id}>
                    <div>
                        <div className="activity-title">
                            <strong>{activity.title}</strong>
                            {activity.description
                                ? ` — ${activity.description}`
                                : ""}
                        </div>
                        <div className="activity-meta">
                            <span className="activity-tag">{activity.tag}</span>
                            <span className="dot-sep">•</span>
                            <AccessTimeRoundedIcon
                                sx={{ fontSize: 12 }}
                                aria-hidden="true"
                            />
                            {activity.datetime_label}
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
}

function ProgramsTableBody({ programs }) {
    if (programs.length === 0) {
        return (
            <tr>
                <td colSpan="5" className="ap-empty">
                    No programs assigned yet.
                </td>
            </tr>
        );
    }

    return programs.map((program) => (
        <tr key={program.id}>
            <td>{program.name}</td>
            <td>{program.location}</td>
            <td>
                {program.iso_date_label} – {program.time_label}
            </td>
            <td>
                <span className={`status-pill ${program.status}`}>
                    {statusLabels[program.status] ?? program.status}
                </span>
            </td>
            <td>{program.patients_count}</td>
        </tr>
    ));
}

/**
 * The two right-column cards. Each keeps the same footprint whether it has a
 * program to show or not, so the column holds its shape while `ongoing` and
 * `upcoming` are still in flight and once they resolve to nothing.
 */
function OngoingCard({ ongoing }) {
    if (!ongoing) {
        return (
            <div className="ongoing-card">
                <div>
                    <div className="ongoing-dot-row">
                        <div className="ongoing-dot idle" />
                        <div className="ongoing-label">Ongoing Activity</div>
                    </div>
                    <p className="right-col-empty">
                        No active screening session right now.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="ongoing-card">
            <div>
                <div className="ongoing-dot-row">
                    <div className="ongoing-dot" />
                    <div className="ongoing-label">Ongoing Activity</div>
                </div>
                <div className="ongoing-prog-name">{ongoing.name}</div>
                <div className="ongoing-prog-loc">{ongoing.location}</div>
            </div>
            <div>
                <div className="screened-row">
                    <span className="screened-label">Patients Screened</span>
                    <span className="screened-count">
                        {ongoing.patients_count}
                    </span>
                </div>
                <Link
                    href={route("provider.programs.show", ongoing.id)}
                    className="continue-btn"
                >
                    Continue Registration
                </Link>
            </div>
        </div>
    );
}

function UpcomingCard({ upcoming }) {
    if (!upcoming) {
        return (
            <div className="upcoming-card">
                <div>
                    <div className="upcoming-label">Upcoming Activity</div>
                    <p className="right-col-empty">Nothing scheduled yet.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="upcoming-card">
            <div>
                <div className="upcoming-label">Upcoming Activity</div>
                <div className="upcoming-item">
                    <div className="upcoming-icon">
                        <CalendarMonthOutlinedIcon sx={{ fontSize: 22 }} />
                    </div>
                    <div>
                        <div className="upcoming-prog-name">
                            {upcoming.name}
                        </div>
                        <div className="upcoming-prog-loc">
                            {upcoming.location}
                        </div>
                    </div>
                </div>
            </div>
            <div>
                <div className="upcoming-sched-label">Scheduled For</div>
                <div className="upcoming-sched-time">
                    {upcoming.iso_date_label} {upcoming.time_label}
                </div>
                <Link
                    href={route("provider.programs.show", upcoming.id)}
                    className="open-btn"
                >
                    Open Activity
                </Link>
            </div>
        </div>
    );
}

export default function Dashboard({
    user,
    stats,
    ongoing,
    upcoming,
    recent_programs: recentPrograms,
    recent_activities: recentActivities,
}) {
    // The Ongoing and Upcoming cards are picked by status, which moves on its
    // own when a scheduled date arrives, so they are re-fetched periodically.
    usePolledReload(["ongoing", "upcoming", "stats", "recent_programs"]);

    return (
        <DashboardLayout
            role="provider"
            title="Dashboard"
            contentClassName="dash-content-provider-overview"
        >
            <div
                className="dash-scroll"
                aria-label={`${user.name}'s provider summary`}
            >
                <Deferred
                    data="stats"
                    fallback={
                        <div className="stat-row">
                            <StatCardSkeleton />
                            <StatCardSkeleton />
                            <StatCardSkeleton />
                        </div>
                    }
                >
                    <StatRow stats={stats} />
                </Deferred>

                <div className="dash-lower">
                    <div className="dash-lower-top">
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "18px",
                            }}
                        >
                            <div className="activities-card">
                                <div className="activities-header">
                                    <h2>Recent Activities</h2>
                                    <Link
                                        href={route("provider.activity")}
                                        className="view-all"
                                    >
                                        View All
                                        <ChevronRightRoundedIcon />
                                    </Link>
                                </div>
                                <Deferred
                                    data="recent_activities"
                                    fallback={<ActivityListSkeleton />}
                                >
                                    <ActivitiesList
                                        activities={recentActivities}
                                    />
                                </Deferred>
                            </div>
                        </div>

                        <div className="right-col">
                            <Deferred
                                data="ongoing"
                                fallback={<OngoingCardSkeleton />}
                            >
                                <OngoingCard ongoing={ongoing} />
                            </Deferred>

                            <Deferred
                                data="upcoming"
                                fallback={<UpcomingCardSkeleton />}
                            >
                                <UpcomingCard upcoming={upcoming} />
                            </Deferred>
                        </div>
                    </div>

                    <div className="active-programs-card">
                        <div className="activities-header">
                            <h2>Recent Programs</h2>
                            <Link
                                href={route("provider.programs.index")}
                                className="view-all"
                            >
                                View All
                                <ChevronRightRoundedIcon />
                            </Link>
                        </div>
                        <Deferred
                            data="recent_programs"
                            fallback={
                                <TableSkeleton
                                    columns={[
                                        "Activity Name",
                                        "Location",
                                        "Date & Time",
                                        "Status",
                                        "Patients",
                                    ]}
                                />
                            }
                        >
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
                                    <ProgramsTableBody
                                        programs={recentPrograms}
                                    />
                                </tbody>
                            </table>
                        </Deferred>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
