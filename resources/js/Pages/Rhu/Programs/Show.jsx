import { Link } from "@inertiajs/react";
import { useMemo, useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";

export default function Show({ program, patients }) {
    const [search, setSearch] = useState("");

    const visiblePatients = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return patients;

        return patients.filter((patient) =>
            [patient.name, patient.contact_number]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(query)),
        );
    }, [patients, search]);

    return (
        <DashboardLayout role="rhu" title="Forms">
            <p>
                <Link href={route("rhu.programs.index")}>&larr; All programs</Link>
            </p>

            <h2>{program.name}</h2>
            <p>
                {program.location} &middot; {program.date_label} &middot; {program.time_label} &middot; {program.status}
            </p>

            <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search patient name or contact"
            />

            <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", marginTop: "12px" }}>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Date of birth</th>
                        <th>Age</th>
                        <th>Sex</th>
                        <th>Contact</th>
                        <th>Address</th>
                        <th>Presumptive</th>
                        <th>SCDA</th>
                        <th>Contact Tracing</th>
                        <th>Last updated</th>
                    </tr>
                </thead>
                <tbody>
                    {visiblePatients.length > 0 ? (
                        visiblePatients.map((patient) => (
                            <tr key={patient.id}>
                                <td>{patient.name}</td>
                                <td>{patient.date_of_birth ?? "-"}</td>
                                <td>{patient.age ?? "-"}</td>
                                <td>{patient.sex ?? "-"}</td>
                                <td>{patient.contact_number ?? "-"}</td>
                                <td>{patient.address ?? "-"}</td>
                                <td>{patient.presumptive ? "Yes" : "No"}</td>
                                <td>{patient.scda_status}</td>
                                <td>{patient.contact_tracing_status}</td>
                                <td>{patient.updated_at_label}</td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="10">No patients registered under this program yet.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </DashboardLayout>
    );
}
