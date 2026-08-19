import DashboardLayout from "@/Layouts/DashboardLayout";

export default function Dashboard({ user }) {
    return (
        <DashboardLayout role="provider" title="Provider Dashboard">
            <p>Welcome, {user.name}</p>
        </DashboardLayout>
    );
}
