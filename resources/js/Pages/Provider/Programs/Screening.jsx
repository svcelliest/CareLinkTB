// Patient registration below is local-state only (not persisted to the
// backend) — the current `patients` table requires a `form_type` and a
// clinical `responses` payload that this simplified provider intake screen
// doesn't collect. Real persistence is pending a schema decision on how
// provider-side registration should map onto (or extend) that table.
import { router } from "@inertiajs/react";
import { useMemo, useState } from "react";
import {
    FaArrowLeft,
    FaBell,
    FaCircleCheck,
    FaClock,
    FaDownload,
    FaMagnifyingGlass,
    FaTriangleExclamation,
    FaXmark,
} from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";

const blankForm = {
    name: "",
    birthday: "",
    sex: "",
    address: "",
    contact_number: "",
};

function calcAge(birthday) {
    if (!birthday) return null;
    const dob = new Date(birthday);
    if (Number.isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age;
}

function exportPatientsCsv(patients, programName) {
    const header = [
        "#",
        "Name",
        "Contact",
        "Birthday",
        "Age",
        "Sex",
        "Address",
        "Status",
    ];
    const rows = patients.map((patient) => [
        patient.num,
        patient.name,
        patient.contact_number,
        patient.birthday,
        patient.age,
        patient.sex,
        patient.address,
        patient.status,
    ]);
    const csv = [header, ...rows]
        .map((row) =>
            row
                .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
                .join(","),
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${programName.replace(/\s+/g, "_")}_patients.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

export default function Screening({ program }) {
    const [patients, setPatients] = useState([]);
    const [form, setForm] = useState(blankForm);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [finishing, setFinishing] = useState(false);

    const today = new Date().toISOString().slice(0, 10);

    const totalPatients = patients.length;
    const presumptiveCount = patients.filter(
        (patient) => patient.status === "Presumptive TB",
    ).length;

    const visiblePatients = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return patients;
        return patients.filter((patient) =>
            patient.name.toLowerCase().includes(query),
        );
    }, [patients, search]);

    const setField = (key, value) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const clearForm = () => {
        setForm(blankForm);
        setError("");
    };

    const addPatient = (event) => {
        event.preventDefault();
        setError("");

        if (
            !form.name.trim() ||
            !form.birthday ||
            !form.sex ||
            !form.address.trim() ||
            !form.contact_number.trim()
        ) {
            setError("Please fill in all fields before adding a patient.");
            return;
        }

        if (form.birthday > today) {
            setError("Birthday cannot be in the future.");
            return;
        }

        const num = String(patients.length + 1).padStart(3, "0");

        setPatients((prev) => [
            ...prev,
            {
                id: `local-${Date.now()}`,
                num,
                name: form.name.trim().toUpperCase(),
                birthday: form.birthday,
                age: calcAge(form.birthday),
                sex: form.sex,
                address: form.address.trim(),
                contact_number: form.contact_number.trim(),
                status: "Normal",
                notified: false,
            },
        ]);

        clearForm();
    };

    const togglePresumptive = (id) => {
        const patient = patients.find((p) => p.id === id);
        if (!patient) return;
        const next =
            patient.status === "Presumptive TB" ? "Normal" : "Presumptive TB";
        if (
            !window.confirm(
                `Mark ${patient.name} as ${next === "Presumptive TB" ? "Presumptive TB" : "Normal"}?`,
            )
        ) {
            return;
        }
        setPatients((prev) =>
            prev.map((p) => (p.id === id ? { ...p, status: next } : p)),
        );
    };

    const notifyPatient = (id) => {
        const patient = patients.find((p) => p.id === id);
        if (!patient || patient.notified) return;
        if (!window.confirm(`Send an SMS notification to ${patient.name}?`)) {
            return;
        }
        setPatients((prev) =>
            prev.map((p) => (p.id === id ? { ...p, notified: true } : p)),
        );
    };

    const removePatient = (id) => {
        const patient = patients.find((p) => p.id === id);
        if (!patient) return;
        if (!window.confirm(`Remove ${patient.name} from this program?`)) {
            return;
        }
        setPatients((prev) =>
            prev
                .filter((p) => p.id !== id)
                .map((p, index) => ({
                    ...p,
                    num: String(index + 1).padStart(3, "0"),
                })),
        );
    };

    const finishSession = () => {
        if (
            !window.confirm(
                "Finish this session? The program will be marked completed.",
            )
        ) {
            return;
        }
        setFinishing(true);
        router.patch(
            route("provider.programs.finish", program.id),
            {},
            {
                onFinish: () => setFinishing(false),
            },
        );
    };

    return (
        <DashboardLayout
            role="provider"
            title={program.name}
            contentClassName="dash-content-screening"
        >
            <div className="screening-page">
                <header className="screening-header">
                    <div className="screening-header-top">
                        <button
                            type="button"
                            className="screening-back"
                            onClick={() =>
                                router.visit(route("provider.programs.index"))
                            }
                        >
                            <FaArrowLeft aria-hidden="true" />
                            <span className="screening-back-text">
                                {program.name}
                            </span>
                        </button>
                        <button
                            type="button"
                            className="finish-btn"
                            onClick={finishSession}
                            disabled={finishing}
                        >
                            <FaCircleCheck aria-hidden="true" />
                            {finishing ? "Finishing…" : "Finish Session"}
                        </button>
                    </div>
                    <p className="screening-sub">
                        <span>{program.location}</span>
                        <span className="dot-sep">·</span>
                        <span>
                            {program.date_label} · {program.time_label}
                        </span>
                    </p>
                    <div className="screening-status-row">
                        <span className="active-dot" />
                        <span className="active-session-label">
                            Active Session
                        </span>
                        <span className="session-meta">
                            Total Patients: <strong>{totalPatients}</strong>
                        </span>
                        <span className="session-meta">
                            Presumptive TB:{" "}
                            <span className="presump-count">
                                {presumptiveCount}
                            </span>
                        </span>
                        <span className="last-updated">
                            <FaClock aria-hidden="true" />
                            Local session — not yet saved to records
                        </span>
                    </div>
                </header>

                <div className="screening-body">
                    <div className="register-card">
                        <h3 className="register-title">Register Patient</h3>
                        <form onSubmit={addPatient}>
                            <div className="field-group">
                                <label className="field-label">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    className="field-input"
                                    value={form.name}
                                    onChange={(event) =>
                                        setField("name", event.target.value)
                                    }
                                    placeholder="Enter full name"
                                />
                            </div>
                            <div className="field-row">
                                <div className="field-group">
                                    <label className="field-label">
                                        Birthday
                                    </label>
                                    <input
                                        type="date"
                                        className="field-input"
                                        max={today}
                                        value={form.birthday}
                                        onChange={(event) =>
                                            setField(
                                                "birthday",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </div>
                                <div className="field-group">
                                    <label className="field-label">Sex</label>
                                    <select
                                        className="field-select"
                                        value={form.sex}
                                        onChange={(event) =>
                                            setField("sex", event.target.value)
                                        }
                                    >
                                        <option value="">Select sex</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                            </div>
                            <div className="field-group">
                                <label className="field-label">Address</label>
                                <input
                                    type="text"
                                    className="field-input"
                                    value={form.address}
                                    onChange={(event) =>
                                        setField(
                                            "address",
                                            event.target.value,
                                        )
                                    }
                                    placeholder="Barangay, municipality, province"
                                />
                            </div>
                            <div className="field-group">
                                <label className="field-label">
                                    Contact Number
                                </label>
                                <input
                                    type="text"
                                    className="field-input"
                                    value={form.contact_number}
                                    onChange={(event) =>
                                        setField(
                                            "contact_number",
                                            event.target.value,
                                        )
                                    }
                                    placeholder="09xxxxxxxxx"
                                />
                            </div>
                            {error && (
                                <p className="field-error">{error}</p>
                            )}
                            <div className="reg-btn-row">
                                <button
                                    type="submit"
                                    className="add-patient-btn"
                                >
                                    Add Patient
                                </button>
                                <button
                                    type="button"
                                    className="clear-btn"
                                    onClick={clearForm}
                                >
                                    Clear
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="patient-list-card">
                        <div className="patient-list-top">
                            <label className="patient-search-box">
                                <FaMagnifyingGlass aria-hidden="true" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search patients"
                                />
                            </label>
                            <button
                                type="button"
                                className="patient-export-btn"
                                onClick={() =>
                                    exportPatientsCsv(patients, program.name)
                                }
                            >
                                <FaDownload aria-hidden="true" />
                                Export
                            </button>
                        </div>

                        <div className="patient-table-wrap">
                            {visiblePatients.length > 0 ? (
                                <table className="patient-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Patient</th>
                                            <th>Details</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visiblePatients.map((patient) => (
                                            <tr key={patient.id}>
                                                <td>{patient.num}</td>
                                                <td>
                                                    <span className="patient-name">
                                                        {patient.name}
                                                    </span>
                                                    <span className="patient-contact">
                                                        {
                                                            patient.contact_number
                                                        }
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="patient-age">
                                                        {patient.age} /{" "}
                                                        {patient.sex}
                                                    </span>
                                                    <span className="patient-addr">
                                                        {patient.address}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span
                                                        className={
                                                            patient.status ===
                                                            "Presumptive TB"
                                                                ? "status-presump"
                                                                : "status-normal"
                                                        }
                                                    >
                                                        {patient.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="action-col">
                                                        <button
                                                            type="button"
                                                            className={`action-warn-btn ${patient.status === "Presumptive TB" ? "active" : ""}`}
                                                            onClick={() =>
                                                                togglePresumptive(
                                                                    patient.id,
                                                                )
                                                            }
                                                            aria-label="Toggle presumptive status"
                                                        >
                                                            <FaTriangleExclamation aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`action-notify-btn ${patient.notified ? "sent" : ""}`}
                                                            onClick={() =>
                                                                notifyPatient(
                                                                    patient.id,
                                                                )
                                                            }
                                                            disabled={
                                                                patient.notified
                                                            }
                                                            aria-label="Notify patient"
                                                        >
                                                            <FaBell aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="action-more-btn"
                                                            onClick={() =>
                                                                removePatient(
                                                                    patient.id,
                                                                )
                                                            }
                                                            aria-label="Remove patient"
                                                        >
                                                            <FaXmark aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="empty-patients">
                                    <FaMagnifyingGlass aria-hidden="true" />
                                    <p>No patients registered yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
