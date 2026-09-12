import { Link, router } from "@inertiajs/react";
import { useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import "../../../css/app/12e-activity-reference.css";

/**
 * Notifications page in the reference portal's card layout.
 *
 * Rows are the real paginated `notifications` prop. Opening one still marks it
 * read through `notifications.read` and follows its url; "Mark All as Read"
 * still posts to `notifications.read-all`. Pagination is kept even though the
 * reference mockup has none.
 */

/** Reference tints: red for alerts, blue for messages, green for confirmations. */
function iconTone(kind) {
    if (kind === "message") return "blue";
    if (kind === "success") return "green";
    return "red";
}

function NotificationIcon({ kind }) {
    if (kind === "message") {
        return (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <polyline points="2,8 12,14 22,8" />
            </svg>
        );
    }

    if (kind === "success") {
        return (
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#27ae60"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22,4 12,14.01 9,11.01" />
            </svg>
        );
    }

    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#c0392b"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    );
}

function timestamp(value) {
    if (!value) return "";
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

export default function Index({ role, notifications }) {
    const [markingAll, setMarkingAll] = useState(false);
    const unreadCount = notifications.data.filter(
        (item) => !item.is_read,
    ).length;

    const openNotification = (notification) => {
        if (notification.is_read) {
            if (notification.url) router.visit(notification.url);
            return;
        }

        router.patch(
            route("notifications.read", notification.id),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    if (notification.url) router.visit(notification.url);
                },
            },
        );
    };

    const markAllRead = () => {
        setMarkingAll(true);
        router.patch(
            route("notifications.read-all"),
            {},
            {
                preserveScroll: true,
                onFinish: () => setMarkingAll(false),
            },
        );
    };

    return (
        <DashboardLayout
            role={role}
            title="Notifications"
            contentClassName="dash-content-notifications"
        >
            <div className="notif-page">
                <div className="notif-page-card">
                    <div className="notif-page-header">
                        <div>
                            <div className="notif-page-title">
                                Notifications
                            </div>
                            <div className="notif-page-sub">
                                All alerts and updates for your portal
                            </div>
                        </div>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                className="mark-all-btn"
                                onClick={markAllRead}
                                disabled={markingAll}
                            >
                                {markingAll && (
                                    <span
                                        className="action-spinner"
                                        aria-hidden="true"
                                    />
                                )}
                                Mark All as Read
                            </button>
                        )}
                    </div>

                    <div className="notif-page-list">
                        {notifications.data.length > 0 ? (
                            notifications.data.map((notification) => (
                                <div
                                    key={notification.id}
                                    role="button"
                                    tabIndex={0}
                                    className={`notif-page-item ${notification.is_read ? "" : "unread"}`}
                                    onClick={() =>
                                        openNotification(notification)
                                    }
                                    onKeyDown={(event) => {
                                        if (
                                            event.key === "Enter" ||
                                            event.key === " "
                                        ) {
                                            event.preventDefault();
                                            openNotification(notification);
                                        }
                                    }}
                                >
                                    <div
                                        className={`notif-page-icon ${iconTone(notification.kind)}`}
                                    >
                                        <NotificationIcon
                                            kind={notification.kind}
                                        />
                                    </div>
                                    <div className="notif-page-content">
                                        <div className="notif-page-item-title">
                                            {notification.title}
                                            {!notification.is_read && (
                                                <span className="notif-unread-pill">
                                                    NEW
                                                </span>
                                            )}
                                        </div>
                                        <div className="notif-page-item-body">
                                            {notification.message}
                                        </div>
                                        <div className="notif-page-item-time">
                                            <time
                                                dateTime={
                                                    notification.created_at ??
                                                    undefined
                                                }
                                            >
                                                {timestamp(
                                                    notification.created_at,
                                                )}
                                            </time>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="notif-page-empty">
                                <p>No notifications yet</p>
                                <span>
                                    When someone sends you a message, it will
                                    show up here.
                                </span>
                            </div>
                        )}
                    </div>

                    {notifications.links.length > 3 && (
                        <nav
                            className="notif-page-pagination"
                            aria-label="Notification pages"
                        >
                            {notifications.links.map((link, index) =>
                                link.url ? (
                                    <Link
                                        href={link.url}
                                        key={`${link.label}-${index}`}
                                        className={link.active ? "active" : ""}
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
            </div>
        </DashboardLayout>
    );
}
