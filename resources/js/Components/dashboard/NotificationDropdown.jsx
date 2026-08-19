import { useEffect, useRef, useState } from "react";
import { Link, router } from "@inertiajs/react";
import { FaBell, FaCheck, FaEnvelope } from "react-icons/fa6";
import { formatNotificationTime } from "@/utils/notifications";

export default function NotificationDropdown({ notifications, unreadCount }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;

        const closeOnOutsideClick = (event) => {
            if (!rootRef.current?.contains(event.target)) setOpen(false);
        };
        const closeOnEscape = (event) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", closeOnOutsideClick);
        document.addEventListener("keydown", closeOnEscape);

        return () => {
            document.removeEventListener("mousedown", closeOnOutsideClick);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [open]);

    const openNotification = (notification) => {
        setOpen(false);

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
        router.patch(
            route("notifications.read-all"),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                only: ["recentNotifications", "unreadNotificationCount", "flash"],
            },
        );
    };

    return (
        <div className="notification-menu" ref={rootRef}>
            <button
                type="button"
                className="dash-bell-btn"
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                aria-expanded={open}
                aria-controls="notification-popover"
                onClick={() => setOpen((value) => !value)}
            >
                <FaBell />
                {unreadCount > 0 && (
                    <span className="dash-bell-count" aria-hidden="true">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <section
                    id="notification-popover"
                    className="notification-popover"
                    aria-label="Recent notifications"
                >
                    <div className="notification-popover-header">
                        <div>
                            <h2>Notifications</h2>
                            <p>{unreadCount ? `${unreadCount} unread` : "You're all caught up"}</p>
                        </div>
                        {unreadCount > 0 && (
                            <button type="button" onClick={markAllRead}>
                                <FaCheck /> Mark all read
                            </button>
                        )}
                    </div>

                    <div className="notification-popover-list">
                        {notifications.length ? (
                            notifications.map((notification) => (
                                <button
                                    type="button"
                                    className={`notification-popover-item ${
                                        notification.is_read ? "" : "unread"
                                    }`}
                                    key={notification.id}
                                    onClick={() => openNotification(notification)}
                                >
                                    <span className="notification-item-icon">
                                        {notification.kind === "message" ? (
                                            <FaEnvelope />
                                        ) : (
                                            <FaBell />
                                        )}
                                    </span>
                                    <span className="notification-item-copy">
                                        <strong>{notification.title}</strong>
                                        <span>{notification.message}</span>
                                        <time dateTime={notification.created_at ?? undefined}>
                                            {formatNotificationTime(notification.created_at)}
                                        </time>
                                    </span>
                                    {!notification.is_read && (
                                        <span className="notification-unread-dot" aria-label="Unread" />
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="notification-popover-empty">
                                <FaBell />
                                <strong>No notifications yet</strong>
                                <span>New messages and updates will appear here.</span>
                            </div>
                        )}
                    </div>

                    <Link
                        href={route("notifications.index")}
                        className="notification-view-all"
                        onClick={() => setOpen(false)}
                    >
                        View all notifications
                    </Link>
                </section>
            )}
        </div>
    );
}
