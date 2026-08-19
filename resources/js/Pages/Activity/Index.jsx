import { useMemo, useState } from "react";
import { Link, router } from "@inertiajs/react";
import {
    FaArrowRight,
    FaAddressCard,
    FaCalendarPlus,
    FaChartLine,
    FaEnvelope,
    FaMagnifyingGlass,
    FaShieldHalved,
    FaUserPen,
    FaXmark,
} from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";

const categories = [
    { value: "all", label: "All activity" },
    { value: "accounts", label: "Accounts" },
    { value: "programs", label: "Programs" },
    { value: "messages", label: "Messages" },
    { value: "profile", label: "Profile" },
    { value: "security", label: "Security" },
];

const categoryIcons = {
    accounts: FaAddressCard,
    programs: FaCalendarPlus,
    messages: FaEnvelope,
    profile: FaUserPen,
    security: FaShieldHalved,
};

function dateKey(value) {
    const date = new Date(value);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dateHeading(value) {
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (dateKey(value) === dateKey(today)) return "Today";
    if (dateKey(value) === dateKey(yesterday)) return "Yesterday";

    return new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric",
        year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
    }).format(date);
}

function activityTime(value) {
    return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(value));
}

export default function Index({ role, activities, filters }) {
    const [search, setSearch] = useState(filters.search ?? "");
    const routeName = `${role}.activity`;
    const groups = useMemo(() => {
        return activities.data.reduce((result, activity) => {
            const key = dateKey(activity.created_at);
            const existing = result.find((group) => group.key === key);

            if (existing) {
                existing.items.push(activity);
            } else {
                result.push({
                    key,
                    label: dateHeading(activity.created_at),
                    items: [activity],
                });
            }

            return result;
        }, []);
    }, [activities.data]);

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

    const clearSearch = () => {
        setSearch("");
        visit(filters.category, "");
    };

    return (
        <DashboardLayout
            role={role}
            title="Recent Activity"
            contentClassName="dash-content-activity"
        >
            <section className="activity-page" aria-labelledby="activity-heading">
                <div className="activity-hero">
                    <div className="activity-hero-icon" aria-hidden="true">
                        <FaChartLine />
                    </div>
                    <div>
                        <h2 id="activity-heading">Recent activity</h2>
                        <p>
                            Review the actions completed through your CareLink account.
                        </p>
                    </div>
                </div>

                <div className="activity-controls">
                    <div className="activity-tabs" role="group" aria-label="Filter activity">
                        {categories.map((category) => (
                            <button
                                type="button"
                                key={category.value}
                                className={
                                    filters.category === category.value ? "active" : ""
                                }
                                aria-pressed={filters.category === category.value}
                                onClick={() => visit(category.value)}
                            >
                                {category.label}
                            </button>
                        ))}
                    </div>

                    <form className="activity-search" onSubmit={submitSearch} role="search">
                        <FaMagnifyingGlass aria-hidden="true" />
                        <label htmlFor="activity-search-input" className="sr-only">
                            Search activity
                        </label>
                        <input
                            id="activity-search-input"
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search your activity"
                            maxLength={100}
                        />
                        {search && (
                            <button
                                type="button"
                                className="activity-search-clear"
                                onClick={clearSearch}
                                aria-label="Clear activity search"
                            >
                                <FaXmark />
                            </button>
                        )}
                        <button type="submit" className="activity-search-submit">
                            Search
                        </button>
                    </form>
                </div>

                {groups.length ? (
                    <div className="activity-feed" aria-live="polite">
                        <p className="activity-result-count">
                            Showing {activities.from}–{activities.to} of {activities.total}{" "}
                            {activities.total === 1 ? "entry" : "entries"}
                        </p>

                        {groups.map((group) => (
                            <section className="activity-group" key={group.key}>
                                <h3>{group.label}</h3>
                                <div className="activity-list">
                                    {group.items.map((activity) => {
                                        const Icon = categoryIcons[activity.category] ?? FaChartLine;
                                        const content = (
                                            <>
                                                <span
                                                    className={`activity-item-icon activity-item-icon-${activity.category}`}
                                                    aria-hidden="true"
                                                >
                                                    <Icon />
                                                </span>
                                                <span className="activity-item-copy">
                                                    <span className="activity-item-title-row">
                                                        <strong>{activity.title}</strong>
                                                        <time dateTime={activity.created_at}>
                                                            {activityTime(activity.created_at)}
                                                        </time>
                                                    </span>
                                                    {activity.description && (
                                                        <span>{activity.description}</span>
                                                    )}
                                                </span>
                                                {activity.url && (
                                                    <FaArrowRight className="activity-item-arrow" />
                                                )}
                                            </>
                                        );

                                        return activity.url ? (
                                            <Link
                                                href={activity.url}
                                                className="activity-item activity-item-link"
                                                key={activity.id}
                                            >
                                                {content}
                                            </Link>
                                        ) : (
                                            <article className="activity-item" key={activity.id}>
                                                {content}
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </div>
                ) : (
                    <div className="activity-empty" aria-live="polite">
                        <span aria-hidden="true">
                            <FaChartLine />
                        </span>
                        <h3>No activity found</h3>
                        <p>
                            {filters.search || filters.category !== "all"
                                ? "Try changing your search or activity filter."
                                : "Actions you complete in CareLink will appear here."}
                        </p>
                        {(filters.search || filters.category !== "all") && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch("");
                                    visit("all", "");
                                }}
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                )}

                {activities.links.length > 3 && (
                    <nav className="activity-pagination" aria-label="Activity pages">
                        {activities.links.map((link, index) =>
                            link.url ? (
                                <Link
                                    href={link.url}
                                    key={`${link.label}-${index}`}
                                    className={link.active ? "active" : ""}
                                    preserveScroll
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ) : (
                                <span
                                    key={`${link.label}-${index}`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ),
                        )}
                    </nav>
                )}
            </section>
        </DashboardLayout>
    );
}
