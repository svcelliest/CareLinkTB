import { Link, router, useForm, usePage } from "@inertiajs/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    FaBoxArchive,
    FaCalendarDays,
    FaChevronRight,
    FaCircleCheck,
    FaLocationDot,
    FaMagnifyingGlass,
    FaPlus,
    FaUser,
    FaXmark,
} from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";

const filters = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "upcoming", label: "Upcoming" },
    { value: "completed", label: "Completed" },
];

const statusLabels = {
    active: "Active",
    upcoming: "Upcoming",
    completed: "Completed",
};

export default function Index({ programs, locations }) {
    const { flash } = usePage().props;
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");
    const [modalOpen, setModalOpen] = useState(false);
    const nameInput = useRef(null);
    const {
        data,
        setData,
        post,
        processing,
        errors,
        clearErrors,
        reset,
        transform,
    } = useForm({
        name: "",
        location_id: "",
        date: "",
        time: "",
    });

    const filteredPrograms = useMemo(() => {
        const query = search.trim().toLowerCase();

        return programs.filter((program) => {
            const matchesStatus = status === "all" || program.status === status;
            const matchesSearch =
                !query ||
                program.name.toLowerCase().includes(query) ||
                program.location.toLowerCase().includes(query);

            return matchesStatus && matchesSearch;
        });
    }, [programs, search, status]);

    useEffect(() => {
        if (!modalOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key === "Escape" && !processing) {
                clearErrors();
                setModalOpen(false);
            }
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);
        window.setTimeout(() => nameInput.current?.focus(), 0);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [clearErrors, modalOpen, processing]);

    const openModal = () => {
        clearErrors();
        setModalOpen(true);
    };

    const closeModal = () => {
        if (processing) return;
        clearErrors();
        setModalOpen(false);
    };

    const submit = (event) => {
        event.preventDefault();

        transform(({ name, location_id, date, time }) => {
            const localDate = new Date(`${date}T${time || "00:00"}`);
            return {
                name,
                location_id,
                scheduled_at: Number.isNaN(localDate.getTime())
                    ? `${date}T${time || "00:00"}`
                    : localDate.toISOString(),
            };
        });

        post(route("icm.programs.store"), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setModalOpen(false);
            },
        });
    };

    const formatSchedule = (isoString) => {
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return "";
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    };

    const archiveProgram = (event, program) => {
        event.preventDefault();
        event.stopPropagation();

        if (
            !window.confirm(
                `Archive "${program.name}"? It will move to the Archives page.`,
            )
        ) {
            return;
        }

        router.patch(
            route("icm.programs.archive", program.id),
            {},
            { preserveScroll: true },
        );
    };

    return (
        <DashboardLayout
            role="icm"
            title="Programs"
            contentClassName="dash-content-programs"
        >
            <section className="programs-page" aria-labelledby="programs-title">
                <h2 id="programs-title" className="sr-only">
                    Programs
                </h2>

                {flash?.success && (
                    <div className="programs-toast" role="status">
                        <FaCircleCheck />
                        <span>{flash.success}</span>
                    </div>
                )}

                <div className="programs-toolbar">
                    <label className="programs-search">
                        <FaMagnifyingGlass aria-hidden="true" />
                        <span className="sr-only">Search programs</span>
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search programs..."
                        />
                    </label>

                    <button
                        type="button"
                        className="programs-create-button"
                        onClick={openModal}
                    >
                        <FaPlus aria-hidden="true" />
                        Create Program
                    </button>
                </div>

                <div
                    className="programs-tabs"
                    role="tablist"
                    aria-label="Program status"
                >
                    {filters.map((filter) => (
                        <button
                            key={filter.value}
                            type="button"
                            role="tab"
                            aria-selected={status === filter.value}
                            className={`programs-tab ${status === filter.value ? "active" : ""}`}
                            onClick={() => setStatus(filter.value)}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                <div className="programs-list" aria-live="polite">
                    {filteredPrograms.length > 0 ? (
                        filteredPrograms.map((program) => (
                            <div
                                key={program.id}
                                className={`programs-card ${program.status === "active" ? "is-active" : ""}`}
                            >
                                <Link
                                    href={route(
                                        "icm.programs.show",
                                        program.id,
                                    )}
                                    className="programs-card-link"
                                >
                                    <div className="programs-card-main">
                                        <div className="programs-card-copy">
                                            <div className="programs-card-title-row">
                                                <h3>{program.name}</h3>
                                                <span
                                                    className={`programs-status programs-status-${program.status}`}
                                                >
                                                    {statusLabels[
                                                        program.status
                                                    ] ?? program.status}
                                                </span>
                                            </div>
                                            <p className="programs-location">
                                                <FaLocationDot aria-hidden="true" />
                                                <span>{program.location}</span>
                                            </p>
                                        </div>

                                        <div className="programs-card-meta">
                                            <span>
                                                <FaCalendarDays aria-hidden="true" />
                                                {formatSchedule(
                                                    program.scheduled_at,
                                                )}
                                            </span>
                                            <span>
                                                <FaUser aria-hidden="true" />
                                                {program.patients_count}{" "}
                                                {program.patients_count === 1
                                                    ? "patient"
                                                    : "patients"}
                                            </span>
                                        </div>

                                        <FaChevronRight
                                            className="programs-card-arrow"
                                            aria-hidden="true"
                                        />
                                    </div>
                                </Link>

                                {program.status === "completed" && (
                                    <div className="programs-card-footer">
                                        <button
                                            type="button"
                                            className="programs-archive-button"
                                            onClick={(event) =>
                                                archiveProgram(event, program)
                                            }
                                        >
                                            <FaBoxArchive aria-hidden="true" />
                                            Archive
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="programs-empty-state">
                            <div className="programs-empty-icon">
                                <FaCalendarDays aria-hidden="true" />
                            </div>
                            <h3>No programs found</h3>
                            <p>
                                {programs.length === 0
                                    ? "Create your first program to begin scheduling community screening activities."
                                    : "Try another search term or program status."}
                            </p>
                            {programs.length === 0 && (
                                <button type="button" onClick={openModal}>
                                    <FaPlus aria-hidden="true" />
                                    Create Program
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {modalOpen && (
                <div
                    className="programs-modal-overlay"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) closeModal();
                    }}
                >
                    <div
                        className="programs-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="create-program-title"
                        aria-describedby="create-program-description"
                    >
                        <button
                            type="button"
                            className="programs-modal-close"
                            onClick={closeModal}
                            aria-label="Close create program dialog"
                            disabled={processing}
                        >
                            <FaXmark />
                        </button>

                        <h2 id="create-program-title">Create New Program</h2>
                        <p id="create-program-description">
                            This program will be available for future provider
                            assignment and monitoring.
                        </p>

                        <form onSubmit={submit} noValidate>
                            <div className="programs-field">
                                <label htmlFor="program-name">
                                    Program Name
                                </label>
                                <input
                                    id="program-name"
                                    ref={nameInput}
                                    type="text"
                                    value={data.name}
                                    onChange={(event) =>
                                        setData("name", event.target.value)
                                    }
                                    placeholder="e.g. ACF TB Program – Kalibo"
                                    aria-invalid={Boolean(errors.name)}
                                    aria-describedby={
                                        errors.name
                                            ? "program-name-error"
                                            : undefined
                                    }
                                    autoComplete="off"
                                />
                                {errors.name && (
                                    <small id="program-name-error">
                                        {errors.name}
                                    </small>
                                )}
                            </div>

                            <div className="programs-field">
                                <label htmlFor="program-location">
                                    Location
                                </label>
                                <select
                                    id="program-location"
                                    value={data.location_id}
                                    onChange={(event) =>
                                        setData(
                                            "location_id",
                                            event.target.value,
                                        )
                                    }
                                    aria-invalid={Boolean(errors.location_id)}
                                    aria-describedby={
                                        errors.location_id
                                            ? "program-location-error"
                                            : undefined
                                    }
                                >
                                    <option value="">
                                        Select a municipality
                                    </option>
                                    {locations.map((location) => (
                                        <option
                                            key={location.id}
                                            value={location.id}
                                        >
                                            {location.name}
                                        </option>
                                    ))}
                                </select>
                                {errors.location_id && (
                                    <small id="program-location-error">
                                        {errors.location_id}
                                    </small>
                                )}
                            </div>

                            <div className="programs-field-row">
                                <div className="programs-field">
                                    <label htmlFor="program-date">Date</label>
                                    <input
                                        id="program-date"
                                        type="date"
                                        value={data.date}
                                        onChange={(event) =>
                                            setData("date", event.target.value)
                                        }
                                        aria-invalid={Boolean(errors.date)}
                                        aria-describedby={
                                            errors.date
                                                ? "program-date-error"
                                                : undefined
                                        }
                                    />
                                    {errors.date && (
                                        <small id="program-date-error">
                                            {errors.date}
                                        </small>
                                    )}
                                </div>

                                <div className="programs-field">
                                    <label htmlFor="program-time">Time</label>
                                    <input
                                        id="program-time"
                                        type="time"
                                        value={data.time}
                                        onChange={(event) =>
                                            setData("time", event.target.value)
                                        }
                                        aria-invalid={Boolean(errors.time)}
                                        aria-describedby={
                                            errors.time
                                                ? "program-time-error"
                                                : undefined
                                        }
                                    />
                                    {errors.time && (
                                        <small id="program-time-error">
                                            {errors.time}
                                        </small>
                                    )}
                                </div>
                            </div>
                            {errors.scheduled_at && (
                                <small id="program-schedule-error">
                                    {errors.scheduled_at}
                                </small>
                            )}

                            <div className="programs-modal-actions">
                                <button
                                    type="button"
                                    className="programs-cancel-button"
                                    onClick={closeModal}
                                    disabled={processing}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="programs-submit-button"
                                    disabled={processing}
                                >
                                    {processing
                                        ? "Creating..."
                                        : "Create Program"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
