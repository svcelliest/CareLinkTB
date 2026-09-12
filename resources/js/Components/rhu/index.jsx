import { Link } from "@inertiajs/react";
import { useEffect, useRef, useState } from "react";
import { FaArrowRight, FaLock } from "react-icons/fa6";
import { Card, cx, selectClass } from "@/Components/ui";

/**
 * The RHU portal's recurring surfaces, translated from the RHU reference into
 * the design tokens already defined in resources/css/app.css (`brand`, `line`,
 * `shell`, `muted`, `font-ui`).
 *
 * Written as Tailwind utilities rather than a new stylesheet for the same
 * reason the ICM conversion was: every value below already exists as a token,
 * so a `14-rhu-portal.css` would be a second copy of the palette that could
 * drift from this one. Nothing here restates a rule that 01–13 already define.
 *
 * The reference scopes Patient Monitoring to its own lighter red
 * (`--pm-primary:#d94750`) while every other RHU screen uses #c0392b. Both are
 * rendered here in the portal's one `brand` token, so the module sits inside
 * CareLink's palette instead of introducing a second red.
 */

/* ── Dashboard ─────────────────────────────────────────────────────────── */

/** KPI card: left accent bar, tinted icon tile, value, sub-caption. */
export function StatCard({ label, value, caption, icon, accent = "brand", href }) {
    const accents = {
        brand: { bar: "bg-brand", tile: "bg-brand-soft text-brand" },
        info: { bar: "bg-info", tile: "bg-[#eef2ff] text-info" },
        ok: { bar: "bg-ok", tile: "bg-ok-soft text-ok" },
    };
    const tone = accents[accent] ?? accents.brand;

    const body = (
        <>
            <span
                className={cx(
                    "absolute inset-y-0 left-0 w-1",
                    tone.bar,
                )}
                aria-hidden="true"
            />
            <div className="flex items-start justify-between gap-3">
                <span className="text-[10.5px] leading-[1.4] font-bold tracking-[0.3px] text-[#6b7280] uppercase">
                    {label}
                </span>
                <span
                    className={cx(
                        "flex size-10 shrink-0 items-center justify-center rounded-[10px] text-xl",
                        tone.tile,
                    )}
                    aria-hidden="true"
                >
                    {icon}
                </span>
            </div>
            <span className="text-[32px] leading-none font-extrabold text-[#1f2937]">
                {value ?? "—"}
            </span>
            {caption ? (
                <span className="text-[11px] font-medium text-[#9aa1ad]">{caption}</span>
            ) : null}
        </>
    );

    // The hover lift is on every card, linked or not: a KPI card is a live
    // figure and reads as one, whether or not it goes anywhere.
    const className =
        "relative flex flex-col gap-2.5 overflow-hidden px-[22px] py-5 font-ui transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.12)]";

    return href ? (
        <Card as={Link} href={href} className={cx(className, "hover:bg-[#fffafa]")}>
            {body}
        </Card>
    ) : (
        <Card className={className}>{body}</Card>
    );
}

/**
 * The dashboard's progress ring.
 *
 * Percentage, remaining and the status band are all derived from the real
 * completed/total counts passed in — the reference derives them the same way
 * and never hard-codes them.
 */
