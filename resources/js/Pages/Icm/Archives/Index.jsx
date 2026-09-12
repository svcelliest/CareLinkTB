// The programs the coordinator has archived from the program list. Archiving
// is recorded by `programs.archived_at`, not by a fourth status, so a restore
// simply clears that timestamp and the program returns to the list completed.
import { router } from "@inertiajs/react";
import { useToast } from "@/Components/ui/Toast";
import { useMemo, useState } from "react";
import { FaBoxArchive, FaDownload, FaRotateLeft } from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    Button,
    Card,
    EmptyState,
    Modal,
    PageToolbar,
    SearchInput,
    cx,
} from "@/Components/ui";

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

const headClass =
    "border-b border-line-soft px-5 py-3 text-left text-[11px] font-bold tracking-wide text-[#bbb] uppercase";
const cellClass = "border-b border-[#f8f2f2] px-5 py-3.5 text-[13px] text-[#444]";

function IconButton({ label, tone, onClick, children }) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            onClick={onClick}
            className={cx(
                "flex size-8 items-center justify-center rounded-lg border-[1.5px] text-sm transition-colors",
                tone === "restore"
                    ? "border-ok/40 text-ok hover:bg-ok-soft"
                    : "border-line text-[#555] hover:border-brand hover:text-brand",
            )}
        >
            {children}
        </button>
    );
}

export default function Index({ archives }) {
    const toast = useToast();

    /** Same file the button always wrote — the toast only reports the outcome. */
    const exportArchive = (archive) => {
        try {
            exportArchiveRecord(archive);
            toast.success("Export completed successfully");
        } catch {
            toast.error("Export failed. Please try again.");
        }
    };

    const [search, setSearch] = useState("");
    const [locationFilter, setLocationFilter] = useState("all");

    const locationOptions = useMemo(
        () => Array.from(new Set(archives.map(locationOf))),
        [archives],
    );

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

    // The portal asks in its own modal rather than the browser's confirm(),
    // which cannot be themed and reads as a page error.
    const [restoring, setRestoring] = useState(null);

    const restoreArchive = () => {
        const archive = restoring;
        if (!archive) return;

        router.patch(
            route("icm.programs.restore", archive.id),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setRestoring(null);
                    toast.success("Program restored successfully");
                },
                onError: () => {
                    setRestoring(null);
                    toast.error(
                        "Could not restore the program. Please try again.",
                    );
                },
            },
        );
    };

    return (
        <DashboardLayout
            role="icm"
            title="Archives"
            contentClassName="dash-content-accounts"
        >
            <section className="mx-auto w-full max-w-[1240px] font-ui">
                <Card className="overflow-hidden">
                    <PageToolbar>
                        <SearchInput
                            id="archive-search"
                            value={search}
                            onChange={setSearch}
                            placeholder="Search archives..."
                            label="Search archives"
                        />

                        <label className="flex items-center gap-2 rounded-lg border-[1.5px] border-line bg-white px-3.5 py-[9px] text-[13.5px] font-semibold text-[#555] focus-within:border-brand">
                            <span className="sr-only">Filter by location</span>
                            <select
                                value={locationFilter}
                                onChange={(event) =>
                                    setLocationFilter(event.target.value)
                                }
                                className="bg-transparent outline-none"
                            >
                                <option value="all">All Locations</option>
                                {locationOptions.map((location) => (
                                    <option key={location} value={location}>
                                        {location}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </PageToolbar>

                    {visible.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className={headClass}>Activity</th>
                                        <th className={cx(headClass, "w-40")}>
                                            Date
                                        </th>
                                        <th className={cx(headClass, "w-72")}>
                                            Location
                                        </th>
                                        {/* Fixed width and centred so the buttons
                                            below sit directly under the label. */}
                                        <th
                                            className={cx(
                                                headClass,
                                                "w-32 text-center",
                                            )}
                                        >
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map((archive) => (
                                        <tr
                                            key={archive.id}
                                            className="hover:bg-[#fdf8f8]"
                                        >
                                            <td
                                                className={cx(
                                                    cellClass,
                                                    "font-semibold text-ink",
                                                )}
                                            >
                                                {archive.name}
                                            </td>
                                            <td className={cellClass}>
                                                {archive.date}
                                            </td>
                                            <td className={cellClass}>
                                                {archive.location}
                                            </td>
                                            <td className={cx(cellClass, "w-32")}>
                                                <div className="flex items-center justify-center gap-2">
                                                    <IconButton
                                                        label={`Export ${archive.name}`}
                                                        onClick={() =>
                                                            exportArchive(
                                                                archive,
                                                            )
                                                        }
                                                    >
                                                        <FaDownload aria-hidden="true" />
                                                    </IconButton>
                                                    <IconButton
                                                        label={`Restore ${archive.name}`}
                                                        tone="restore"
                                                        onClick={() =>
                                                            setRestoring(archive)
                                                        }
                                                    >
                                                        <FaRotateLeft aria-hidden="true" />
                                                    </IconButton>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState
                            icon={<FaBoxArchive />}
                            title="No archived programs found"
                            description={
                                archives.length === 0
                                    ? "Programs you archive will be listed here."
                                    : "Try another search term or location."
                            }
                        />
                    )}
                </Card>
            </section>

            <Modal
                open={restoring !== null}
                onClose={() => setRestoring(null)}
                labelledBy="archive-restore-title"
                describedBy="archive-restore-description"
            >
                <h2
                    id="archive-restore-title"
                    className="mb-1 text-[15.5px] font-bold text-ink"
                >
                    Restore program?
                </h2>
                <p
                    id="archive-restore-description"
                    className="mb-5 text-[13px] text-muted"
                >
                    “{restoring?.name}” will move back to your completed
                    programs.
                </p>
                <div className="flex justify-end gap-2.5">
                    <Button
                        variant="secondary"
                        onClick={() => setRestoring(null)}
                    >
                        Cancel
                    </Button>
                    <Button onClick={restoreArchive}>Restore</Button>
                </div>
            </Modal>
        </DashboardLayout>
    );
}
