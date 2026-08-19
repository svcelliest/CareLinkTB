import { Link, router } from "@inertiajs/react";
import { FaBell, FaCheckDouble, FaEnvelope } from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { formatNotificationTime } from "@/utils/notifications";

export default function Index({ role, notifications }) {
    const unreadCount = notifications.data.filter((item) => !item.is_read).length;

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
        router.patch(route("notifications.read-all"), {}, { preserveScroll: true });
    };

    return (
        <DashboardLayout role={role} title="Notifications" contentClassName="dash-content-notifications">
            <section className="notifications-page" aria-labelledby="notifications-heading">
                <div className="notifications-page-header">
                    <div>
                        <h2 id="notifications-heading">Your notifications</h2>
                        <p>Messages and important CareLink updates are kept here.</p>
                    </div>
                    {unreadCount > 0 && (
                        <button type="button" onClick={markAllRead}>
                            <FaCheckDouble /> Mark all as read
                        </button>
                    )}
                </div>

                <div className="notifications-page-list">
                    {notifications.data.length ? (
                        notifications.data.map((notification) => (
                            <button
                                type="button"
                                key={notification.id}
                                className={`notifications-page-item ${
                                    notification.is_read ? "" : "unread"
                                }`}
                                onClick={() => openNotification(notification)}
                            >
                                <span className="notifications-page-icon">
                                    {notification.kind === "message" ? <FaEnvelope /> : <FaBell />}
                                </span>
                                <span className="notifications-page-copy">
                                    <span className="notifications-page-title-row">
                                        <strong>{notification.title}</strong>
                                        <time dateTime={notification.created_at ?? undefined}>
                                            {formatNotificationTime(notification.created_at)}
                                        </time>
                                    </span>
                                    <span>{notification.message}</span>
                                </span>
                                {!notification.is_read && <span className="notifications-page-dot" />}
                            </button>
                        ))
                    ) : (
                        <div className="notifications-page-empty">
                            <FaBell />
                            <h3>No notifications yet</h3>
                            <p>When someone sends you a message, it will show up here.</p>
                        </div>
                    )}
                </div>

                {notifications.links.length > 3 && (
                    <nav className="notifications-pagination" aria-label="Notification pages">
                        {notifications.links.map((link, index) =>
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
