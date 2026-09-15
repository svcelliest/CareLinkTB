import { cx } from "@/Components/ui";

/**
 * The dashboard's chart set, drawn as inline SVG and CSS so the analytics
 * carry no charting dependency and inherit the portal's palette directly.
 *
 * Every component takes the aggregated series produced by
 * `App\Support\TbAnalytics` and renders exactly what it is given — none of
 * them invent, pad, or sample values when a series is empty.
 */

function EmptySeries({ label = "No data for this selection" }) {
    return (
        <div className="flex min-h-[140px] items-center justify-center px-4 text-center text-[12px] text-[#bbb]">
            {label}
        </div>
    );
}

/** Donut with a legend, used for treatment status and sex distribution. */
export function DonutChart({ data, centerLabel, centerSub }) {
    const total = data.reduce((sum, slice) => sum + slice.value, 0);

    if (total === 0) return <EmptySeries />;

    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return (
        <div className="flex flex-wrap items-center justify-center gap-6 py-3">
            <div className="relative size-[130px] shrink-0">
                <svg viewBox="0 0 130 130" className="size-[130px] -rotate-90">
                    {data.map((slice) => {
                        const fraction = slice.value / total;
                        const dash = fraction * circumference;
                        const element = (
                            <circle
                                key={slice.label}
                                cx="65"
                                cy="65"
                                r={radius}
                                fill="none"
                                stroke={slice.color}
                                strokeWidth="16"
                                strokeDasharray={`${dash} ${circumference - dash}`}
                                strokeDashoffset={-offset}
                            />
                        );
                        offset += dash;
                        return element;
                    })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[22px] leading-none font-bold text-ink">
                        {centerLabel ?? total}
                    </span>
                    <span className="text-[8px] font-semibold tracking-wide text-muted uppercase">
                        {centerSub ?? "Patients"}
                    </span>
                </div>
            </div>

            <ul className="flex min-w-[130px] flex-col gap-2">
                {data.map((slice) => (
                    <li
                        key={slice.label}
                        className="flex items-center gap-2 text-[12px] text-[#555]"
                    >
                        <span
                            className="size-2.5 shrink-0 rounded-sm"
                            style={{ background: slice.color }}
                            aria-hidden="true"
                        />
                        <span className="flex-1">{slice.label}</span>
                        <strong className="font-bold text-ink">{slice.value}</strong>
                        <span className="text-[11px] text-muted">
                            {Math.round((slice.value / total) * 100)}%
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** Vertical bars, used for the quarterly positive-case comparison. */
export function BarChart({ data, color = "#c0392b" }) {
    const max = Math.max(1, ...data.map((entry) => entry.value));

    if (data.length === 0) return <EmptySeries />;

    return (
        <div className="flex h-[190px] items-end justify-around gap-4 px-3 pt-4 pb-2">
            {data.map((entry) => (
                <div
                    key={entry.label}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                >
                    <span className="text-[12px] font-bold text-ink">
                        {entry.value}
                    </span>
                    <div
                        className="w-full max-w-[46px] rounded-t-md transition-[height] duration-300"
                        style={{
                            height: `${Math.max((entry.value / max) * 100, 2)}%`,
                            background: color,
                        }}
                    />
                    <span className="text-[11px] font-semibold text-muted">
                        {entry.label}
                    </span>
                </div>
            ))}
        </div>
    );
}

/**
 * Horizontal ranked bars for the municipality list. Sorting is done upstream
 * in PHP by case count — no position here is hardcoded.
 */
export function RankedBars({ data, colorFor, selected, onSelect }) {
    const max = Math.max(1, ...data.map((entry) => entry.tb_cases));
    const total = data.reduce((sum, entry) => sum + entry.tb_cases, 0);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <ul className="flex max-h-[290px] flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
                {data.map((entry, index) => {
                    const isSelected = selected === entry.municipality;

                    return (
                        <li key={entry.municipality}>
                            <button
                                type="button"
                                onClick={() =>
                                    onSelect?.(isSelected ? null : entry.municipality)
                                }
                                aria-pressed={isSelected}
                                className={cx(
                                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                                    isSelected
                                        ? "bg-brand-soft"
                                        : "hover:bg-[#faf7f7]",
                                )}
                            >
                                <span className="w-4 shrink-0 text-[10.5px] font-bold text-[#bbb]">
                                    {index + 1}
                                </span>
                                <span
                                    className="size-2.5 shrink-0 rounded-sm border border-line-soft"
                                    style={{ background: colorFor(entry.tb_cases) }}
                                    aria-hidden="true"
                                />
                                <span className="w-[104px] shrink-0 truncate text-[12px] font-semibold text-ink">
                                    {entry.municipality}
                                    <span className="block text-[10px] font-normal text-muted">
                                        {entry.province}
                                    </span>
                                </span>
                                <span className="h-2 flex-1 overflow-hidden rounded-full bg-line-soft">
                                    <span
                                        className="block h-full rounded-full"
                                        style={{
                                            width: `${(entry.tb_cases / max) * 100}%`,
                                            background: colorFor(entry.tb_cases),
                                        }}
                                    />
                                </span>
                                <span className="w-7 shrink-0 text-right text-[12px] font-bold text-ink">
                                    {entry.tb_cases}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            <div className="mt-2 flex items-center justify-between border-t border-line-soft pt-2 text-[11.5px]">
                <span className="font-semibold text-muted">Total cases</span>
                <strong className="text-[13px] font-bold text-ink">{total}</strong>
            </div>
        </div>
    );
}

/** Age-group rows: label, count, and a proportional track. */
export function DistributionList({ data }) {
    const max = Math.max(1, ...data.map((entry) => entry.value));

    if (data.every((entry) => entry.value === 0)) return <EmptySeries />;

    return (
        <ul className="flex flex-col gap-3.5 py-3">
            {data.map((entry) => (
                <li key={entry.label} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between text-[12px]">
                        <span className="font-semibold text-[#555]">
                            {entry.label}
                        </span>
                        <span className="text-muted">
                            <strong className="text-[13px] font-bold text-ink">
                                {entry.value}
                            </strong>{" "}
                            · {entry.percent}%
                        </span>
                    </div>
                    <span className="h-2 overflow-hidden rounded-full bg-line-soft">
                        <span
                            className="block h-full rounded-full bg-brand"
                            style={{ width: `${(entry.value / max) * 100}%` }}
                        />
                    </span>
                </li>
            ))}
        </ul>
    );
}

/** Registration trend as a polyline with point markers. */
export function LineChart({ data }) {
    if (data.length === 0) return <EmptySeries />;

    const width = 320;
    const height = 150;
    const padding = { top: 14, right: 10, bottom: 24, left: 26 };
    const max = Math.max(1, ...data.map((entry) => entry.value));
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const points = data.map((entry, index) => ({
        ...entry,
        x:
            padding.left +
            (data.length === 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth),
        y: padding.top + innerHeight - (entry.value / max) * innerHeight,
    }));

    return (
        <div className="py-2">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="h-[190px] w-full"
                role="img"
                aria-label="Patient registrations over time"
            >
                {[0, 0.5, 1].map((ratio) => (
                    <line
                        key={ratio}
                        x1={padding.left}
                        x2={width - padding.right}
                        y1={padding.top + innerHeight * ratio}
                        y2={padding.top + innerHeight * ratio}
                        stroke="#f0eaea"
                        strokeWidth="1"
                    />
                ))}

                <polyline
                    fill="none"
                    stroke="#c0392b"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={points.map((point) => `${point.x},${point.y}`).join(" ")}
                />

                {points.map((point) => (
                    <g key={point.label}>
                        <circle cx={point.x} cy={point.y} r="3.5" fill="#c0392b" />
                        <text
                            x={point.x}
                            y={height - 8}
                            textAnchor="middle"
                            className="fill-[#888] text-[8px]"
                        >
                            {point.label}
                        </text>
                    </g>
                ))}

                <text x="2" y={padding.top + 4} className="fill-[#bbb] text-[8px]">
                    {max}
                </text>
                <text
                    x="2"
                    y={padding.top + innerHeight}
                    className="fill-[#bbb] text-[8px]"
                >
                    0
                </text>
            </svg>
        </div>
    );
}

/** Half-circle gauge for a single percentage. */
export function Gauge({ percent, caption }) {
    const radius = 60;
    const circumference = Math.PI * radius;
    const filled = (Math.min(Math.max(percent, 0), 100) / 100) * circumference;

    return (
        <div className="flex flex-col items-center gap-1 py-4">
            <svg viewBox="0 0 150 88" className="w-[190px]" role="img" aria-label={caption}>
                <path
                    d="M 15 78 A 60 60 0 0 1 135 78"
                    fill="none"
                    stroke="#f0eaea"
                    strokeWidth="14"
                    strokeLinecap="round"
                />
                <path
                    d="M 15 78 A 60 60 0 0 1 135 78"
                    fill="none"
                    stroke="#27ae60"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray={`${filled} ${circumference}`}
                />
                <text
                    x="75"
                    y="70"
                    textAnchor="middle"
                    className="fill-[#1a1a1a] text-[24px] font-bold"
                >
                    {percent}%
                </text>
            </svg>
            {caption ? (
                <span className="text-center text-[11.5px] text-muted">{caption}</span>
            ) : null}
        </div>
    );
}
