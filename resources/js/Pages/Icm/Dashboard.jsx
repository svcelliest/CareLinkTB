import { useMemo, useState } from "react";
import { Link, router } from "@inertiajs/react";
import {
    FaBolt,
    FaBoxArchive,
    FaBullseye,
    FaCircleCheck,
    FaCircleExclamation,
    FaUsers,
    FaUsersGear,
} from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Card, cx } from "@/Components/ui";
import MunicipalityMap, { makeScale } from "@/Components/analytics/MunicipalityMap";
import {
    BarChart,
    DistributionList,
    DonutChart,
    Gauge,
    LineChart,
    RankedBars,
} from "@/Components/analytics/Charts";

/**
 * ICM analytics dashboard.
 *
 * Every number on this page comes from `App\Support\TbAnalytics`, which reads
 * the live `patients`, `programs`, and `users` tables. Changing a filter
 * re-requests only the `analytics` prop, so the server recomputes against the
 * new scope rather than the page filtering a cached client-side copy.
 */

/** Sentinel for the programme-wide option in the scope dropdown. */
const OVERALL = "__overall__";

function ProgramStat({ icon, label, value, accent, href }) {
    const Wrapper = href ? Link : "div";

    return (
        <Card
            as={Wrapper}
            {...(href ? { href } : {})}
            style={{ "--stat-accent": accent.fg }}
            className={cx(
                "relative flex min-h-[82px] items-center gap-[14px] overflow-hidden",
                "rounded-[10px] border border-line px-5 py-[14px]",
                "shadow-[0_1px_3px_rgba(0,0,0,0.05)]",
                // the accent rule down the left edge of the reference card
                "before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
                "before:bg-[var(--stat-accent)] before:content-['']",
                href && "transition-shadow hover:shadow-[0_4px_18px_rgba(0,0,0,0.1)]",
            )}
        >
            <span
                className="flex size-11 shrink-0 items-center justify-center rounded-[11px] text-[25px]"
                style={{ background: accent.bg, color: accent.fg }}
                aria-hidden="true"
            >
                {icon}
            </span>
            <span className="flex flex-col gap-[3px]">
                <span className="text-[11px] leading-[1.2] font-medium text-muted">
                    {label}
                </span>
                <span className="text-[24px] leading-none font-extrabold text-ink">
                    {value}
                </span>
            </span>
        </Card>
    );
}

function Kpi({ label, value, sub, icon, accent }) {
    return (
        <Card
            className="flex flex-col gap-2 border-l-4 px-5 py-4"
            style={{ borderLeftColor: accent.fg }}
        >
            <div className="flex items-start justify-between gap-3">
                <span className="text-[11px] leading-tight font-bold tracking-wide text-muted uppercase">
                    {label}
                </span>
                <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-base"
                    style={{ background: accent.bg, color: accent.fg }}
                    aria-hidden="true"
                >
                    {icon}
                </span>
            </div>
            <span className="text-[30px] leading-none font-bold text-ink">{value}</span>
            <span className="text-[11.5px] text-muted">{sub}</span>
        </Card>
    );
}

function ChartCard({ title, subtitle, action, className = "", children }) {
    return (
        <Card className={cx("flex flex-col p-5", className)}>
            <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="text-[13px] font-bold text-ink">{title}</div>
                    {subtitle ? (
                        <div className="text-[11.5px] text-muted">{subtitle}</div>
                    ) : null}
                </div>
                {action}
            </div>
            {children}
        </Card>
    );
}

