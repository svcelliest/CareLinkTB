import { useState } from "react";
import { Link, router } from "@inertiajs/react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import "../../../css/app/12e-activity-reference.css";

/**
 * Recent activity log, presented as the reference portal's single card with a
 * TIME / MODULE / ACTIVITY table.
 *
 * The reference mockup has no controls, but the backend supports category
 * filtering, search and pagination, so those are kept and styled to sit inside
 * the card header. Every row is real `activities` data from ActivityController;
 * nothing here is generated client-side except the display formatting.
 */

const categories = [
    { value: "all", label: "All activity" },
    { value: "accounts", label: "Accounts" },
    { value: "programs", label: "Programs" },
    { value: "messages", label: "Messages" },
    { value: "profile", label: "Profile" },
    { value: "security", label: "Security" },
];

/**
 * Badge text for the MODULE column, derived from the activity type the logger
 * already stores. Presentation only — the server-side `category` used for
 * filtering is untouched.
 */
function moduleLabel(type) {
    if (type === "program.patient_registered" || type === "program.patient_removed") {
        return "Registration";
    }
    if (type === "program.patient_status_updated") return "Status Update";
    if (type === "program.patient_notified") return "SMS";
    if (type.startsWith("program.")) return "Programs";
    if (type.startsWith("message.")) return "Messages";
    if (type.startsWith("account.")) return "Accounts";
    if (type.startsWith("security.")) return "Security";
    if (type.startsWith("profile.")) return "Profile";
    return "Activity";
}

function timestamp(value) {
    const date = new Date(value);
    const day = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
    const time = new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);

    return `${day} – ${time}`;
}

export default function Index({ role, activities, filters }) {
    const [search, setSearch] = useState(filters.search ?? "");
    const routeName = `${role}.activity`;
    const hasFilters = filters.search || filters.category !== "all";

    const visit = (category, nextSearch = search) => {
        router.get(
            route(routeName),
            {
                category,
                search: nextSearch.trim() || undefined,
            },
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
            },
        );
    };

    const submitSearch = (event) => {
        event.preventDefault();
        visit(filters.category);
    };

    return (
        <DashboardLayout
            role={role}
            title="Recent Activity"
            contentClassName="dash-content-activity"
        >
            <div className="activities-page">
                <div className="activities-page-card">
                    <div className="activities-page-header">
                        <div className="activities-page-title">
                            Recent Activities
                        </div>
                        <div className="activities-page-sub">
                            A log of all actions performed in your CareLink
                            account
                        </div>

                        <div className="activities-page-controls">
                            <div
                                className="activities-page-tabs"
                                role="group"
                                aria-label="Filter activity"
                            >
                                {categories.map((category) => (
                                    <button
                                        type="button"
                                        key={category.value}
                                        className={
                                            filters.category === category.value
                                                ? "active"
                                                : ""
                                        }
                                        aria-pressed={
                                            filters.category === category.value
                                        }
                                        onClick={() => visit(category.value)}
                                    >
                                        {category.label}
                                    </button>
                                ))}
                            </div>

                            <form
                                className="toolbar-search"
                                onSubmit={submitSearch}
                                role="search"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="11" cy="11" r="8" />
                                    <line
                                        x1="21"
                                        y1="21"
                                        x2="16.65"
                                        y2="16.65"
                                    />
                                </svg>
                                <label
                                    htmlFor="activity-search-input"
                                    className="sr-only"
                                >
                                    Search activity
                                </label>
                                <input
                                    id="activity-search-input"
                                    type="search"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search your activity"
                                    maxLength={100}
                                />
                            </form>
                        </div>
                    </div>

                    <div className="activities-log-table-wrap">
                        <table className="activities-log-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>Module</th>
                                    <th>Activity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activities.data.length > 0 ? (
                                    activities.data.map((activity) => (
                                        <tr key={activity.id}>
                                            <td className="time-col">
                                                <time
                                                    dateTime={
                                                        activity.created_at
                                                    }
                                                >
                                                    {timestamp(
                                                        activity.created_at,
                                                    )}
                                                </time>
                                            </td>
                                            <td>
                                                <span className="module-badge">
                                                    {moduleLabel(activity.type)}
                                                </span>
                                            </td>
                                            <td>
                                                {activity.url ? (
                                                    <Link
                                                        href={activity.url}
                                                        className="activities-log-link"
                                                    >
                                                        {activity.title}
                                                    </Link>
                                                ) : (
                                                    activity.title
                                                )}
                                                {activity.description && (
                                                    <span className="activities-log-desc">
                                                        {activity.description}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan="3"
                                            className="activities-log-empty"
                                        >
                                            {hasFilters
                                                ? "No activity matches your search or filter."
                                                : "Actions you complete in CareLink will appear here."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {activities.data.length > 0 && (
                        <div className="activities-page-footer">
                            <span className="activities-result-count">
                                Showing {activities.from}–{activities.to} of{" "}
                                {activities.total}{" "}
                                {activities.total === 1 ? "entry" : "entries"}
                            </span>

                            {activities.links.length > 3 && (
                                <nav
                                    className="activity-pagination"
                                    aria-label="Activity pages"
                                >
                                    {activities.links.map((link, index) =>
                                        link.url ? (
                                            <Link
                                                href={link.url}
                                                key={`${link.label}-${index}`}
                                                className={
                                                    link.active ? "active" : ""
                                                }
                                                preserveScroll
                                                dangerouslySetInnerHTML={{
                                                    __html: link.label,
                                                }}
                                            />
                                        ) : (
                                            <span
                                                key={`${link.label}-${index}`}
                                                dangerouslySetInnerHTML={{
                                                    __html: link.label,
                                                }}
                                            />
                                        ),
                                    )}
                                </nav>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
