import { Link, usePage } from "@inertiajs/react";
import { FaBars, FaCircleUser } from "react-icons/fa6";
import NotificationDropdown from "./NotificationDropdown";

export default function Header({
    title,
    roleLabel,
    roleShortLabel,
    sidebarOpen,
    onMenuToggle,
}) {
    const {
        auth,
        recentNotifications = [],
        unreadNotificationCount = 0,
    } = usePage().props;

    return (
        <header className="dash-header">
            <div className="dash-header-left">
                <button
                    type="button"
                    className="dash-menu-btn"
                    onClick={onMenuToggle}
                    aria-label={
                        sidebarOpen
                            ? "Close navigation menu"
                            : "Open navigation menu"
                    }
                    aria-controls="dashboard-sidebar"
                    aria-expanded={sidebarOpen}
                >
                    <FaBars />
                </button>
                <h1 className="dash-header-title">{title}</h1>
            </div>

            <div className="dash-header-right">
                <NotificationDropdown
                    notifications={recentNotifications}
                    unreadCount={unreadNotificationCount}
                />

                <Link
                    href={route("profile.edit")}
                    className="dash-header-user"
                    aria-label="Open profile settings"
                >
                    <div className="dash-header-user-text">
                        <div className="dash-header-user-name">
                            {auth?.user?.name ?? "User"}
                        </div>
                        <div className="dash-header-user-role">
                            {roleShortLabel ?? roleLabel ?? auth?.user?.role ?? ""}
                        </div>
                    </div>
                    <div className="dash-header-avatar">
                        {auth?.user?.avatar_url ? (
                            <img src={auth.user.avatar_url} alt="" />
                        ) : (
                            <FaCircleUser aria-hidden="true" />
                        )}
                    </div>
                </Link>
            </div>
        </header>
    );
}
