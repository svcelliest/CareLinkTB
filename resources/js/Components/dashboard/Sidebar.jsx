import { useState } from "react";
import { Link, usePage } from "@inertiajs/react";
import { FaArrowRightFromBracket } from "react-icons/fa6";
import LogoutModal from "@/Components/modal/LogoutModal";

export default function Sidebar({
    portalLabel,
    portalInitials,
    logoSrc,
    logoAlt,
    items,
    isOpen,
    onClose,
}) {
    const { url, props } = usePage();
    const [logoutOpen, setLogoutOpen] = useState(false);
    const unreadMessageCount = props.unreadMessageCount ?? 0;

    return (
        <aside
            id="dashboard-sidebar"
            className={`dash-sidebar ${isOpen ? "open" : ""}`}
        >
            <div className="dash-brand">
                <img
                    className="dash-brand-mark"
                    src="/img/logo_img/icm_logo_transparent.png"
                    alt=""
                    aria-hidden="true"
                />
                <span>CareLink TB</span>
            </div>

            <div className="dash-sidebar-top">
                {logoSrc ? (
                    <img
                        className="dash-portal-logo"
                        src={logoSrc}
                        alt={logoAlt ?? `${portalLabel} logo`}
                    />
                ) : (
                    <div className="dash-logo-placeholder" aria-hidden="true">
                        <span>{portalInitials}</span>
                    </div>
                )}
                <div className="dash-portal-label">{portalLabel}</div>
            </div>

            <nav className="dash-nav" aria-label={`${portalLabel} navigation`}>
                {items.map((item) => {
                    let href = "#";
                    try {
                        href = route(item.route);
                    } catch (e) {
                        href = "#";
                    }
                    const isActive =
                        href !== "#" &&
                        url.startsWith(
                            new URL(href, window.location.origin).pathname,
                        );
                    const Icon = item.Icon;

                    return (
                        <Link
                            key={item.route}
                            href={href}
                            className={`dash-nav-link ${isActive ? "active" : ""}`}
                            aria-current={isActive ? "page" : undefined}
                            onClick={onClose}
                        >
                            <Icon />
                            <span>{item.label}</span>
                            {item.route.endsWith(".inbox") &&
                                unreadMessageCount > 0 && (
                                    <span className="dash-nav-badge">
                                        {unreadMessageCount > 99
                                            ? "99+"
                                            : unreadMessageCount}
                                    </span>
                                )}
                        </Link>
                    );
                })}
            </nav>

            <div className="dash-sidebar-bottom">
                <button
                    type="button"
                    onClick={() => {
                        onClose();
                        setLogoutOpen(true);
                    }}
                    className="dash-logout-btn"
                >
                    <FaArrowRightFromBracket />
                    Log Out
                </button>
            </div>

            <LogoutModal
                isOpen={logoutOpen}
                onClose={() => setLogoutOpen(false)}
                portalLabel={`${portalInitials} Portal`}
            />
        </aside>
    );
}
