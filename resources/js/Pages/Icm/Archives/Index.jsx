// Archives is local-state only — the current schema has no "archived"
// program state (Program.status is only upcoming|active|completed), so
// there's no real event that produces an archived program to list here.
// Seeded with a placeholder row purely to keep the search/filter/export/
// restore interactions demonstrable. Real persistence is pending a schema
// decision (a new status value, or a separate archived-programs table).
import { useMemo, useState } from "react";
import { FaDownload, FaMagnifyingGlass, FaRotateLeft } from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";

const SAMPLE_ARCHIVES = [
    {
        id: "sample-1",
        name: "ACF TB Program – Kalibo (sample)",
        date: "Jan 1, 2024",
        location: "Andagao, Kalibo, Aklan",
    },
];

function exportArchiveRecord(archive) {
    const text = `Activity: ${archive.name}\nDate: ${archive.date}\nLocation: ${archive.location}\n`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${archive.name.replace(/\s+/g, "_")}_archive.txt`;
    link.click();
    URL.revokeObjectURL(url);
}

function locationOf(archive) {
    const parts = archive.location.split(",");
    return parts.length > 1 ? parts[1].trim() : archive.location.trim();
}

export default function Index() {
    const [archives, setArchives] = useState(SAMPLE_ARCHIVES);
    const [search, setSearch] = useState("");
    const [locationFilter, setLocationFilter] = useState("all");

    const locationOptions = useMemo(() => {
        const unique = new Set(archives.map(locationOf));
        return Array.from(unique);
    }, [archives]);

    const visible = useMemo(() => {
        const query = search.trim().toLowerCase();
        return archives.filter((archive) => {
            const matchesSearch =
                !query || archive.name.toLowerCase().includes(query);
            const matchesLocation =
                locationFilter === "all" || locationOf(archive) === locationFilter;
            return matchesSearch && matchesLocation;
        });
    }, [archives, search, locationFilter]);

    const restoreArchive = (archive) => {
        if (
            !window.confirm(
                `Restore "${archive.name}"? It will move back to your completed programs.`,
            )
        ) {
            return;
        }
        setArchives((prev) => prev.filter((item) => item.id !== archive.id));
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
                        {locationOptions.map((location) => (
                            <option key={location} value={location}>
                                {location}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="records-table-wrap">
                    <table className="records-table">
                        <thead>
                            <tr>
                                <th>Activity</th>
                                <th>Date</th>
                                <th>Location</th>
                                <th style={{ textAlign: "center" }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.length > 0 ? (
                                visible.map((archive) => (
                                    <tr key={archive.id}>
                                        <td>{archive.name}</td>
                                        <td>{archive.date}</td>
                                        <td>{archive.location}</td>
                                        <td>
                                            <div className="action-col">
                                                <button
                                                    type="button"
                                                    className="icon-export-btn"
                                                    title="Export"
                                                    onClick={() =>
                                                        exportArchiveRecord(archive)
                                                    }
                                                >
                                                    <FaDownload aria-hidden="true" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="icon-restore-btn"
                                                    title="Restore"
                                                    onClick={() =>
                                                        restoreArchive(archive)
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
