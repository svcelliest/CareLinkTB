import { router } from "@inertiajs/react";
import { useMemo, useState } from "react";
import {
    FaArrowLeft,
    FaBell,
    FaCircleCheck,
    FaClock,
    FaDownload,
    FaMagnifyingGlass,
    FaRotateRight,
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
        patient.number,
        patient.name,
        patient.contact_number,
        patient.date_of_birth,
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

function hydrateSavedPatient(patient) {
    return {
        id: patient.id,
        name: patient.name,
        date_of_birth: patient.date_of_birth,
        age: patient.age,
        sex: patient.sex,
        address: patient.address,
        contact_number: patient.contact_number,
        status: patient.status,
    };
}

function pendingStorageKey(programId) {
    return `screening-pending-${programId}`;
}

// A patient that failed to save (e.g. connection dropped mid-registration)
// is kept here so the draft survives a closed tab or a lost connection,
// and reappears with a Retry button next time this page loads.
function readPendingBackups(programId) {
    try {
        const raw = window.localStorage.getItem(pendingStorageKey(programId));
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function writePendingBackup(programId, clientId, payload, syncError) {
    try {
        const store = readPendingBackups(programId);
        store[clientId] = { payload, syncError };
        window.localStorage.setItem(
            pendingStorageKey(programId),
            JSON.stringify(store),
        );
    } catch {
        // Storage unavailable (private mode, quota) — the row still works
        // for this session, it just won't survive a reload.
    }
}

function clearPendingBackup(programId, clientId) {
    try {
        const store = readPendingBackups(programId);
        delete store[clientId];
        window.localStorage.setItem(
            pendingStorageKey(programId),
            JSON.stringify(store),
        );
    } catch {
        // Nothing to do — see writePendingBackup.
    }
}

function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? "";
}

async function apiRequest(method, url, payload) {
    const response = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-CSRF-TOKEN": csrfToken(),
        },
        credentials: "same-origin",
        body: JSON.stringify(payload ?? {}),
    });

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const errors = data?.errors
            ? Object.fromEntries(
                  Object.entries(data.errors).map(([key, messages]) => [
                      key,
                      Array.isArray(messages) ? messages[0] : messages,
                  ]),
              )
            : {};
        const error = new Error(data?.message ?? "Request failed.");
        error.errors = errors;
        throw error;
    }

    return data;
}

function initialPatients(program, patients) {
    const saved = (patients ?? []).map((patient) => ({
        ...hydrateSavedPatient(patient),
        clientId: `saved-${patient.id}`,
        notified: false,
        sync: "saved",
        syncError: null,
        pending: null,
    }));

    const backups = readPendingBackups(program.id);
    const pendingRows = Object.entries(backups).map(([clientId, entry]) => ({
        clientId,
        id: null,
        name: entry.payload.name,
        date_of_birth: entry.payload.date_of_birth,
        age: calcAge(entry.payload.date_of_birth),
        sex: entry.payload.sex,
        address: entry.payload.address,
        contact_number: entry.payload.contact_number,
        status: "Normal",
        notified: false,
        sync: "failed",
        syncError: entry.syncError ?? "Not yet saved. Tap retry.",
        pending: {
            method: "store",
            url: route("provider.programs.patients.store", program.id),
            payload: entry.payload,
        },
    }));

    return [...saved, ...pendingRows];
}

function rowClassName(patient) {
    if (patient.sync === "failed") return "row-failed";
    if (patient.sync === "saving" || patient.sync === "deleting") {
        return "row-syncing";
    }
    return "";
}

