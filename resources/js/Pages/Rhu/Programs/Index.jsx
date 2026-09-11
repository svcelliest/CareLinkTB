import { useMemo, useState } from "react";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { useLivePoll } from "@/hooks/useLivePoll";

export default function Index({ patients }) {
    const [search, setSearch] = useState("");

    useLivePoll(["patients"]);

    const filteredPatients = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return patients;

        return patients.filter(
            (patient) =>
                patient.name.toLowerCase().includes(query) ||
                patient.program_name.toLowerCase().includes(query) ||
                (patient.contact_number ?? "").toLowerCase().includes(query),
        );
    }, [patients, search]);

    return (
        <DashboardLayout role="rhu" title="Forms">
            <h2>Forms</h2>
            <p>
                Patients registered by a Provider under your location's
                programs.
            </p>

            <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by patient name, program, or contact"
            />

            <table
                border="1"
                cellPadding="6"
                style={{ borderCollapse: "collapse", marginTop: "12px" }}
            >
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Age / Sex</th>
                        <th>Address</th>
                        <th>Contact</th>
                        <th>Program</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredPatients.length > 0 ? (
                        filteredPatients.map((patient) => (
                            <tr key={patient.id}>
                                <td>{patient.name}</td>
                                <td>
                                    {patient.age ?? "-"} / {patient.sex ?? "-"}
                                </td>
                                <td>{patient.address ?? "-"}</td>
                                <td>{patient.contact_number ?? "-"}</td>
                                <td>{patient.program_name}</td>
                                <td>{patient.status}</td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="6">No patients registered yet.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </DashboardLayout>
    );
}