export function ProgressDonut({ title, href, linkLabel = "View Form", done = 0, total = 0 }) {
    const circumference = 389.6;
    const percentage = total > 0 ? (done / total) * 100 : 0;
    const filled = (percentage / 100) * circumference;
    const remaining = Math.max(total - done, 0);

    const status =
        percentage >= 100
            ? { label: "Completed", className: "text-brand" }
            : percentage >= 85
              ? { label: "On Track", className: "text-brand" }
              : percentage >= 60
                ? { label: "Needs Monitoring", className: "text-[#a9682b]" }
                : { label: "Needs Attention", className: "text-brand-strong" };

    return (
        <Card className="flex flex-1 flex-col px-[22px] py-5 font-ui">
            <div className="mb-1.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-[7px] text-[13px] font-bold text-[#1f2937]">
                    <span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                    {title}
                </div>
                {href ? (
                    <Link
                        href={href}
                        className="flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline"
                    >
                        {linkLabel}
                        <FaArrowRight className="size-[13px]" aria-hidden="true" />
                    </Link>
                ) : null}
            </div>

            <div className="flex flex-1 flex-wrap items-center justify-center gap-[22px] py-1.5">
                <div className="relative size-[158px] shrink-0">
                    <svg
                        viewBox="0 0 160 160"
                        className="size-[158px] -rotate-90"
                        role="img"
                        aria-label={`${title}: ${percentage.toFixed(1)} percent complete`}
                    >
                        <circle cx="80" cy="80" r="62" fill="none" stroke="#eeeeee" strokeWidth="17" />
                        <circle
                            cx="80"
                            cy="80"
                            r="62"
                            fill="none"
                            stroke="currentColor"
                            className="text-brand transition-[stroke-dasharray] duration-500"
                            strokeWidth="17"
                            strokeLinecap="round"
                            strokeDasharray={`${filled.toFixed(1)} ${(circumference - filled).toFixed(1)}`}
                        />
                    </svg>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                        <span className="block text-[29px] leading-none font-extrabold tracking-[-0.5px] text-[#1f2937]">
                            {percentage.toFixed(1)}%
                        </span>
                        <span className="text-[8.5px] font-bold tracking-[0.6px] text-[#6b7280]">
                            COMPLETED
                        </span>
                    </div>
                </div>

                <div className="flex min-w-[104px] flex-col gap-[3px]">
                    <div className="text-xl leading-[1.1] font-extrabold tracking-[-0.3px] text-[#1f2937]">
                        {done} / {total}
                    </div>
                    <div className="text-[10.5px] font-bold tracking-[0.4px] text-[#6b7280] uppercase">
                        Completed
                    </div>
                    <div className="mt-[5px] text-xs font-semibold text-[#6b7280]">
                        {remaining} remaining
                    </div>
                </div>
            </div>

            <div
                className={cx(
                    "mt-auto flex items-center gap-1.5 border-t border-line-soft pt-[11px] text-xs font-semibold",
                    status.className,
                )}
            >
                <span className="size-2 shrink-0 rounded-full bg-current" aria-hidden="true" />
                {status.label}
            </div>
        </Card>
    );
}

/**
 * The dashboard's "Recent Activities" strip.
 *
 * `h-full` lets it fill its grid cell so it ends level with the progress card
 * beside it; the list then scrolls inside the card rather than stretching it,
 * which is what keeps the two columns aligned however many rows arrive.
 */
