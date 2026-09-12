import { router, useForm } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import MarkChatReadOutlinedIcon from "@mui/icons-material/MarkChatReadOutlined";
import PersonAddAltRoundedIcon from "@mui/icons-material/PersonAddAltRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SmsOutlinedIcon from "@mui/icons-material/SmsOutlined";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import DashboardLayout from "@/Layouts/DashboardLayout";
import ProviderModal from "@/Components/provider/ProviderModal";
import AddressCascade from "@/Components/AddressCascade";
import { useToast } from "@/Components/ui/Toast";
import {
    MUNICIPALITY_NAMES,
    PROVINCE,
    barangaysFor,
    buildAddress,
    parseAddress,
} from "@/data/aklanAddresses";
import "../../../../css/app/12d-provider-dashboard.css";

/**
 * Active-session screening registration.
 *
 * Registrations are persisted through `provider.programs.patients.*`; the
 * table below always reflects what the server returned for this program, so a
 * reload never loses a patient. Presumptive status lives in the patient's
 * `responses` payload, which is what Patient::isPresumptive() reads.
 *
 * The Record Status column reports whether a row reached the database. A row
 * the server sent back is, by definition, `Added`; a submission still in
 * flight or rejected is held in `drafts` below and shown as `Pending` or
 * `Not Added` until it lands. That is the only patient state kept on the
 * client, and it exists precisely because the server has no row for it yet.
 */

const emptyForm = {
    name: "",
    birthday: "",
    sex: "male",
    address: "",
    contact_number: "",
};

/**
 * The program's saved location as a starting address for each new patient.
 *
 * Most people screened at a program live where it is held, so the three
 * dropdowns open on the program's Province → Municipality → Barangay and the
 * provider only changes what differs. It is a default and nothing more: every
 * level stays editable, and the address that is saved is whatever the form
 * holds at submit.
 *
 * Each level is kept only if the dataset knows it, so a program whose location
 * is free text ("City Health Center") opens on blank dropdowns rather than a
 * select pointing at a value it has no option for.
 */
function programDefaultAddress(location) {
    const parsed = parseAddress(location);
    const province = parsed.province === PROVINCE ? PROVINCE : "";
    const municipality =
        province && MUNICIPALITY_NAMES.includes(parsed.municipality)
            ? parsed.municipality
            : "";
    const barangay =
        municipality && barangaysFor(municipality).includes(parsed.barangay)
            ? parsed.barangay
            : "";

    return { province, municipality, barangay };
}

const phoneNumberRegex = /^(?:\+63|0)(?:9\d{2}|\d{2})[0-9]{6,8}$/;

/** Age from a birthday, for a draft row the server has not costed yet. */
function ageFrom(birthday) {
    if (!birthday) return "—";
    const born = new Date(birthday);
    if (Number.isNaN(born.getTime())) return "—";
    const now = new Date();
    let age = now.getFullYear() - born.getFullYear();
    const monthDelta = now.getMonth() - born.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) {
        age -= 1;
    }
    return age >= 0 ? age : "—";
}

