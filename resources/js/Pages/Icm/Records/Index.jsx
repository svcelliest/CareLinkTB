import { useState } from "react";
import { useToast } from "@/Components/ui/Toast";
import { Link, router } from "@inertiajs/react";
import { FaDownload, FaMagnifyingGlass, FaUsers, FaXmark } from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";

function formatAgeSex(age, sex) {
    const parts = [];
    if (age !== null && age !== undefined) parts.push(age);
    if (sex) parts.push(sex.charAt(0).toUpperCase() + sex.slice(1));
    return parts.length ? parts.join(" / ") : "—";
}

export default function Index({ patients, filters }) {
    const toast = useToast();
    const [search, setSearch] = useState(filters.search ?? "");

    const visit = (next = {}) => {
        const nextStatus = next.status ?? filters.status;
        const nextSearch = next.search ?? search;

        router.get(
            route("icm.records.index"),
            {
                status: nextStatus === "all" ? undefined : nextStatus,
                search: nextSearch.trim() || undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const exportHref = `${route("icm.records.export")}?${new URLSearchParams({
        ...(filters.status && filters.status !== "all" ? { status: filters.status } : {}),
        ...(filters.search ? { search: filters.search } : {}),
    }).toString()}`;

    const filtersActive = filters.search || (filters.status && filters.status !== "all");

    return (
        <DashboardLayout
            role="icm"
            title="Patient Records"
            contentClassName="dash-content-records"
        >
            <div className="records-page">
                <div className="page-toolbar">
                    <form
                        className="toolbar-search"
                        role="search"
                        onSubmit={(event) => {
                            event.preventDefault();
                            visit();
                        }}
                    >
                        <FaMagnifyingGlass aria-hidden="true" />
                        <label htmlFor="record-search" className="sr-only">
                            Search patients
                        </label>
                        <input
                            id="record-search"
                            type="search"
                            placeholder="Search patients..."
                            value={search}
                            maxLength={100}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                        {search && (
                            <button
                                type="button"
                                aria-label="Clear search"
                                onClick={() => {
                                    setSearch("");
                                    visit({ search: "" });
                                }}
                            >
                                <FaXmark />
                            </button>
                        )}
                    </form>

                    <div className="toolbar-right">
                        <select
                            value={filters.status}
                            onChange={(event) => visit({ status: event.target.value })}
                        >
                            <option value="all">All Patients</option>
                            <option value="normal">Normal</option>
                            <option value="presumptive">Presumptive TB</option>
                        </select>
                        {/* This export is served by the route as a file
                            download rather than built in the browser, so the
                            page cannot observe it finishing. It says the
                            export has started rather than claiming a success
                            it has no way to confirm. */}
                        <a
                            href={exportHref}
                            className="btn-secondary"
                            onClick={() =>
                                toast.info(
                                    "Export started — your download will begin shortly",
                                )
                            }
                        >
                            <FaDownload aria-hidden="true" />
                            Export CSV
                        </a>
                    </div>
                </div>

                {patients.data.length ? (
                    <div className="records-table-wrap">
                        <table className="records-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Name</th>
                                    <th>Age / Sex</th>
                                    <th>Address</th>
                                    <th>Contact</th>
                                    <th>Program</th>
                                    <th>Status</th>
                                    <th>Date Registered</th>
                                </tr>
                            </thead>
                            <tbody>
                                {patients.data.map((patient) => (
                                    <tr key={patient.id}>
                                        <td>{patient.number}</td>
                                        <td>
                                            <Link
                                                href={route(
                                                    "icm.records.show",
                                                    patient.id,
                                                )}
                                                className="rec-name"
                                            >
                                                {patient.name}
                                            </Link>
                                        </td>
                                        <td>
                                            {formatAgeSex(
                                                patient.age,
                                                patient.sex,
                                            )}
                                        </td>
                                        <td>{patient.address || "—"}</td>
                                        <td>{patient.contact || "—"}</td>
                                        <td>{patient.program_name}</td>
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
                                        <td>{patient.date_registered}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="records-empty">
                        <span aria-hidden="true">
                            <FaUsers />
                        </span>
                        <h3>No patient records found</h3>
                        <p>
                            {filtersActive
                                ? "Try changing your search or status filter."
                                : "Patient records added by RHU will appear here."}
                        </p>
                        {filtersActive && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearch("");
                                    router.get(route("icm.records.index"));
                                }}
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                )}

                {patients.links.length > 3 && (
                    <nav className="records-pagination" aria-label="Record pages">
                        {patients.links.map((link, index) =>
                            link.url ? (
                                <Link
                                    href={link.url}
                                    key={`${link.label}-${index}`}
                                    className={link.active ? "active" : ""}
                                    preserveScroll
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ) : (
                                <span
                                    key={`${link.label}-${index}`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ),
                        )}
                    </nav>
                )}
            </div>
        </DashboardLayout>
    );
}