export function ActivityStrip({ activities = [], href }) {
    return (
        <Card className="flex h-full flex-col px-6 py-[22px] font-ui">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-bold text-ink">Recent Activities</h2>
                {href ? (
                    <Link
                        href={href}
                        className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                    >
                        View All
                        <FaArrowRight className="size-[13px]" aria-hidden="true" />
                    </Link>
                ) : null}
            </div>

            {activities.length === 0 ? (
                <p className="flex flex-1 items-center justify-center py-8 text-center text-[13px] text-muted">
                    No activity recorded yet. Your actions in the portal will appear here.
                </p>
            ) : (
                // The rows bleed 10px each side so their hover background
                // reaches the card's padding. Matching that bleed with the
                // list's own padding keeps the scroll box exactly as wide as
                // the rows, so scrolling stays vertical only.
                <ul className="-mx-2.5 min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2.5">
                    {activities.map((activity) => (
                        <li
                            key={activity.id}
                            className="-mx-2.5 flex flex-wrap items-start justify-between gap-1 rounded-lg border-b border-shell px-2.5 py-[13px] last:border-b-0 hover:bg-[#fdf8f8]"
                        >
                            <div>
                                <span className="text-[13.5px] font-medium text-ink">
                                    {activity.title}
                                </span>
                                <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-[#aaa]">
                                    <span className="text-[10px] font-bold tracking-[0.4px] text-brand">
                                        {activity.tag}
                                    </span>
                                    <span className="text-[#ddd]">·</span>
                                    <span>{activity.datetime_label}</span>
                                </div>
                            </div>
                            <span className="shrink-0 text-[11.5px] whitespace-nowrap text-[#aaa]">
                                {activity.time_label}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

/* ── Shared building blocks ────────────────────────────────────────────── */

const pillTones = {
    done: "bg-[#eaf7f0] text-[#1e8e5a]",
    prog: "bg-[#fff3e2] text-[#c47f17]",
    idle: "bg-[#f2f2f2] text-[#999]",
};

/**
 * Progress pill: Completed / In Progress / Not Started.
 *
 * `labels` overrides the wording where the register uses its own — the sputum
 * column reads "Collected / Not Collected" rather than a progress state.
 */
export function ProgressPill({ done = 0, total = 0, labels }) {
    const state = total > 0 && done >= total ? "done" : done > 0 ? "prog" : "idle";
    const defaults = {
        done: "Completed",
        prog: "In Progress",
        idle: "Not Started",
    };

    return (
        <span
            className={cx(
                "inline-flex items-center gap-1.5 rounded-full px-[11px] py-1 text-[10.5px] font-bold",
                pillTones[state],
            )}
        >
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            {labels?.[state] ?? defaults[state]}
        </span>
    );
}

/** The thin gradient progress bar used under every RHU count. */
export function ProgressBar({ label, done = 0, total = 0, className = "" }) {
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    return (
        <div className={cx("flex min-w-[160px] flex-col gap-1", className)}>
            <div className="flex justify-between text-[11.5px] font-semibold text-[#666]">
                <span>{label}</span>
                <span>
                    {done} / {total}
                </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-[20px] bg-line-soft">
                <div
                    className="h-full rounded-[20px] bg-linear-to-r from-brand to-[#e74c3c] transition-[width] duration-500"
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    );
}

/** The red pill that carries a total in the form toolbars. */
export function CountBadge({ children }) {
    return (
        <div className="rounded-lg bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap text-white">
            {children}
        </div>
    );
}

/** Underlined tab strip, matching `.tabs`/`.tab` in the reference. */
export function TabStrip({ tabs, value, onChange, label }) {
    return (
        <div
            role="tablist"
            aria-label={label}
            className="flex overflow-x-auto border-b border-[#e5e7eb] bg-white"
        >
            {tabs.map((tab) => (
                <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={value === tab.value}
                    onClick={() => onChange(tab.value)}
                    className={cx(
                        "border-b-2 px-4 py-[13px] text-[11px] font-semibold whitespace-nowrap transition-colors",
                        value === tab.value
                            ? "border-brand text-brand"
                            : "border-transparent text-[#6b7280] hover:text-brand",
                    )}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

/** Section heading inside a record form. */
export function FormSection({ title, tag, children, className = "" }) {
    return (
        <section className={cx("mb-7 last:mb-0", className)}>
            <div className="mb-3.5 flex items-center justify-between gap-3 border-b border-[#e5e7eb] pb-[9px]">
                <h3 className="text-[13px] font-extrabold text-[#1f2937]">{title}</h3>
                {tag ? (
                    <span className="text-[9px] font-bold tracking-[0.04em] text-[#6b7280] uppercase">
                        {tag}
                    </span>
                ) : null}
            </div>
            {children}
        </section>
    );
}

/** Label/value grid used by the Patient Summary tab. */
export function InfoSummary({ items }) {
    return (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-[18px] sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
                <div key={item.label} className={cx("min-w-0", item.full && "col-span-full")}>
                    <dt className="mb-1 text-[10px] font-semibold tracking-[0.03em] text-[#6b7280] uppercase">
                        {item.label}
                    </dt>
                    <dd className="text-[13px] font-bold break-words text-[#1f2937]">
                        {item.value ?? "—"}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

/** The lock note above the read-only Sputum Collection tab. */
export function ReadOnlyNote({ children }) {
    return (
        <p className="flex items-center gap-2 border-b border-line-soft bg-[#fbf9f9] px-5 py-[11px] text-[11px] text-muted">
            <svg
                viewBox="0 0 24 24"
                className="size-[13px] shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <rect x="4" y="11" width="16" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 018 0v4" />
            </svg>
            {children}
        </p>
    );
}

/* ── Treatment Monitoring blocks ───────────────────────────────────────── */

const alertTones = {
    neutral: "bg-[#f3f4f6] text-[#374151] border-[#e5e7eb]",
    warning: "bg-[#fff7df] text-[#805500] border-[#f3df9b]",
    danger: "bg-[#fff0f0] text-[#c53030] border-[#f3c5c5]",
    success: "bg-[#eaf8f2] text-[#16845b] border-[#c8ebdc]",
};

/** The reference's `.alert` band, in its four tones. */
export function Alert({ tone = "neutral", className = "", children }) {
    return (
        <div
            className={cx(
                "mb-[15px] rounded-lg border px-3.5 py-3 text-[11px] leading-relaxed",
                alertTones[tone] ?? alertTones.neutral,
                className,
            )}
        >
            {children}
        </div>
    );
}

/**
 * The grey facts strip above a form (`.pm-facts`) and the plain summary grid
 * below it (`.pm-summary-grid`) — same cells, the strip just has a surface.
 */
export function FactsGrid({ items, boxed = true, className = "" }) {
    return (
        <div
            className={cx(
                "grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4",
                boxed && "rounded-[9px] border border-[#e5e7eb] bg-[#fafbfc] px-4 py-3.5",
                className,
            )}
        >
            {items.filter(Boolean).map((item) => (
                <div key={item.label} className="flex min-w-0 flex-col gap-[3px]">
                    <span className="text-[9px] font-extrabold tracking-[0.04em] text-[#98a1ad] uppercase">
                        {item.label}
                    </span>
                    <span className="text-[12.5px] font-bold break-words text-[#1f2937]">
                        {item.value ?? "—"}
                    </span>
                    {item.sub ? (
                        <span className="text-[9.5px] text-[#6b7280]">{item.sub}</span>
                    ) : null}
                </div>
            ))}
        </div>
    );
}

/** Month 1–6 selector above the clinical review. */
/**
 * One month (or week) tab. `complete` marks a finished period, `locked` one
 * that cannot be opened until the period before it is completed — the button
 * is disabled and reads as such, so the sequence is visible at a glance.
 */
export function MonthButton({ month, active, complete, locked = false, onClick, label }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={locked}
            aria-pressed={active}
            title={locked ? "Locked until the previous period is completed" : undefined}
            className={cx(
                "inline-flex items-center gap-1.5 rounded-[7px] border px-3 py-2 text-[10px] font-semibold whitespace-nowrap",
                active
                    ? "border-brand bg-brand text-white"
                    : complete
                      ? "border-[#b7e4cf] bg-white text-ok"
                      : locked
                        ? "cursor-not-allowed border-[#e5e7eb] bg-[#f9fafb] text-[#b8bec8]"
                        : "border-[#e5e7eb] bg-white text-[#4b5563] hover:border-brand hover:text-brand",
            )}
        >
            {label ?? `Month ${month}`}
            {complete && !active ? <span aria-hidden="true">✓</span> : null}
            {locked ? <FaLock className="size-2.5" aria-hidden="true" /> : null}
        </button>
    );
}

const weekTones = {
    completed: "border-[#cfe9dd] bg-[#eaf8f2] [&_[data-state]]:text-ok",
    current: "border-brand bg-brand-soft shadow-[0_0_0_1px_var(--color-brand)] [&_[data-state]]:text-brand",
    overdue: "border-[#f3c9c9] bg-[#fff0f0] [&_[data-state]]:text-[#c53030]",
    upcoming: "border-[#e5e7eb] bg-white [&_[data-state]]:text-[#b8bec8]",
};

/**
 * One of the four "Week of Medication Dispensing" cards.
 *
 * Selectable: the Medicine Tracker and Week Summary follow the selected week.
 * A locked week (nothing recorded, not yet due) is shown but cannot be
 * selected, which is what keeps the sequence in order.
 */
export function WeekCard({ week, selected = false, locked = false, onSelect, children }) {
    const selectable = Boolean(onSelect) && !locked;

    return (
        <div
            role={selectable ? "button" : undefined}
            tabIndex={selectable ? 0 : undefined}
            aria-pressed={selectable ? selected : undefined}
            aria-disabled={locked || undefined}
            onClick={selectable ? onSelect : undefined}
            onKeyDown={
                selectable
                    ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onSelect();
                          }
                      }
                    : undefined
            }
            className={cx(
                "rounded-[9px] border p-[11px] text-center transition-shadow",
                weekTones[week.tone] ?? weekTones.upcoming,
                selectable && "cursor-pointer hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
                selected && "ring-2 ring-[#374151] ring-offset-1",
                locked && "opacity-70",
            )}
        >
            <div className="text-[9px] font-extrabold tracking-[0.04em] text-[#6b7280] uppercase">
                Week {week.week}
            </div>
            <div data-state className="mt-[5px] mb-[3px] text-[11px] font-extrabold">
                {week.state}
            </div>
            <div className="text-[10px] text-[#6b7280]">{week.date_label}</div>
            {children}
        </div>
    );
}

const barTones = { green: "bg-ok", yellow: "bg-[#d99a13]", red: "bg-[#c53030]" };

/** The Medicine Coverage bar. */
export function MedicineBar({ percent, tone = "green" }) {
    return (
        <div className="mt-2.5 h-[9px] overflow-hidden rounded-full bg-[#edf0f3]">
            <div
                className={cx("h-full rounded-full transition-[width]", barTones[tone] ?? barTones.green)}
                style={{ width: `${percent}%` }}
            />
        </div>
    );
}

/** Bordered, horizontally scrolling table shell (`.table-wrap`). */
export function RecordTable({ headings, children, minWidth = "600px" }) {
    return (
        <div className="overflow-x-auto rounded-lg border border-[#e5e7eb]">
            <table className="w-full border-collapse" style={{ minWidth }}>
                <thead>
                    <tr>
                        {headings.map((heading) => (
                            <th
                                key={heading}
                                className="bg-[#f9fafb] px-2.5 py-2.5 text-left text-[9px] font-bold tracking-[0.04em] text-[#6b7280] uppercase"
                            >
                                {heading}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    );
}

export const recordCellClass = "border-t border-[#e5e7eb] px-2.5 py-2.5 text-[10px] text-[#374151]";

/** Small sub-line under a table cell (`.pm-cell-sub`). */
export function CellSub({ tone, children }) {
    return (
        <div
            className={cx(
                "mt-0.5 text-[9.5px]",
                tone === "red" ? "font-bold text-[#c53030]" : "text-[#6b7280]",
            )}
        >
            {children}
        </div>
    );
}

/** Uppercase divider inside a form (`.pm-sub-title`). */
export function SubTitle({ children }) {
    return (
        <div className="mt-4 mb-[9px] text-[10px] font-extrabold tracking-[0.05em] text-[#6b7280] uppercase">
            {children}
        </div>
    );
}

/** The bordered checkbox chips used by the side-effect / difficulty lists. */
export function CheckGrid({ options, selected, disabled, onToggle, name }) {
    return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {options.map((option) => (
                <label
                    key={option}
                    className={cx(
                        "flex cursor-pointer items-center gap-[7px] rounded-[7px] border border-[#e5e7eb] px-2.5 py-2 text-[11px] text-[#1f2937]",
                        !disabled && "hover:border-brand",
                        disabled && "cursor-not-allowed opacity-70",
                    )}
                >
                    <input
                        type="checkbox"
                        name={name}
                        className="size-3.5 shrink-0 accent-brand"
                        checked={selected.includes(option)}
                        disabled={disabled}
                        onChange={() => onToggle(option)}
                    />
                    {option}
                </label>
            ))}
        </div>
    );
}

/**
 * A select-shaped control that opens a list of checkboxes.
 *
 * Used where the RHU picks several answers from a fixed list but the list is
 * too long to lay out as a grid of boxes — the side-effect checklist. The
 * closed control reads like the app's other selects and summarises what is
 * ticked; the open panel is the same checkbox row `CheckGrid` draws. The last
 * row is "Other:" with a text box, whose text becomes one more selected value.
 *
 * `selected` holds the ticked options plus, when typed, the Other text.
 * `otherValue` is that text on its own so the box can show it.
 */
export function CheckDropdown({
    id,
    options,
    selected,
    onToggle,
    otherValue = "",
    onOtherChange,
    disabled = false,
    placeholder = "— Select —",
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) setOpen(false);
        };
        const onKeyDown = (event) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    const ticked = options.filter((option) => selected.includes(option));
    const summary = [...ticked, otherValue.trim() ? `Other: ${otherValue.trim()}` : null]
        .filter(Boolean)
        .join(", ");

    return (
        <div ref={rootRef} className="relative">
            <button
                id={id}
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className={cx(
                    selectClass,
                    "text-left",
                    !summary && "text-[#9ca3af]",
                    open && "border-brand",
                )}
            >
                <span className="block truncate">{summary || placeholder}</span>
            </button>

            {open ? (
                <div
                    role="listbox"
                    aria-multiselectable="true"
                    className="absolute top-[calc(100%+4px)] left-0 z-30 w-full rounded-[9px] border border-[#e5e7eb] bg-white p-2 shadow-[0_8px_24px_rgba(43,29,26,0.16)]"
                >
                    <div className="grid max-h-56 gap-1.5 overflow-y-auto">
                        {options.map((option) => (
                            <label
                                key={option}
                                className="flex cursor-pointer items-center gap-[7px] rounded-[7px] border border-[#e5e7eb] px-2.5 py-2 text-[11px] text-[#1f2937] hover:border-brand"
                            >
                                <input
                                    type="checkbox"
                                    className="size-3.5 shrink-0 accent-brand"
                                    checked={selected.includes(option)}
                                    onChange={() => onToggle(option)}
                                />
                                {option}
                            </label>
                        ))}

                        {/* Other: free text, kept as its own value. */}
                        <label className="flex items-center gap-[7px] rounded-[7px] border border-[#e5e7eb] px-2.5 py-1.5 text-[11px] text-[#1f2937] focus-within:border-brand">
                            <span className="shrink-0 font-semibold">Other:</span>
                            <input
                                type="text"
                                value={otherValue}
                                placeholder="Describe"
                                onChange={(event) => onOtherChange?.(event.target.value)}
                                className="w-full border-0 bg-transparent py-0.5 text-[11px] outline-none"
                            />
                        </label>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

/** A group panel in the ACF Contact Tracing form (`.pm-ct-group`). */
export function ContactGroup({ title, children }) {
    return (
        <section className="mt-[18px] rounded-[10px] border border-[#eee4e4] bg-white p-4 first:mt-0">
            <h4 className="mb-[13px] border-b border-[#f1e7e7] pb-[9px] text-[12.5px] font-extrabold text-[#363636]">
                {title}
            </h4>
            {children}
        </section>
    );
}

/* ── Register table skins ──────────────────────────────────────────────── */

export const tableCellClass =
    "border-r border-b border-shell px-3 py-[9px] text-center align-middle text-[#444]";
export const tableHeadClass =
    "border-r border-b-2 border-line-soft bg-[#faf7f7] px-3 py-2.5 text-center align-bottom text-[11px] leading-tight font-bold text-[#555]";
export const tableGroupHeadClass =
    "border-r border-b-2 border-line-soft bg-line-soft px-3 py-2.5 text-center align-bottom text-[11px] font-bold tracking-[0.3px] text-brand uppercase";
export const tableSubHeadClass =
    "border-r border-b-2 border-line-soft bg-[#faf7f7] px-3 py-2.5 text-center align-bottom text-[10px] font-bold text-[#666]";

/** The register checkbox, in the portal's accent. */
export function RegisterCheckbox({ checked, disabled, onChange, label }) {
    return (
        <input
            type="checkbox"
            aria-label={label}
            checked={Boolean(checked)}
            disabled={disabled}
            onChange={(event) => onChange?.(event.target.checked)}
            className="size-4 cursor-pointer accent-brand disabled:cursor-not-allowed disabled:opacity-50"
        />
    );
}

/** Compact select used inside register cells. */
export const registerSelectClass =
    "min-w-[110px] rounded border border-line bg-white px-2 py-1 text-[11px] text-[#555] outline-none focus:border-brand disabled:cursor-not-allowed disabled:bg-[#f8f8f8] disabled:opacity-70";

/** Compact text input used inside register cells. */
export const registerInputClass =
    "w-full min-w-[160px] rounded border border-line bg-white px-2 py-1 text-[11px] text-[#444] outline-none focus:border-brand disabled:cursor-not-allowed disabled:bg-[#f8f8f8] disabled:opacity-70";
