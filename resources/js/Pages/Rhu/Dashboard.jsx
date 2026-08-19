import { FaBullseye, FaUsers } from "react-icons/fa6";
import SummaryCards from "@/Components/dashboard/SummaryCards";
import DashboardLayout from "@/Layouts/DashboardLayout";

export default function Dashboard({ user, stats }) {
    const cards = [
        {
            label: "Suspicious Patients",
            value: stats.suspicious_patients,
            href: route("rhu.programs.index"),
            Icon: FaBullseye,
            tone: "blue",
        },
        {
            label: "Active Cases",
            value: stats.active_cases,
            href: route("rhu.programs.index"),
            Icon: FaUsers,
            tone: "green",
        },
    ];

    return (
        <DashboardLayout
            role="rhu"
            title="RHU Dashboard"
            contentClassName="dash-content-overview"
        >
            <section
                className="dashboard-overview"
                aria-label={`${user.name}'s RHU summary`}
            >
                <SummaryCards cards={cards} />
            </section>
        </DashboardLayout>
    );
}
