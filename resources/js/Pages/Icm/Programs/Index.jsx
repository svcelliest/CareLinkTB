import { Link, router } from "@inertiajs/react";
import { useMemo, useState } from "react";
import {
    FaBoxArchive,
    FaCalendarDays,
    FaChevronRight,
    FaLocationDot,
    FaPlus,
} from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import ArchiveProgramDialog from "@/Components/program/ArchiveProgramDialog";
import { useToast } from "@/Components/ui/Toast";
import ProgramFormDialog from "@/Components/program/ProgramFormDialog";
import {
    Button,
    Card,
    EmptyState,
    PageToolbar,
    SearchInput,
    StatusPill,
    cx,
} from "@/Components/ui";

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

export default function Index({ programs, scheduleWindow }) {
    const toast = useToast();
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");
    // This page only creates. Editing an existing program lives on the program
    // page, behind View details.
    const [createOpen, setCreateOpen] = useState(false);
    const [archiveTarget, setArchiveTarget] = useState(null);
    const [archiving, setArchiving] = useState(false);

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

    const openCreate = () => setCreateOpen(true);

    // Archiving files a finished program away rather than deleting it, so it
    // only moves to the Archives page, where it can be restored. The dialog
    // handles both answers: confirm for a completed program, and the reason it
    // cannot be archived yet for one that is still upcoming or active.
    const confirmArchive = () => {
        router.patch(
            route("icm.programs.archive", archiveTarget.id),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setArchiving(true),
                onSuccess: () => toast.success("Program archived successfully"),
                onError: () =>
                    toast.error(
                        "Could not archive the program. Please try again.",
                    ),
                onFinish: () => {
                    setArchiving(false);
                    setArchiveTarget(null);
                },
            },
        );
    };

    return (
        <DashboardLayout
            role="icm"
            title="Programs"
            contentClassName="dash-content-programs"
        >
            <section className="flex h-full flex-col bg-shell font-ui">
                <h2 className="sr-only">Programs</h2>

                <PageToolbar>
                    <SearchInput
                        id="program-search"
                        value={search}
                        onChange={setSearch}
                        placeholder="Search programs..."
                        label="Search programs"
                    />
                    <div className="ml-auto flex items-center gap-2.5">
                        <Button onClick={openCreate}>
                            <FaPlus className="size-4" aria-hidden="true" />
                            Create Program
                        </Button>
                    </div>
                </PageToolbar>

                <div
                    className="flex shrink-0 gap-1 border-b border-line bg-white px-6 pt-3"
                    role="tablist"
                    aria-label="Program status"
                >
                    {filters.map((filter) => (
                        <button
                            key={filter.value}
                            type="button"
                            role="tab"
                            aria-selected={status === filter.value}
                            onClick={() => setStatus(filter.value)}
                            className={cx(
                                "rounded-t-lg border-[1.5px] border-b-0 px-[18px] py-2.5 text-[13px] font-semibold transition-colors",
                                status === filter.value
                                    ? "border-line bg-white text-brand"
                                    : "border-transparent bg-shell text-muted hover:text-ink",
                            )}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                {/* The inline success strip that used to sit here is gone:
                    creating and archiving both raise the shared toast now, and
                    showing the same outcome twice read as two separate events. */}

                <div
                    className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-5"
                    aria-live="polite"
                >
                    {filteredPrograms.length > 0 ? (
                        filteredPrograms.map((program) => (
                            <Card
                                key={program.id}
                                className={cx(
                                    "border-[1.5px] transition-shadow hover:shadow-[0_4px_18px_rgba(0,0,0,0.1)]",
                                    program.status === "active"
                                        ? "border-[#fde8e8]"
                                        : "border-transparent hover:border-line-soft",
                                )}
                            >
                                <div className="flex flex-wrap items-center gap-4 px-[22px] py-[18px]">
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                                            <Link
                                                href={route(
                                                    "icm.programs.show",
                                                    program.id,
                                                )}
                                                className={cx(
                                                    "text-sm font-bold hover:underline",
                                                    program.status === "active"
                                                        ? "text-brand"
                                                        : "text-ink",
                                                )}
                                            >
                                                {program.name}
                                            </Link>
                                            <StatusPill tone={program.status}>
                                                {statusLabels[program.status] ??
                                                    program.status}
                                            </StatusPill>
                                        </div>
                                        <p className="flex items-center gap-1.5 text-xs text-muted">
                                            <FaLocationDot
                                                className="size-3"
                                                aria-hidden="true"
                                            />
                                            <span>{program.location}</span>
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2">
                                        <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
                                            <FaCalendarDays
                                                className="size-3.5"
                                                aria-hidden="true"
                                            />
                                            {program.date_label}{" "}
                                            {program.time_label}
                                        </span>

                                        {/* Offered on every row; a program that
                                            is not completed opens the dialog
                                            explaining why instead of archiving. */}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setArchiveTarget(program)
                                            }
                                            aria-disabled={
                                                program.status !== "completed"
                                            }
                                            aria-label={`Archive ${program.name}`}
                                            className={cx(
                                                "flex items-center gap-1.5 text-xs font-semibold transition-colors",
                                                program.status === "completed"
                                                    ? "text-muted hover:text-brand"
                                                    : "cursor-not-allowed text-[#c9c9c9]",
                                            )}
                                        >
                                            <FaBoxArchive
                                                className="size-3"
                                                aria-hidden="true"
                                            />
                                            Archive
                                        </button>

                                        <Link
                                            href={route(
                                                "icm.programs.show",
                                                program.id,
                                            )}
                                            aria-label={`View details for ${program.name}`}
                                            className="flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-strong"
                                        >
                                            View details
                                            <FaChevronRight className="size-3" aria-hidden="true" />
                                        </Link>
                                    </div>
                                </div>
                            </Card>
                        ))
                    ) : (
                        <Card>
                            <EmptyState
                                icon={<FaCalendarDays />}
                                title="No programs found"
                                description={
                                    programs.length === 0
                                        ? "Create your first program to begin scheduling community screening activities."
                                        : "Try another search term or program status."
                                }
                            >
                                {programs.length === 0 && (
                                    <Button className="mt-2" onClick={openCreate}>
                                        <FaPlus className="size-4" aria-hidden="true" />
                                        Create Program
                                    </Button>
                                )}
                            </EmptyState>
                        </Card>
                    )}
                </div>
            </section>

            <ProgramFormDialog
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                scheduleWindow={scheduleWindow}
            />

            <ArchiveProgramDialog
                program={archiveTarget}
                processing={archiving}
                onConfirm={confirmArchive}
                onClose={() => setArchiveTarget(null)}
            />
        </DashboardLayout>
    );
}