function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportPatientsCsv(patients, programName) {
    const header = ["#", "Name", "Contact", "Age", "Sex", "Address", "Status"];
    const rows = patients.map((patient) => [
        patient.number,
        patient.name,
        patient.contact_number,
        patient.age,
        patient.sex,
        patient.address,
        patient.status,
    ]);
    const csv = [header, ...rows]
        .map((row) => row.map(csvEscape).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${programName.replace(/\s+/g, "_")}_patients.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * Record Status cell — whether this row reached the database. Distinct from
 * the Status column beside it, which carries the patient's presumptive
 * assessment.
 */
function RecordStatus({ state, onRetry }) {
    if (state === "pending") {
        return (
            <span className="record-status pending">
                <span className="record-status-spinner" aria-hidden="true" />
                Pending
            </span>
        );
    }

    if (state === "failed") {
        return (
            <div className="record-status-failed-cell">
                <span className="record-status failed">Not Added</span>
                <button
                    type="button"
                    className="record-retry-btn"
                    onClick={onRetry}
                >
                    <RefreshRoundedIcon sx={{ fontSize: 14 }} />
                    Retry
                </button>
            </div>
        );
    }

    return <span className="record-status added">Added</span>;
}

export default function Screening({ program, patients }) {
    const toast = useToast();
    const [search, setSearch] = useState("");
    const [modal, setModal] = useState(null);
    const [busyPatientId, setBusyPatientId] = useState(null);
    const [finishing, setFinishing] = useState(false);
    const [contactError, setContactError] = useState("");
    // id of the patient whose kebab menu is open — a single value, so opening
    // one menu inherently closes any other. `menuPos` is measured from the
    // button when it opens; see `.action-menu` for why the menu is fixed.
    const [openMenuId, setOpenMenuId] = useState(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    // id of the patient being edited; null means the form is in "add" mode.
    const [editingId, setEditingId] = useState(null);
    // Submissions the server has no row for yet, keyed by a client id. Each
    // keeps the values the provider typed so a failed one can be retried
    // without asking them to enter it again.
    const [drafts, setDrafts] = useState([]);
    // Where the dropdowns open — the program's own location, validated
    // against the dataset. Recomputed only if the program changes.
    const defaultAddress = useMemo(
        () => programDefaultAddress(program.location),
        [program.location],
    );
    const [address, setAddress] = useState(defaultAddress);
    const menuRef = useRef(null);
    // The kebab the open menu is anchored to, so it can be re-measured when
    // the table scrolls underneath it.
    const menuButtonRef = useRef(null);
    const draftKey = useRef(0);

    useEffect(() => {
        if (openMenuId === null) return undefined;
        const onPointerDown = (event) => {
            if (!menuRef.current?.contains(event.target)) setOpenMenuId(null);
        };
        const onKeyDown = (event) => {
            if (event.key === "Escape") setOpenMenuId(null);
        };
        // The menu is fixed, so it has to be re-anchored whenever the button
        // underneath it moves. Following the button rather than closing
        // matters because clicking a kebab near the edge of the table makes
        // the browser scroll it into view — closing on that scroll would shut
        // the menu the same moment it opened.
        const onReflow = () => positionMenu();

        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        window.addEventListener("scroll", onReflow, true);
        window.addEventListener("resize", onReflow);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("scroll", onReflow, true);
            window.removeEventListener("resize", onReflow);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openMenuId]);

    /**
     * Place the menu against its button. Flips above when there is not enough
     * room below, and closes if the button has been scrolled out of sight.
     */
    const positionMenu = () => {
        const button = menuButtonRef.current;
        if (!button?.isConnected) return;

        const rect = button.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
            setOpenMenuId(null);
            return;
        }

        const menuWidth = 140;
        const menuHeight = 88;
        const flip = window.innerHeight - rect.bottom < menuHeight + 12;

        setMenuPos({
            top: flip ? rect.top - menuHeight - 6 : rect.bottom + 6,
            left: Math.max(8, rect.right - menuWidth),
        });
    };

    const toggleMenu = (patientId, event) => {
        if (openMenuId === patientId) {
            setOpenMenuId(null);
            return;
        }

        menuButtonRef.current = event.currentTarget;
        positionMenu();
        setOpenMenuId(patientId);
    };

    // `address` on the form is the collapsed string the server stores; it
    // starts as the program default so a patient submitted without touching
    // the dropdowns still carries the address that was shown.
    const form = useForm({ ...emptyForm, address: buildAddress(defaultAddress) });

    const today = new Date().toISOString().slice(0, 10);
    const totalPatients = patients.length;
    const presumptiveCount = patients.filter(
        (patient) => patient.status === "Presumptive TB",
    ).length;

    const visiblePatients = useMemo(() => {
        const query = search.trim().toLowerCase();
        const filtered = query
            ? patients.filter((patient) =>
                patient.name.toLowerCase().includes(query),
            )
            : patients;
        // copy before sorting — with no query `filtered` is the state array
        // itself, and sorting in place would mutate it
        return [...filtered].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        );
    }, [patients, search]);

    const visibleDrafts = useMemo(() => {
        const query = search.trim().toLowerCase();
        return query
            ? drafts.filter((draft) =>
                draft.data.name.toLowerCase().includes(query),
            )
            : drafts;
    }, [drafts, search]);

    const closeModal = () => setModal(null);

    const onAddressChange = (next) => {
        setAddress(next);
        form.setData("address", buildAddress(next));
    };

    const resetForm = () => {
        form.reset();
        form.clearErrors();
        setAddress(defaultAddress);
        setContactError("");
        setEditingId(null);
    };

    /**
     * Re-send one draft. Only the record passed in is retried — the others
     * keep whatever state they are already in.
     */
    const retryDraft = (key) => {
        const draft = drafts.find((entry) => entry.key === key);
        if (!draft) return;

        setDrafts((current) =>
            current.map((entry) =>
                entry.key === key ? { ...entry, state: "pending" } : entry,
            ),
        );

        router.post(
            route("provider.programs.patients.store", program.id),
            draft.data,
            {
                preserveScroll: true,
                onSuccess: () => {
                    setDrafts((current) =>
                        current.filter((entry) => entry.key !== key),
                    );
                    toast.success("Patient added successfully");
                },
                onError: () => {
                    setDrafts((current) =>
                        current.map((entry) =>
                            entry.key === key
                                ? { ...entry, state: "failed" }
                                : entry,
                        ),
                    );
                    toast.error(
                        "Could not save the patient record. Please try again.",
                    );
                },
            },
        );
    };

    const submitForm = (event) => {
        event.preventDefault();
        if (
            form.data.contact_number &&
            !phoneNumberRegex.test(form.data.contact_number)
        ) {
            form.setError(
                "contact_number",
                "Please enter a valid phone number (e.g., 09xxxxxxxxx or +639xxxxxxxxx)",
            );
            return;
        }

        // Editing an existing row: the record is already in the database, so
        // it never becomes a draft.
        if (editingId !== null) {
            form.patch(
                route("provider.programs.patients.update", [
                    program.id,
                    editingId,
                ]),
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        resetForm();
                        toast.success("Patient updated successfully");
                    },
                    onError: () =>
                        toast.error(
                            "Could not update the patient. Please check the form and try again.",
                        ),
                },
            );
            return;
        }

        draftKey.current += 1;
        const key = `draft-${draftKey.current}`;
        const submitted = { ...form.data };

        setDrafts((current) => [
            ...current,
            { key, state: "pending", data: submitted },
        ]);

        form.post(route("provider.programs.patients.store", program.id), {
            preserveScroll: true,
            onSuccess: () => {
                setDrafts((current) =>
                    current.filter((entry) => entry.key !== key),
                );
                resetForm();
                toast.success("Patient added successfully");
            },
            // The row did not reach the database. It stays on the table as
            // "Not Added" carrying the values that were typed, so Retry can
            // send exactly those again.
            onError: () => {
                setDrafts((current) =>
                    current.map((entry) =>
                        entry.key === key ? { ...entry, state: "failed" } : entry,
                    ),
                );
                toast.error(
                    "Could not save the patient record. Please try again.",
                );
            },
        });
    };

    const startEdit = (patient) => {
        setOpenMenuId(null);
        setEditingId(patient.id);
        const parsed = parseAddress(patient.address);
        setAddress({
            province: parsed.province || PROVINCE,
            municipality: parsed.municipality,
            barangay: parsed.barangay,
        });
        form.clearErrors();
        setContactError("");
        form.setData({
            name: patient.name,
            birthday: patient.birthday ?? "",
            sex: patient.sex === "F" ? "female" : "male",
            address: patient.address ?? "",
            contact_number: patient.contact_number ?? "",
        });
    };

    const runPatientAction = (patient, request, onDone) => {
        setBusyPatientId(patient.id);
        request({
            preserveScroll: true,
            onFinish: () => setBusyPatientId(null),
            onSuccess: onDone,
        });
    };

    const confirmTogglePresumptive = (patient) => {
        const marking = patient.status !== "Presumptive TB";
        setModal({
            type: "confirm",
            title: marking
                ? "Mark as Presumptive TB?"
                : "Unmark Presumptive TB?",
            body: marking
                ? `Mark ${patient.name} as Presumptive TB?`
                : `Unmark ${patient.name} as Presumptive TB and set status back to Normal?`,
            buttons: [
                { label: "Cancel", cls: "secondary", onClick: closeModal },
                {
                    label: marking ? "Mark" : "Unmark",
                    cls: "primary",
                    loading: busyPatientId === patient.id,
                    onClick: () =>
                        runPatientAction(
                            patient,
                            (options) =>
                                router.patch(
                                    route(
                                        "provider.programs.patients.presumptive",
                                        [program.id, patient.id],
                                    ),
                                    {},
                                    options,
                                ),
                            () => {
                                closeModal();
                                toast.success(
                                    marking
                                        ? "Patient marked as Presumptive TB"
                                        : "Presumptive TB flag removed",
                                );
                            },
                        ),
                },
            ],
        });
    };

    const confirmNotify = (patient) => {
        if (patient.notified) return;
        setModal({
            type: "confirm",
            title: "Send Text Message?",
            body: `Send an automated text message notification to ${patient.name} (${patient.contact_number})?`,
            buttons: [
                { label: "Cancel", cls: "secondary", onClick: closeModal },
                {
                    label: "Send",
                    cls: "primary",
                    loading: busyPatientId === patient.id,
                    onClick: () =>
                        runPatientAction(
                            patient,
                            (options) =>
                                router.post(
                                    route(
                                        "provider.programs.patients.notify",
                                        [program.id, patient.id],
                                    ),
                                    {},
                                    options,
                                ),
                            () => {
                                closeModal();
                                toast.success("Patient notified successfully");
                            },
                        ),
                },
            ],
        });
    };

    const confirmRemove = (patient) => {
        setOpenMenuId(null);
        setModal({
            type: "confirm",
            title: "Remove Patient",
            body: `Remove ${patient.name} from the list? This cannot be undone.`,
            buttons: [
                { label: "Cancel", cls: "secondary", onClick: closeModal },
                {
                    label: "Remove",
                    cls: "primary",
                    loading: busyPatientId === patient.id,
                    onClick: () =>
                        runPatientAction(
                            patient,
                            (options) =>
                                router.delete(
                                    route(
                                        "provider.programs.patients.destroy",
                                        [program.id, patient.id],
                                    ),
                                    options,
                                ),
                            () => {
                                closeModal();
                                // Editing the row that was just removed would
                                // leave the form pointing at a gone record.
                                if (editingId === patient.id) resetForm();
                                toast.success("Patient removed successfully");
                            },
                        ),
                },
            ],
        });
    };

    /** Drop a failed draft without sending it again. */
    const discardDraft = (key) => {
        setDrafts((current) => current.filter((entry) => entry.key !== key));
        toast.info("Unsaved record discarded");
    };

    const confirmClearForm = () => {
        const hasInput =
            form.data.name.trim() ||
            form.data.birthday ||
            form.data.contact_number.trim() ||
            address.municipality ||
            address.barangay;

        if (!hasInput) {
            resetForm();
            return;
        }

        setModal({
            type: "confirm",
            title: editingId !== null ? "Discard Changes?" : "Clear Form?",
            body:
                editingId !== null
                    ? "Discard the changes to this patient? The saved record will be left as it is."
                    : "Clear the details entered on the registration form?",
            buttons: [
                { label: "Cancel", cls: "secondary", onClick: closeModal },
                {
                    label: editingId !== null ? "Discard" : "Clear",
                    cls: "primary",
                    onClick: () => {
                        resetForm();
                        closeModal();
                        toast.success(
                            editingId !== null
                                ? "Changes discarded"
                                : "Patient form cleared successfully",
                        );
                    },
                },
            ],
        });
    };

    const confirmFinish = () => {
        setModal({
            type: "confirm",
            title: "Finish Session?",
            body: "Are you sure you want to finish this screening session?",
            buttons: [
                { label: "Cancel", cls: "secondary", onClick: closeModal },
                {
                    label: "Finish Session",
                    cls: "primary",
                    loading: finishing,
                    onClick: () => {
                        setFinishing(true);
                        router.patch(
                            route("provider.programs.finish", program.id),
                            {},
                            {
                                onFinish: () => setFinishing(false),
                                onSuccess: () => {
                                    closeModal();
                                    toast.success("Session finished successfully");
                                },
                                onError: () =>
                                    toast.error(
                                        "Could not finish the session. Please try again.",
                                    ),
                            },
                        );
                    },
                },
            ],
        });
    };

    const handleExport = () => {
        if (!patients.length) {
            toast.error("There are no patients to export yet");
            return;
        }

        try {
            exportPatientsCsv(patients, program.name);
            toast.success("Export completed successfully");
        } catch {
            toast.error("Export failed. Please try again.");
        }
    };

    return (
        <DashboardLayout
            role="provider"
            title="Screening Registration"
            contentClassName="dash-content-screening"
        >
            <div className="screening-page">
                <div className="screening-header">
                    <div className="screening-header-top">
                        <button
                            type="button"
                            className="screening-back"
                            onClick={() =>
                                router.visit(route("provider.programs.index"))
                            }
                        >
                            <ChevronLeftRoundedIcon sx={{ fontSize: 20 }} />
                            <span className="screening-back-text">
                                {program.name}
                            </span>
                        </button>
                        <button
                            type="button"
                            className="finish-btn"
                            onClick={confirmFinish}
                            disabled={finishing}
                        >
                            {finishing ? (
                                <span
                                    className="btn-spinner"
                                    aria-hidden="true"
                                />
                            ) : (
                                <TaskAltRoundedIcon sx={{ fontSize: 18 }} />
                            )}
                            Finish Session
                        </button>
                    </div>
                    <div className="screening-sub">
                        <span>{program.location}</span>
                        <span className="dot-sep">•</span>
                        <span>
                            {program.iso_date_label} {program.time_label}
                        </span>
                    </div>
                    <div className="screening-status-row">
                        <div className="active-dot" />
                        <span className="active-session-label">
                            Status: Active Session
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
                        <div className="last-updated">
                            <ScheduleRoundedIcon sx={{ fontSize: 14 }} />
                            Last updated: Just now
                        </div>
                    </div>
                </div>

                <div className="screening-body">
                    <form className="register-card" onSubmit={submitForm}>
                        <div className="register-title">
                            <PersonAddAltRoundedIcon
                                sx={{ fontSize: 18, color: "#c0392b" }}
                            />
                            {editingId !== null
                                ? "Edit Patient"
                                : "Register Patient"}
                        </div>

                        <div className="field-group">
                            <label className="field-label" htmlFor="reg-name">
                                Full Name
                            </label>
                            <input
                                id="reg-name"
                                type="text"
                                className="field-input"
                                placeholder="Enter full name"
                                value={form.data.name}
                                onChange={(event) =>
                                    form.setData("name", event.target.value)
                                }
                            />
                            {form.errors.name && (
                                <p className="field-error-msg">
                                    {form.errors.name}
                                </p>
                            )}
                        </div>

                        <div className="field-row">
                            <div className="field-group">
                                <label
                                    className="field-label"
                                    htmlFor="reg-birthday"
                                >
                                    Birthday
                                </label>
                                <input
                                    id="reg-birthday"
                                    type="date"
                                    className="field-input"
                                    max={today}
                                    value={form.data.birthday}
                                    onChange={(event) =>
                                        form.setData(
                                            "birthday",
                                            event.target.value,
                                        )
                                    }
                                />
                                {form.errors.birthday && (
                                    <p className="field-error-msg">
                                        {form.errors.birthday}
                                    </p>
                                )}
                            </div>
                            <div className="field-group">
                                <label
                                    className="field-label"
                                    htmlFor="reg-sex"
                                >
                                    Sex
                                </label>
                                <select
                                    id="reg-sex"
                                    className="field-select"
                                    value={form.data.sex}
                                    onChange={(event) =>
                                        form.setData("sex", event.target.value)
                                    }
                                >
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>
                        </div>

                        {/* Same Province → Municipality → Barangay dataset the
                            ICM program form cascades through, so a patient's
                            address can never name a place the rest of the app
                            does not recognise. */}
                        <AddressCascade
                            idPrefix="reg-address"
                            value={address}
                            onChange={onAddressChange}
                            disabled={form.processing}
                            classes={{ error: "field-error-msg" }}
                        />
                        {form.errors.address && (
                            <p className="field-error-msg">
                                {form.errors.address}
                            </p>
                        )}

                        <div className="field-group">
                            <label
                                className="field-label"
                                htmlFor="reg-contact"
                            >
                                Contact Number
                            </label>
                            <input
                                id="reg-contact"
                                type="text"
                                className={`field-input ${
                                    contactError ? "field-input-error" : ""
                                }`}
                                placeholder="e.g. 09xxxxxxxxx"
                                value={form.data.contact_number}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    form.setData("contact_number", value);
                                    if (value && !phoneNumberRegex.test(value)) {
                                        setContactError(
                                            "Invalid phone number format",
                                        );
                                    } else {
                                        setContactError("");
                                    }
                                }}
                            />
                            {(form.errors.contact_number || contactError) && (
                                <p className="field-error-msg">
                                    {form.errors.contact_number || contactError}
                                </p>
                            )}
                        </div>

                        <div className="reg-btn-row">
                            <button
                                type="submit"
                                className="add-patient-btn"
                                disabled={form.processing}
                            >
                                {form.processing && (
                                    <span
                                        className="btn-spinner"
                                        aria-hidden="true"
                                    />
                                )}
                                {editingId !== null
                                    ? "Save Changes"
                                    : "Add Patient"}
                            </button>
                            <button
                                type="button"
                                className="clear-btn"
                                onClick={confirmClearForm}
                            >
                                {editingId !== null ? "Cancel" : "Clear"}
                            </button>
                        </div>
                    </form>

                    <div className="patient-list-card">
                        <div className="patient-list-top">
                            <label className="patient-search-box">
                                <SearchRoundedIcon sx={{ fontSize: 15 }} />
                                <input
                                    type="text"
                                    placeholder="Search patients..."
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                />
                            </label>
                            <button
                                type="button"
                                className="patient-export-btn"
                                onClick={handleExport}
                            >
                                <FileDownloadOutlinedIcon
                                    sx={{ fontSize: 16 }}
                                />
                                Export
                            </button>
                        </div>

                        <div className="patient-table-wrap">
                            <table className="patient-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Patient</th>
                                        <th>Details</th>
                                        <th className="col-center">Status</th>
                                        {/* Separate from Status: this one
                                            reports whether the row reached the
                                            database. */}
                                        <th className="col-center">
                                            Record Status
                                        </th>
                                        <th className="col-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visiblePatients.length === 0 &&
                                    visibleDrafts.length === 0 ? (
                                        <tr>
                                            <td colSpan="6">
                                                <div className="empty-patients">
                                                    {/* sized by `.empty-patients svg` */}
                                                    <GroupsOutlinedIcon />
                                                    <p>
                                                        {patients.length === 0
                                                            ? "No patients registered yet"
                                                            : "No patients match your search"}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        <>
                                            {visiblePatients.map((patient) => {
                                                const presumptive =
                                                    patient.status ===
                                                    "Presumptive TB";
                                                const busy =
                                                    busyPatientId === patient.id;

                                                return (
                                                    <tr key={patient.id}>
                                                        <td style={{ fontWeight: 600 }}>
                                                            {patient.number}
                                                        </td>
                                                        <td>
                                                            <div className="patient-name">
                                                                {patient.name}
                                                            </div>
                                                            <div className="patient-contact">
                                                                {
                                                                    patient.contact_number
                                                                }
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="patient-age">
                                                                {patient.age} /{" "}
                                                                {patient.sex}
                                                            </div>
                                                            <div className="patient-addr">
                                                                {patient.address}
                                                            </div>
                                                        </td>
                                                        <td className="col-center">
                                                            <span
                                                                className={
                                                                    presumptive
                                                                        ? "status-presump"
                                                                        : "status-normal"
                                                                }
                                                            >
                                                                {presumptive && (
                                                                    /* filled, not
                                                                       outline —
                                                                       tinted by
                                                                       `.status-presump` */
                                                                    <WarningRoundedIcon
                                                                        sx={{
                                                                            fontSize: 13,
                                                                        }}
                                                                    />
                                                                )}
                                                                {patient.status}
                                                            </span>
                                                        </td>
                                                        <td className="col-center">
                                                            <RecordStatus state="added" />
                                                        </td>
                                                        <td className="col-center">
                                                            <div className="action-col">
                                                                <button
                                                                    type="button"
                                                                    className={`action-warn-btn ${presumptive ? "active" : ""}`}
                                                                    onClick={() =>
                                                                        confirmTogglePresumptive(
                                                                            patient,
                                                                        )
                                                                    }
                                                                    disabled={busy}
                                                                    title="Mark Presumptive TB"
                                                                >
                                                                    {/* filled once flagged; colour comes from
                                                                        `.action-warn-btn` / `.active` */}
                                                                    {presumptive ? (
                                                                        <WarningRoundedIcon
                                                                            sx={{
                                                                                fontSize: 18,
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <WarningAmberRoundedIcon
                                                                            sx={{
                                                                                fontSize: 18,
                                                                            }}
                                                                        />
                                                                    )}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className={`action-notify-btn ${patient.notified ? "sent" : ""}`}
                                                                    onClick={() =>
                                                                        confirmNotify(
                                                                            patient,
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        patient.notified ||
                                                                        busy
                                                                    }
                                                                    title={
                                                                        patient.notified
                                                                            ? "Text Message Sent"
                                                                            : "Notify Patient via Text Message"
                                                                    }
                                                                >
                                                                    {patient.notified ? (
                                                                        <MarkChatReadOutlinedIcon
                                                                            sx={{
                                                                                fontSize: 18,
                                                                            }}
                                                                        />
                                                                    ) : (
                                                                        <SmsOutlinedIcon
                                                                            sx={{
                                                                                fontSize: 18,
                                                                            }}
                                                                        />
                                                                    )}
                                                                </button>
                                                                {/* The kebab and
                                                                    its menu share a
                                                                    positioned
                                                                    wrapper so the
                                                                    menu is anchored
                                                                    to the button. */}
                                                                <div
                                                                    className="action-menu-wrap"
                                                                    ref={
                                                                        openMenuId ===
                                                                        patient.id
                                                                            ? menuRef
                                                                            : null
                                                                    }
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        className="action-more-btn"
                                                                        onClick={(
                                                                            event,
                                                                        ) =>
                                                                            toggleMenu(
                                                                                patient.id,
                                                                                event,
                                                                            )
                                                                        }
                                                                        disabled={busy}
                                                                        aria-haspopup="menu"
                                                                        aria-expanded={
                                                                            openMenuId ===
                                                                            patient.id
                                                                        }
                                                                        aria-label={`More options for ${patient.name}`}
                                                                        title="More options"
                                                                    >
                                                                        <MoreVertRoundedIcon
                                                                            sx={{
                                                                                fontSize: 18,
                                                                            }}
                                                                        />
                                                                    </button>
                                                                    {openMenuId ===
                                                                        patient.id && (
                                                                        <div
                                                                            className="action-menu"
                                                                            role="menu"
                                                                            style={{
                                                                                top: menuPos.top,
                                                                                left: menuPos.left,
                                                                            }}
                                                                        >
                                                                            <button
                                                                                type="button"
                                                                                role="menuitem"
                                                                                className="action-menu-item"
                                                                                onClick={() =>
                                                                                    startEdit(
                                                                                        patient,
                                                                                    )
                                                                                }
                                                                            >
                                                                                <EditOutlinedIcon
                                                                                    sx={{
                                                                                        fontSize: 15,
                                                                                    }}
                                                                                />
                                                                                Edit
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                role="menuitem"
                                                                                className="action-menu-item danger"
                                                                                onClick={() =>
                                                                                    confirmRemove(
                                                                                        patient,
                                                                                    )
                                                                                }
                                                                            >
                                                                                <DeleteOutlineRoundedIcon
                                                                                    sx={{
                                                                                        fontSize: 15,
                                                                                    }}
                                                                                />
                                                                                Remove
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                            {visibleDrafts.map((draft) => (
                                                <tr
                                                    key={draft.key}
                                                    className="patient-row-draft"
                                                >
                                                    <td style={{ fontWeight: 600 }}>
                                                        —
                                                    </td>
                                                    <td>
                                                        <div className="patient-name">
                                                            {draft.data.name ||
                                                                "Unnamed patient"}
                                                        </div>
                                                        <div className="patient-contact">
                                                            {
                                                                draft.data
                                                                    .contact_number
                                                            }
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="patient-age">
                                                            {ageFrom(
                                                                draft.data
                                                                    .birthday,
                                                            )}{" "}
                                                            /{" "}
                                                            {draft.data.sex ===
                                                            "female"
                                                                ? "F"
                                                                : "M"}
                                                        </div>
                                                        <div className="patient-addr">
                                                            {draft.data.address}
                                                        </div>
                                                    </td>
                                                    <td className="col-center">
                                                        <span className="status-normal">
                                                            Normal
                                                        </span>
                                                    </td>
                                                    <td className="col-center">
                                                        <RecordStatus
                                                            state={draft.state}
                                                            onRetry={() =>
                                                                retryDraft(
                                                                    draft.key,
                                                                )
                                                            }
                                                        />
                                                    </td>
                                                    <td className="col-center">
                                                        <div className="action-col">
                                                            {draft.state ===
                                                                "failed" && (
                                                                <button
                                                                    type="button"
                                                                    className="action-more-btn"
                                                                    onClick={() =>
                                                                        discardDraft(
                                                                            draft.key,
                                                                        )
                                                                    }
                                                                    aria-label="Discard unsaved record"
                                                                    title="Discard unsaved record"
                                                                >
                                                                    <DeleteOutlineRoundedIcon
                                                                        sx={{
                                                                            fontSize: 18,
                                                                        }}
                                                                    />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <ProviderModal
                open={modal !== null}
                type={modal?.type}
                title={modal?.title}
                body={modal?.body}
                buttons={modal?.buttons ?? []}
                onDismiss={closeModal}
            />
        </DashboardLayout>
    );
}
