import { router } from "@inertiajs/react";
import { useState } from "react";
import { FaBoxArchive, FaDownload, FaRotateLeft } from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { useToast } from "@/Components/ui/Toast";
import {
    Button,
    Card,
    EmptyState,
    Modal,
    PageToolbar,
    SearchInput,
    cx,
} from "@/Components/ui";

const headClass =
    "border-b border-line-soft px-5 py-3 text-left text-[11px] font-bold tracking-wide text-[#bbb] uppercase";
const cellClass = "border-b border-[#f8f2f2] px-5 py-3.5 text-[13px] text-[#444]";

function IconButton({ as: Tag = "button", label, tone, children, ...rest }) {
    return (
        <Tag
            title={label}
            aria-label={label}
            className={cx(
                "flex size-8 items-center justify-center rounded-lg border-[1.5px] text-sm transition-colors",
                tone === "restore"
                    ? "border-ok/40 text-ok hover:bg-ok-soft"
                    : "border-line text-[#555] hover:border-brand hover:text-brand",
            )}
            {...rest}
        >
            {children}
        </Tag>
    );
}

/**
 * Archiving is `programs.archived_at`, not a fourth Program.status value —
 * restoring just clears that timestamp (`IcmArchiveController::restore()`)
 * and the program returns to the completed list. Filtering/search happen
 * server-side (the controller already validates `location_id`/`search`
 * query params), so this page re-requests rather than filtering a full
 * client-side copy.
 */
export default function Index({ programs, locations, filters }) {
    const toast = useToast();
    const [search, setSearch] = useState(filters.search ?? "");
    const [restoring, setRestoring] = useState(null);

    const applyFilters = (next) => {
        router.get(
            route("icm.archives.index"),
            {
                search: next.search ?? filters.search,
                location_id: next.location_id ?? filters.location_id,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const restoreProgram = () => {
        const program = restoring;
        if (!program) return;

        router.patch(
            route("icm.archives.restore", program.id),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setRestoring(null);
                    toast.success("Program restored successfully");
                },
                onError: () => {
                    setRestoring(null);
                    toast.error("Could not restore the program. Please try again.");
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
                            onChange={(value) => {
                                setSearch(value);
                                applyFilters({ search: value });
                            }}
                            placeholder="Search archives..."
                            label="Search archives"
                        />

                        <label className="flex items-center gap-2 rounded-lg border-[1.5px] border-line bg-white px-3.5 py-[9px] text-[13.5px] font-semibold text-[#555] focus-within:border-brand">
                            <span className="sr-only">Filter by location</span>
                            <select
                                value={filters.location_id ?? "all"}
                                onChange={(event) =>
                                    applyFilters({
                                        location_id:
                                            event.target.value === "all"
                                                ? null
                                                : event.target.value,
                                    })
                                }
                                className="bg-transparent outline-none"
                            >
                                <option value="all">All Locations</option>
                                {locations.map((location) => (
                                    <option key={location.id} value={location.id}>
                                        {location.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </PageToolbar>

                    {programs.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className={headClass}>Activity</th>
                                        <th className={cx(headClass, "w-40")}>Location</th>
                                        <th className={cx(headClass, "w-40")}>Archived Date</th>
                                        <th className={cx(headClass, "w-32 text-center")}>
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {programs.map((program) => (
                                        <tr key={program.id} className="hover:bg-[#fdf8f8]">
                                            <td className={cx(cellClass, "font-semibold text-ink")}>
                                                {program.name}
                                            </td>
                                            <td className={cellClass}>{program.location ?? "—"}</td>
                                            <td className={cellClass}>{program.archived_at}</td>
                                            <td className={cx(cellClass, "w-32 text-center")}>
                                                <div className="flex items-center justify-center gap-2">
                                                    <IconButton
                                                        as="a"
                                                        href={route("icm.archives.export", program.id)}
                                                        label={`Export ${program.name}`}
                                                    >
                                                        <FaDownload aria-hidden="true" />
                                                    </IconButton>
                                                    <IconButton
                                                        label={`Restore ${program.name}`}
                                                        tone="restore"
                                                        onClick={() => setRestoring(program)}
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
                                search || filters.location_id
                                    ? "Try another search term or location."
                                    : "Programs you archive will be listed here."
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
                <h2 id="archive-restore-title" className="mb-1 text-[15.5px] font-bold text-ink">
                    Restore program?
                </h2>
                <p id="archive-restore-description" className="mb-5 text-[13px] text-muted">
                    “{restoring?.name}” will move back to your completed programs.
                </p>
                <div className="flex justify-end gap-2.5">
                    <Button variant="secondary" onClick={() => setRestoring(null)}>
                        Cancel
                    </Button>
                    <Button onClick={restoreProgram}>Restore</Button>
                </div>
            </Modal>
        </DashboardLayout>
    );
}