export default function Screening({ program, patients: initialPatientsData }) {
    const [patients, setPatients] = useState(() =>
        initialPatients(program, initialPatientsData),
    );
    const [form, setForm] = useState(blankForm);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [finishing, setFinishing] = useState(false);
    const [sessionInvalid, setSessionInvalid] = useState(null);

    const today = new Date().toISOString().slice(0, 10);

    const totalPatients = patients.length;
    const presumptiveCount = patients.filter(
        (patient) => patient.status === "Presumptive TB",
    ).length;
    const hasUnsettledRows = patients.some(
        (patient) =>
            patient.sync === "saving" ||
            patient.sync === "failed" ||
            patient.sync === "deleting",
    );
    const unsettledCount = patients.filter(
        (patient) =>
            patient.sync === "saving" ||
            patient.sync === "failed" ||
            patient.sync === "deleting",
    ).length;

    const numberedPatients = useMemo(
        () =>
            patients.map((patient, index) => ({
                ...patient,
                number: index + 1,
            })),
        [patients],
    );

    const visiblePatients = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return numberedPatients;
        return numberedPatients.filter((patient) =>
            patient.name.toLowerCase().includes(query),
        );
    }, [numberedPatients, search]);

    const setField = (key, value) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const clearForm = () => {
        setForm(blankForm);
        setError("");
    };

    const resolveRow = (clientId, savedPatient) => {
        setPatients((prev) =>
            prev.map((p) =>
                p.clientId === clientId
                    ? {
                          ...p,
                          ...hydrateSavedPatient(savedPatient),
                          sync: "saved",
                          syncError: null,
                          pending: null,
                      }
                    : p,
            ),
        );
        clearPendingBackup(program.id, clientId);
    };

    const handleRowError = (clientId, err, pending) => {
        const errors = err.errors ?? {};
        if (errors.program) {
            setSessionInvalid(errors.program);
            return;
        }
        const message =
            Object.values(errors)[0] ?? err.message ?? "Failed to save. Tap retry.";
        setPatients((prev) =>
            prev.map((p) =>
                p.clientId === clientId
                    ? { ...p, sync: "failed", syncError: message, pending }
                    : p,
            ),
        );
        if (pending.method === "store") {
            writePendingBackup(program.id, clientId, pending.payload, message);
        }
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

        const clientId = `local-${crypto.randomUUID()}`;
        const payload = {
            name: form.name.trim(),
            date_of_birth: form.birthday,
            sex: form.sex,
            address: form.address.trim(),
            contact_number: form.contact_number.trim(),
            presumptive: false,
        };
        const url = route("provider.programs.patients.store", program.id);

        setPatients((prev) => [
            ...prev,
            {
                clientId,
                id: null,
                name: payload.name,
                date_of_birth: payload.date_of_birth,
                age: calcAge(payload.date_of_birth),
                sex: payload.sex,
                address: payload.address,
                contact_number: payload.contact_number,
                status: "Normal",
                notified: false,
                sync: "saving",
                syncError: null,
                pending: { method: "store", url, payload },
            },
        ]);

        // Written immediately, before the request even resolves — if the
        // connection drops right now, the draft is still recoverable.
        writePendingBackup(program.id, clientId, payload, null);
        clearForm();

        apiRequest("POST", url, payload)
            .then((data) => resolveRow(clientId, data.saved_patient))
            .catch((err) =>
                handleRowError(clientId, err, { method: "store", url, payload }),
            );
    };

    const retry = (clientId) => {
        const patient = patients.find((p) => p.clientId === clientId);
        if (!patient || !patient.pending) return;

        setPatients((prev) =>
            prev.map((p) =>
                p.clientId === clientId
                    ? { ...p, sync: "saving", syncError: null }
                    : p,
            ),
        );

        const { method, url, payload } = patient.pending;
        const httpMethod = method === "store" ? "POST" : "PATCH";
        apiRequest(httpMethod, url, payload)
            .then((data) => resolveRow(clientId, data.saved_patient))
            .catch((err) => handleRowError(clientId, err, patient.pending));
    };

    const togglePresumptive = (clientId) => {
        const patient = patients.find((p) => p.clientId === clientId);
        if (!patient || patient.id === null || patient.sync !== "saved") return;

        const next =
            patient.status === "Presumptive TB" ? "Normal" : "Presumptive TB";
        if (!window.confirm(`Mark ${patient.name} as ${next}?`)) return;

        const previousStatus = patient.status;
        const payload = {
            name: patient.name,
            date_of_birth: patient.date_of_birth,
            sex: patient.sex,
            address: patient.address,
            contact_number: patient.contact_number,
            presumptive: next === "Presumptive TB",
        };
        const url = route("provider.programs.patients.update", [
            program.id,
            patient.id,
        ]);

        setPatients((prev) =>
            prev.map((p) =>
                p.clientId === clientId
                    ? { ...p, status: next, sync: "saving", syncError: null }
                    : p,
            ),
        );

        apiRequest("PATCH", url, payload)
            .then((data) => resolveRow(clientId, data.saved_patient))
            .catch((err) => {
                const errors = err.errors ?? {};
                if (errors.program) {
                    setSessionInvalid(errors.program);
                    return;
                }
                setPatients((prev) =>
                    prev.map((p) =>
                        p.clientId === clientId
                            ? {
                                  ...p,
                                  status: previousStatus,
                                  sync: "failed",
                                  syncError:
                                      Object.values(errors)[0] ??
                                      "Failed to update. Tap retry.",
                                  pending: { method: "update", url, payload },
                              }
                            : p,
                    ),
                );
            });
    };

    const notifyPatient = (clientId) => {
        const patient = patients.find((p) => p.clientId === clientId);
        if (!patient || patient.notified) return;
        if (!window.confirm(`Send an SMS notification to ${patient.name}?`)) {
            return;
        }
        setPatients((prev) =>
            prev.map((p) =>
                p.clientId === clientId ? { ...p, notified: true } : p,
            ),
        );
    };

    const removePatient = (clientId) => {
        const patient = patients.find((p) => p.clientId === clientId);
        if (!patient) return;
        if (!window.confirm(`Remove ${patient.name} from this program?`)) {
            return;
        }

        if (patient.id === null) {
            setPatients((prev) => prev.filter((p) => p.clientId !== clientId));
            clearPendingBackup(program.id, clientId);
            return;
        }

        setPatients((prev) =>
            prev.map((p) =>
                p.clientId === clientId
                    ? { ...p, sync: "deleting", syncError: null }
                    : p,
            ),
        );

        apiRequest(
            "DELETE",
            route("provider.programs.patients.destroy", [program.id, patient.id]),
        )
            .then(() =>
                setPatients((prev) => prev.filter((p) => p.clientId !== clientId)),
            )
            .catch((err) => {
                const errors = err.errors ?? {};
                if (errors.program) {
                    setSessionInvalid(errors.program);
                    return;
                }
                setPatients((prev) =>
                    prev.map((p) =>
                        p.clientId === clientId
                            ? {
                                  ...p,
                                  sync: "saved",
                                  syncError:
                                      Object.values(errors)[0] ??
                                      "Failed to remove. Try again.",
                              }
                            : p,
                    ),
                );
            });
    };

    const finishSession = () => {
        if (hasUnsettledRows || sessionInvalid) return;
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
                            disabled={finishing || hasUnsettledRows || !!sessionInvalid}
                            title={
                                sessionInvalid
                                    ? "This session was already finished."
                                    : hasUnsettledRows
                                      ? "Resolve unsaved patients before finishing."
                                      : undefined
                            }
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
                        <span className="active-session-label">Active Session</span>
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
                            Patients are saved as you add them
                        </span>
                    </div>
                    {sessionInvalid && (
                        <div className="session-invalid-banner">
                            <FaTriangleExclamation aria-hidden="true" />
                            {sessionInvalid} Reload the page to continue.
                        </div>
                    )}
                    {!sessionInvalid && hasUnsettledRows && (
                        <div className="unsettled-banner">
                            <FaTriangleExclamation aria-hidden="true" />
                            {unsettledCount} patient(s) not yet saved — resolve
                            before finishing.
                        </div>
                    )}
                </header>

                <div className="screening-body">
                    <div className="register-card">
                        <h3 className="register-title">Register Patient</h3>
                        <form onSubmit={addPatient}>
                            <fieldset disabled={!!sessionInvalid} className="register-fieldset">
                                <div className="field-group">
                                    <label className="field-label">Full Name</label>
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
                                        <label className="field-label">Birthday</label>
                                        <input
                                            type="date"
                                            className="field-input"
                                            max={today}
                                            value={form.birthday}
                                            onChange={(event) =>
                                                setField("birthday", event.target.value)
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
                                            setField("address", event.target.value)
                                        }
                                        placeholder="Barangay, municipality, province"
                                    />
                                </div>
                                <div className="field-group">
                                    <label className="field-label">Contact Number</label>
                                    <input
                                        type="text"
                                        className="field-input"
                                        value={form.contact_number}
                                        onChange={(event) =>
                                            setField("contact_number", event.target.value)
                                        }
                                        placeholder="09xxxxxxxxx"
                                    />
                                </div>
                                {error && <p className="field-error">{error}</p>}
                                <div className="reg-btn-row">
                                    <button type="submit" className="add-patient-btn">
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
                            </fieldset>
                        </form>
                    </div>

                    <div className="patient-list-card">
                        <div className="patient-list-top">
                            <label className="patient-search-box">
                                <FaMagnifyingGlass aria-hidden="true" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search patients"
                                />
                            </label>
                            <button
                                type="button"
                                className="patient-export-btn"
                                onClick={() =>
                                    exportPatientsCsv(numberedPatients, program.name)
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
                                            <th>Sync</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visiblePatients.map((patient) => (
                                            <tr
                                                key={patient.clientId}
                                                className={rowClassName(patient)}
                                            >
                                                <td>{patient.number}</td>
                                                <td>
                                                    <span className="patient-name">
                                                        {patient.name}
                                                    </span>
                                                    <span className="patient-contact">
                                                        {patient.contact_number}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="patient-age">
                                                        {patient.age} / {patient.sex}
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
                                                                    patient.clientId,
                                                                )
                                                            }
                                                            disabled={
                                                                patient.sync !== "saved" ||
                                                                !!sessionInvalid
                                                            }
                                                            aria-label="Toggle presumptive status"
                                                        >
                                                            <FaTriangleExclamation aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`action-notify-btn ${patient.notified ? "sent" : ""}`}
                                                            onClick={() =>
                                                                notifyPatient(patient.clientId)
                                                            }
                                                            disabled={
                                                                patient.notified ||
                                                                patient.sync !== "saved"
                                                            }
                                                            aria-label="Notify patient"
                                                        >
                                                            <FaBell aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="action-more-btn"
                                                            onClick={() =>
                                                                removePatient(patient.clientId)
                                                            }
                                                            disabled={
                                                                patient.sync === "deleting" ||
                                                                !!sessionInvalid
                                                            }
                                                            aria-label="Remove patient"
                                                        >
                                                            {patient.sync === "deleting" ? (
                                                                <span className="row-spinner" />
                                                            ) : (
                                                                <FaXmark aria-hidden="true" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="sync-cell">
                                                    {patient.sync === "saved" &&
                                                        !patient.syncError && (
                                                            <span className="sync-indicator sync-saved">
                                                                <FaCircleCheck aria-hidden="true" />
                                                                Saved
                                                            </span>
                                                        )}
                                                    {patient.sync === "saving" && (
                                                        <span className="sync-indicator sync-saving">
                                                            <span className="row-spinner" />
                                                            Saving…
                                                        </span>
                                                    )}
                                                    {patient.sync === "deleting" && (
                                                        <span className="sync-indicator sync-deleting">
                                                            <span className="row-spinner" />
                                                            Removing…
                                                        </span>
                                                    )}
                                                    {patient.sync === "failed" && (
                                                        <div className="sync-failed-group">
                                                            <button
                                                                type="button"
                                                                className="sync-retry-btn"
                                                                onClick={() =>
                                                                    retry(patient.clientId)
                                                                }
                                                                disabled={!!sessionInvalid}
                                                            >
                                                                <FaRotateRight aria-hidden="true" />
                                                                Retry
                                                            </button>
                                                            <span className="sync-error-text">
                                                                {patient.syncError ??
                                                                    "Failed to save"}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {patient.sync === "saved" &&
                                                        patient.syncError && (
                                                            <span
                                                                className="sync-indicator sync-transient-error"
                                                                title={patient.syncError}
                                                            >
                                                                <FaTriangleExclamation aria-hidden="true" />
                                                                Failed
                                                            </span>
                                                        )}
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
