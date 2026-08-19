import {
    FaTableCellsLarge,
    FaBookOpen,
    FaFileLines,
    FaEnvelope,
    FaChartLine,
    FaClipboardList,
    FaUsersGear,
} from "react-icons/fa6";

export const navConfig = {
    icm: {
        portalLabel: "International Care Ministries",
        portalInitials: "ICM",
        logoSrc: "/img/logo_img/icm_logo.png",
        logoAlt: "International Care Ministries logo",
        roleLabel: "ICM Coordinator",
        roleShortLabel: "ICM",
        items: [
            {
                label: "Dashboard",
                route: "icm.dashboard",
                Icon: FaTableCellsLarge,
            },
            {
                label: "Programs",
                route: "icm.programs.index",
                Icon: FaBookOpen,
            },
            {
                label: "Accounts",
                route: "icm.accounts.index",
                Icon: FaUsersGear,
            },
            { label: "Forms", route: "icm.forms", Icon: FaFileLines },
            { label: "Inbox", route: "icm.inbox", Icon: FaEnvelope },
            {
                label: "Recent Activity",
                route: "icm.activity",
                Icon: FaChartLine,
            },
        ],
    },

    rhu: {
        portalLabel: "Rural Health Unit",
        portalInitials: "RHU",
        logoSrc: "/img/logo_img/rhu_logo.png",
        logoAlt: "Rural Health Unit logo",
        roleLabel: "RHU Staff",
        roleShortLabel: "RHU",
        items: [
            {
                label: "Dashboard",
                route: "rhu.dashboard",
                Icon: FaTableCellsLarge,
            },
            {
                label: "Programs & Forms",
                route: "rhu.programs.index",
                Icon: FaClipboardList,
            },
            { label: "Inbox", route: "rhu.inbox", Icon: FaEnvelope },
            {
                label: "Recent Activity",
                route: "rhu.activity",
                Icon: FaChartLine,
            },
        ],
    },

    provider: {
        portalLabel: "Diagnostic Provider",
        portalInitials: "PRV",
        logoSrc: "/img/logo_img/provider_logo.png",
        logoAlt: "Diagnostic Provider logo",
        roleLabel: "Provider Staff",
        roleShortLabel: "PRV",
        items: [
            {
                label: "Dashboard",
                route: "provider.dashboard",
                Icon: FaTableCellsLarge,
            },
            {
                label: "Referrals",
                route: "provider.referrals",
                Icon: FaBookOpen,
            },
            { label: "Forms", route: "provider.forms", Icon: FaFileLines },
            { label: "Inbox", route: "provider.inbox", Icon: FaEnvelope },
            {
                label: "Recent Activity",
                route: "provider.activity",
                Icon: FaChartLine,
            },
        ],
    },
};
