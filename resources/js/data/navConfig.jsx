import {
    FaTableCellsLarge,
    FaBookOpen,
    FaEnvelope,
    FaChartLine,
    FaUsersGear,
    FaBoxArchive,
    FaHeartPulse,
    FaHouseChimneyMedical,
    FaCircleCheck,
    FaCommentDots,
    FaClockRotateLeft,
} from "react-icons/fa6";

export const navConfig = {
    icm: {
        portalLabel: "ICM Portal",
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
                label: "Contact Tracing",
                route: "icm.contact-tracing.index",
                Icon: FaHouseChimneyMedical,
            },
            {
                label: "Accounts",
                route: "icm.accounts.index",
                Icon: FaUsersGear,
            },
            {
                label: "Archives",
                route: "icm.archives.index",
                Icon: FaBoxArchive,
            },
            { label: "Inbox", route: "icm.inbox", Icon: FaEnvelope },
            {
                label: "Recent Activity",
                route: "icm.activity",
                Icon: FaChartLine,
            },
        ],
    },

    // Order and labels follow the RHU portal reference exactly. There is no
    // Programs entry: programs stay ICM-owned, and the RHU reaches them
    // through the Patient Tracker's program filter.
    rhu: {
        portalLabel: "RHU Portal",
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
                label: "Patient Monitoring",
                route: "rhu.treatment.index",
                Icon: FaHeartPulse,
            },
            {
                label: "Patient Tracker",
                route: "rhu.tracker.index",
                Icon: FaCircleCheck,
            },
            { label: "Inbox", route: "rhu.inbox", Icon: FaEnvelope },
            {
                label: "SMS Log",
                route: "rhu.sms.index",
                Icon: FaCommentDots,
            },
            {
                label: "Recent Activities",
                route: "rhu.activity",
                Icon: FaClockRotateLeft,
            },
        ],
    },

    provider: {
        portalLabel: "Provider Portal",
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
                label: "Program",
                route: "provider.programs.index",
                Icon: FaBookOpen,
            },
            { label: "Inbox", route: "provider.inbox", Icon: FaEnvelope },
            {
                label: "Recent Activity",
                route: "provider.activity",
                Icon: FaChartLine,
            },
        ],
    },
};