export default function Dashboard({ filters, options, analytics }) {
    const [trendMode, setTrendMode] = useState("quarterly");
    // Highlighting a municipality is a view concern shared by the map and the
    // ranking; it does not re-query the server.
    const [highlighted, setHighlighted] = useState(null);

    const isMunicipalityScope = filters.scope === "municipality";

    const scale = useMemo(
        () =>
            makeScale(
                Math.max(
                    0,
                    ...analytics.municipality_cases.map((entry) => entry.tb_cases),
                ),
            ),
        [analytics.municipality_cases],
    );

    const applyFilters = (next) => {
        router.get(
            route("icm.dashboard"),
            {
                scope: next.scope ?? filters.scope,
                municipality: next.municipality ?? filters.municipality,
                year: next.year ?? filters.year,
            },
            {
                only: ["analytics", "filters"],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const scopeSuffix = isMunicipalityScope
        ? ` in ${filters.municipality}`
        : "";

    return (
        <DashboardLayout
            role="icm"
            title="Dashboard"
            contentClassName="dash-content-overview"
        >
            <section className="flex w-full flex-col gap-[18px] font-ui">
                <div className="grid gap-5 lg:grid-cols-3">
                    <ProgramStat
                        icon={<FaBullseye />}
                        label="Total Active Program"
                        value={analytics.programs.active}
                        accent={{ bg: "#eef2ff", fg: "#4a7cf7" }}
                        href={route("icm.programs.index")}
                    />
                    <ProgramStat
                        icon={<FaBoxArchive />}
                        label="Total Archive Program"
                        value={analytics.programs.completed}
                        accent={{ bg: "#edfaf3", fg: "#27ae60" }}
                        href={route("icm.programs.index")}
                    />
                    <ProgramStat
                        icon={<FaUsersGear />}
                        label="Active Accounts"
                        value={analytics.programs.active_accounts}
                        accent={{ bg: "#fdecec", fg: "#c0392b" }}
                        href={route("icm.accounts.index")}
                    />
                </div>

                <Card className="flex flex-col gap-[18px] border border-[#e6dddd] px-[22px] pt-5 pb-[22px]">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <div className="text-[16px] font-extrabold text-ink">
                                Analytics
                            </div>
                            <div className="mt-[3px] text-[11.5px] text-[#999]">
                                TB screening, case monitoring, and treatment
                                performance
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                            {/* Scope is one dropdown: "Overall" plus every
                                municipality. Picking a municipality is what
                                switches the scope, so there is no separate
                                toggle to click through first. */}
                            <label className="flex items-center gap-2 rounded-lg border-[1.5px] border-line px-3 py-1.5 text-[12.5px] font-semibold text-[#555] focus-within:border-brand">
                                <span className="text-muted">Scope</span>
                                <select
                                    value={
                                        isMunicipalityScope
                                            ? (filters.municipality ?? OVERALL)
                                            : OVERALL
                                    }
                                    onChange={(event) => {
                                        const value = event.target.value;

                                        applyFilters(
                                            value === OVERALL
                                                ? { scope: "overall" }
                                                : {
                                                      scope: "municipality",
                                                      municipality: value,
                                                  },
                                        );
                                    }}
                                    className="bg-transparent outline-none"
                                >
                                    <option value={OVERALL}>Overall</option>
                                    {options.municipalities.map((name) => (
                                        <option key={name} value={name}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="flex items-center gap-2 rounded-lg border-[1.5px] border-line px-3 py-1.5 text-[12.5px] font-semibold text-[#555] focus-within:border-brand">
                                <span className="sr-only">Year</span>
                                <select
                                    value={filters.year}
                                    onChange={(event) =>
                                        applyFilters({ year: event.target.value })
                                    }
                                    className="bg-transparent outline-none"
                                >
                                    <option value="all">All years</option>
                                    {options.years.map((year) => (
                                        <option key={year} value={String(year)}>
                                            {year}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <Kpi
                            label="Total Registered Patients"
                            value={analytics.kpis.total}
                            sub={`All registered patients${scopeSuffix}`}
                            icon={<FaUsers />}
                            accent={{ bg: "#eef2ff", fg: "#4a7cf7" }}
                        />
                        <Kpi
                            label="Presumptive Patients"
                            value={analytics.kpis.presumptive}
                            sub="Awaiting diagnostic confirmation"
                            icon={<FaCircleExclamation />}
                            accent={{ bg: "#fff6e6", fg: "#e2941b" }}
                        />
                        <Kpi
                            label="Active Cases"
                            value={analytics.kpis.active_cases}
                            sub="Confirmed cases under management"
                            icon={<FaBolt />}
                            accent={{ bg: "#fdecec", fg: "#c0392b" }}
                        />
                        <Kpi
                            label="Treatment Enrolment Rate"
                            value={`${analytics.kpis.enrolment_rate}%`}
                            sub={`${analytics.kpis.enrolled} of ${analytics.kpis.active_cases} confirmed cases enrolled`}
                            icon={<FaCircleCheck />}
                            accent={{ bg: "#edfaf3", fg: "#27ae60" }}
                        />
                    </div>

                    <div className="grid gap-[18px] lg:grid-cols-2">
                        <ChartCard
                            title="Treatment Status"
                            subtitle="Distribution of patients by treatment status"
                        >
                            <DonutChart
                                data={analytics.treatment_status}
                                centerLabel={analytics.kpis.total}
                            />
                        </ChartCard>
                        <ChartCard
                            title="Quarterly Positive Cases Comparison"
                            subtitle="Confirmed positive cases by quarter"
                        >
                            <BarChart data={analytics.quarterly_cases} />
                        </ChartCard>
                    </div>

                    <div className="grid gap-[18px] xl:grid-cols-[1.6fr_1fr]">
                        <ChartCard
                            title="Cases by Municipality"
                            subtitle="Affected municipalities and confirmed positive cases, ranked highest to lowest"
                        >
                            <div className="mt-2 grid min-h-[330px] gap-4 md:grid-cols-2">
                                <MunicipalityMap
                                    data={analytics.municipality_cases}
                                    selected={highlighted}
                                    onSelect={setHighlighted}
                                />
                                <RankedBars
                                    data={analytics.municipality_cases}
                                    colorFor={scale.colorFor}
                                    selected={highlighted}
                                    onSelect={setHighlighted}
                                />
                            </div>
                        </ChartCard>

                        <div className="flex flex-col gap-[18px]">
                            <ChartCard
                                title="Age Group Distribution"
                                subtitle="Children, adults, and elderly patients"
                            >
                                <DistributionList data={analytics.age_groups} />
                            </ChartCard>
                            <ChartCard
                                title="Sex Distribution"
                                subtitle="Male and female patient distribution"
                            >
                                <DonutChart
                                    data={analytics.sex}
                                    centerLabel={analytics.kpis.total}
                                />
                            </ChartCard>
                        </div>
                    </div>

                    <div className="grid gap-[18px] lg:grid-cols-2">
                        <ChartCard
                            title="Patient Trend"
                            subtitle="Patient registrations over time"
                            action={
                                <div className="flex rounded-lg bg-shell p-1">
                                    {["yearly", "quarterly"].map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setTrendMode(mode)}
                                            className={cx(
                                                "rounded-md px-3 py-1 text-[11.5px] font-semibold capitalize transition-colors",
                                                trendMode === mode
                                                    ? "bg-white text-brand shadow-sm"
                                                    : "text-muted hover:text-ink",
                                            )}
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                            }
                        >
                            <LineChart data={analytics.trend[trendMode]} />
                        </ChartCard>

                        <ChartCard
                            title="Diagnostic Follow-through"
                            subtitle="TB-flagged patients with a recorded diagnostic result"
                        >
                            <Gauge
                                percent={analytics.follow_through.percent}
                                caption={`${analytics.follow_through.tested} of ${analytics.follow_through.flagged} flagged patients have a result on file`}
                            />
                        </ChartCard>
                    </div>
                </Card>
            </section>
        </DashboardLayout>
    );
}
