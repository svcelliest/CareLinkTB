import { Link, router } from "@inertiajs/react";
import { useState } from "react";
import {
    FaClipboardCheck,
    FaFilter,
    FaHouseChimneyMedical,
    FaUsers,
} from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    Button,
    Card,
    EmptyState,
    PageToolbar,
    SearchInput,
    StatusPill,
    cx,
} from "@/Components/ui";

/**
 * ICM Contact Tracing — every patient currently under treatment.
 *
 * "Under treatment" is the existing open-case scope (a TreatmentCase with no
 * outcome), so completed and closed cases drop off this list on their own. The
 * rows are the real treatment register; nothing here is sampled.
 *
 * The toolbar, table, empty state and pager are the ICM Accounts patterns,
 * reused rather than restyled.
 */

const tracingFilters = [
    { value: "all", label: "All contact tracing" },
    { value: "filed", label: "Contact tracing filed" },
    { value: "pending", label: "Awaiting contact tracing" },
];

export default function Index({ cases, filters, stats, municipalities }) {
    const [search, setSearch] = useState(filters.search ?? "");

    const visit = (next = {}) => {
        const nextSearch = next.search ?? search;
        const nextMunicipality = next.municipality ?? filters.municipality;
        const nextTracing = next.tracing ?? filters.tracing;

        router.get(
            route("icm.contact-tracing.index"),
            {
                search: nextSearch.trim() || undefined,
                municipality: nextMunicipality === "all" ? undefined : nextMunicipality,
                tracing: nextTracing === "all" ? undefined : nextTracing,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const summary = [
        {
            key: "under_treatment",
            label: "Under treatment",
            value: stats.under_treatment,
            icon: <FaUsers />,
            tone: "bg-info-soft text-info",
        },
        {
            key: "traced",
            label: "Contact tracing filed",
            value: stats.traced,
            icon: <FaClipboardCheck />,
            tone: "bg-ok-soft text-ok",
        },
        {
            key: "pending",
            label: "Awaiting contact tracing",
            value: stats.pending,
            icon: <FaHouseChimneyMedical />,
            tone: "bg-brand-soft text-brand",
        },
    ];

    const filtersApplied =
        filters.search !== "" ||
        filters.municipality !== "all" ||
        filters.tracing !== "all";

    return (
        <DashboardLayout
            role="icm"
            title="Contact Tracing"
            contentClassName="dash-content-panel"
        >
            <section className="mx-auto w-full max-w-[1240px] font-ui">
                <div
                    className="mb-[18px] grid gap-4 sm:grid-cols-3"
                    aria-label="Contact tracing summary"
                >
                    {summary.map((card) => (
                        <Card key={card.key} className="flex items-center gap-4 px-6 py-5">
                            <span
                                className={cx(
                                    "flex size-12 shrink-0 items-center justify-center rounded-xl text-xl",
                                    card.tone,
                                )}
                                aria-hidden="true"
                            >
                                {card.icon}
                            </span>
                            <div className="min-w-0">
                                <div className="text-2xl font-bold text-ink">{card.value}</div>
                                <div className="text-[12.5px] text-muted">{card.label}</div>
                            </div>
                        </Card>
                    ))}
                </div>

                <Card className="overflow-hidden">
                    <PageToolbar>
                        <SearchInput
                            id="tracing-search"
                            value={search}
                            onChange={(value) => {
                                setSearch(value);
                                if (value === "") visit({ search: "" });
                            }}
                            placeholder="Search patient or case number..."
                            label="Search patients under treatment"
                        />

                        <label className="flex items-center gap-2 rounded-lg border-[1.5px] border-line bg-white px-3.5 py-[9px] text-[13.5px] font-semibold text-[#555] focus-within:border-brand">
                            <FaFilter className="size-3.5 text-[#aaa]" aria-hidden="true" />
                            <span className="sr-only">Filter by municipality</span>
                            <select
                                value={filters.municipality}
                                onChange={(event) =>
                                    visit({ municipality: event.target.value })
                                }
                                className="bg-transparent outline-none"
                            >
                                <option value="all">All municipalities</option>
                                {municipalities.map((municipality) => (
                                    <option key={municipality} value={municipality}>
                                        {municipality}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex items-center gap-2 rounded-lg border-[1.5px] border-line bg-white px-3.5 py-[9px] text-[13.5px] font-semibold text-[#555] focus-within:border-brand">
                            <span className="sr-only">Filter by contact tracing status</span>
                            <select
                                value={filters.tracing}
                                onChange={(event) => visit({ tracing: event.target.value })}
                                className="bg-transparent outline-none"
                            >
                                {tracingFilters.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </PageToolbar>

                    {cases.data.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        {[
                                            "Patient",
                                            "TB Case No.",
                                            "Municipality",
                                            "Treatment",
                                            "Contact Tracing",
                                        ].map((heading) => (
                                            <th
                                                key={heading}
                                                className="border-b border-line-soft px-5 py-3 text-left text-[11px] font-bold tracking-wide text-[#bbb] uppercase"
                                            >
                                                {heading}
                                            </th>
                                        ))}
                                        <th className="border-b border-line-soft px-5 py-3 text-center text-[11px] font-bold tracking-wide text-[#bbb] uppercase">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cases.data.map((row) => (
                                        <tr key={row.id} className="hover:bg-[#fdf8f8]">
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5">
                                                <strong className="block text-[13px] font-semibold text-ink">
                                                    {row.patient_name}
                                                </strong>
                                                <span className="block text-[11px] text-muted">
                                                    {row.tb_diagnosis}
                                                </span>
                                            </td>
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5 text-[12.5px] font-semibold whitespace-nowrap text-[#58606a]">
                                                {row.case_number}
                                            </td>
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5 text-[12.5px] text-muted">
                                                {row.municipality ?? "—"}
                                                <span className="block text-[11px] text-[#bbb]">
                                                    {row.treatment_facility}
                                                </span>
                                            </td>
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5 text-[12.5px] text-muted">
                                                Month {row.current_month}
                                                <span className="block text-[11px] text-[#bbb]">
                                                    since {row.start_date_label}
                                                </span>
                                            </td>
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5">
                                                <StatusPill
                                                    tone={row.has_tracing ? "active" : "upcoming"}
                                                >
                                                    {row.has_tracing ? "Filed" : "Not yet filed"}
                                                </StatusPill>
                                            </td>
                                            <td className="border-b border-[#f8f2f2] px-5 py-3.5 text-center">
                                                <Link
                                                    href={route(
                                                        "icm.contact-tracing.show",
                                                        row.id,
                                                    )}
                                                    className="text-[12px] font-bold text-brand hover:underline"
                                                >
                                                    View
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState
                            icon={<FaHouseChimneyMedical aria-hidden="true" />}
                            title="No patients under treatment"
                            description={
                                filtersApplied
                                    ? "No patient under treatment matches this search or filter."
                                    : "Patients appear here once an RHU enrolls them in TB treatment."
                            }
                        >
                            {filtersApplied ? (
                                <Button
                                    variant="secondary"
                                    className="mt-2"
                                    onClick={() => {
                                        setSearch("");
                                        router.get(route("icm.contact-tracing.index"));
                                    }}
                                >
                                    Clear filters
                                </Button>
                            ) : null}
                        </EmptyState>
                    )}

                    {cases.links.length > 3 && (
                        <nav
                            className="flex flex-wrap items-center justify-center gap-1.5 border-t border-line-soft px-5 py-4"
                            aria-label="Patient pages"
                        >
                            {cases.links.map((link, index) =>
                                link.url ? (
                                    <Link
                                        href={link.url}
                                        key={`${link.label}-${index}`}
                                        preserveScroll
                                        className={cx(
                                            "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                                            link.active
                                                ? "bg-brand text-white"
                                                : "text-muted hover:bg-shell hover:text-ink",
                                        )}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ) : (
                                    <span
                                        key={`${link.label}-${index}`}
                                        className="px-3 py-1.5 text-xs text-[#ccc]"
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ),
                            )}
                        </nav>
                    )}
                </Card>
            </section>
        </DashboardLayout>
    );
}
