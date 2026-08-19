import { FaBookOpen, FaUsers } from "react-icons/fa6";
import SummaryCards from "@/Components/dashboard/SummaryCards";
import DashboardLayout from "@/Layouts/DashboardLayout";

export default function Dashboard({ user, stats }) {
    const cards = [
        {
            label: "Total Programs",
            value: stats.total_programs,
            subtext: `${stats.active_programs} Active`,
            href: route("icm.programs.index"),
            Icon: FaBookOpen,
            tone: "blue",
        },
        {
            label: "Registered Patients",
            value: stats.registered_patients,
            subtext: "Across all programs",
            href: route("icm.programs.index"),
            Icon: FaUsers,
            tone: "green",
        },
    ];

    return (
        <DashboardLayout
            role="icm"
            title="ICM Dashboard"
            contentClassName="dash-content-overview"
        >
            <section
                className="dashboard-overview"
                aria-label={`${user.name}'s ICM summary`}
            >
                <SummaryCards cards={cards} />
            </section>
        </DashboardLayout>
    );
}
