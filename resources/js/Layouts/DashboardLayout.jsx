import { useEffect, useState } from "react";
import { Head } from "@inertiajs/react";
import { useLivePoll } from "@/hooks/useLivePoll";
import Sidebar from "@/Components/dashboard/Sidebar";
import Header from "@/Components/dashboard/Header";
import { navConfig } from "@/data/navConfig.jsx";

export default function DashboardLayout({
    role,
    title,
    children,
    contentClassName = "",
}) {
    const config = navConfig[role];
    const [sidebarOpen, setSidebarOpen] = useState(false);
    useLivePoll([
        "unreadMessageCount",
        "unreadNotificationCount",
        "recentNotifications",
    ]);

    useEffect(() => {
        if (!sidebarOpen) {
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setSidebarOpen(false);
            }
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [sidebarOpen]);

    const closeSidebar = () => setSidebarOpen(false);

    return (
        <>
            <Head title={title} />
            <div className="dash-shell">
                <button
                    type="button"
                    className={`dash-sidebar-overlay ${sidebarOpen ? "visible" : ""}`}
                    onClick={closeSidebar}
                    aria-label="Close navigation menu"
                    aria-hidden={!sidebarOpen}
                    tabIndex={sidebarOpen ? 0 : -1}
                />
                <Sidebar
                    portalLabel={config.portalLabel}
                    portalInitials={config.portalInitials}
                    logoSrc={config.logoSrc}
                    logoAlt={config.logoAlt}
                    items={config.items}
                    isOpen={sidebarOpen}
                    onClose={closeSidebar}
                />
                <div className="dash-main">
                    <Header
                        title={title}
                        roleLabel={config.roleLabel}
                        roleShortLabel={config.roleShortLabel}
                        sidebarOpen={sidebarOpen}
                        onMenuToggle={() => setSidebarOpen((open) => !open)}
                    />
                    <main className={`dash-content ${contentClassName}`.trim()}>
                        {children}
                    </main>
                </div>
            </div>
        </>
    );
}
