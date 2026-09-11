import { useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { FaDownload, FaMagnifyingGlass, FaRotateLeft } from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";

export default function Index({ programs, locations, filters }) {
    const [search, setSearch] = useState(filters.search ?? "");
    const [locationFilter, setLocationFilter] = useState(
        filters.location_id ? String(filters.location_id) : "all",
    );

    const visible = useMemo(() => {
        const query = search.trim().toLowerCase();

        return programs.filter((program) => {
            const matchesSearch =
                !query || program.name.toLowerCase().includes(query);
            const matchesLocation =
                locationFilter === "all" ||
                String(program.location_id) === locationFilter;

            return matchesSearch && matchesLocation;
        });
    }, [programs, search, locationFilter]);

    const restoreProgram = (program) => {
        if (
            !window.confirm(
                `Restore "${program.name}"? It will move back to your completed programs.`,
            )
        ) {
            return;
        }

        router.patch(
            route("icm.archives.restore", program.id),
            {},
            { preserveScroll: true },
        );
    };

    return (
        <DashboardLayout
            role="icm"
            title="Archives"
            contentClassName="dash-content-archives"
        >
            <div className="forms-list-page">
                <div className="page-toolbar">
                    <div className="toolbar-search">
                        <FaMagnifyingGlass aria-hidden="true" />
                        <input
                            type="text"
                            placeholder="Search archives..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                    <select
                        value={locationFilter}
                        onChange={(event) => setLocationFilter(event.target.value)}
                    >
                        <option value="all">All Locations</option>
                        {locations.map((location) => (
                            <option key={location.id} value={String(location.id)}>
                                {location.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="records-table-wrap">
                    <table className="records-table">
                        <thead>
                            <tr>
                                <th>Activity</th>
                                <th>Archived On</th>
                                <th>Location</th>
                                <th style={{ textAlign: "center" }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.length > 0 ? (
                                visible.map((program) => (
                                    <tr key={program.id}>
                                        <td>{program.name}</td>
                                        <td>{program.archived_at}</td>
                                        <td>{program.location}</td>
                                        <td>
                                            <div className="action-col">
                                                <a
                                                    className="icon-export-btn"
                                                    title="Export"
                                                    href={route(
                                                        "icm.archives.export",
                                                        program.id,
                                                    )}
                                                >
                                                    <FaDownload aria-hidden="true" />
                                                </a>
                                                <button
                                                    type="button"
                                                    className="icon-restore-btn"
                                                    title="Restore"
                                                    onClick={() =>
                                                        restoreProgram(program)
                                                    }
                                                >
                                                    <FaRotateLeft aria-hidden="true" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td className="table-empty" colSpan="4">
                                        No archived programs found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    );
}
