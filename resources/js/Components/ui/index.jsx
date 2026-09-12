import { useEffect } from "react";
import { FaMagnifyingGlass, FaXmark } from "react-icons/fa6";

/**
 * Tailwind primitives for the ICM screens converted from the portal mockup.
 *
 * Every recurring surface in that mockup — the white card, the red/outline
 * buttons, the toolbar search, the status pill, the modal shell — is defined
 * once here. Pages compose these instead of restating the same class strings,
 * which is what keeps the conversion from re-introducing the duplicated
 * styling the hand-written CSS had.
 */

export function cx(...classes) {
    return classes.filter(Boolean).join(" ");
}

export function Card({ as: Tag = "div", className = "", children, ...rest }) {
    return (
        <Tag
            className={cx(
                "rounded-xl bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]",
                className,
            )}
            {...rest}
        >
            {children}
        </Tag>
    );
}

const buttonBase =
    "inline-flex items-center justify-center gap-2 rounded-lg text-[13.5px] font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const buttonVariants = {
    primary: "bg-brand px-[18px] py-2.5 text-white hover:bg-brand-strong",
    secondary:
        "border-[1.5px] border-line bg-white px-4 py-[9px] text-[#555] hover:border-brand hover:text-brand",
    ghost: "px-3 py-2 text-muted hover:bg-shell hover:text-ink",
    danger: "bg-brand px-[18px] py-2.5 text-white hover:bg-brand-strong",
};

export function Button({
    as: Tag = "button",
    variant = "primary",
    className = "",
    children,
    ...rest
}) {
    return (
        <Tag
            className={cx(buttonBase, buttonVariants[variant], className)}
            {...(Tag === "button" ? { type: rest.type ?? "button" } : null)}
            {...rest}
        >
            {children}
        </Tag>
    );
}

/** The toolbar search box: magnifier, borderless input, optional clear. */
export function SearchInput({
    value,
    onChange,
    placeholder = "Search...",
    label,
    id,
    className = "",
}) {
    return (
        <div
            className={cx(
                "flex min-w-[200px] max-w-[340px] flex-1 items-center gap-2 rounded-lg border-[1.5px] border-line bg-white px-3.5 py-[9px] focus-within:border-brand",
                className,
            )}
        >
            <FaMagnifyingGlass className="size-[15px] shrink-0 text-[#aaa]" aria-hidden="true" />
            <label htmlFor={id} className="sr-only">
                {label ?? placeholder}
            </label>
            <input
                id={id}
                type="search"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="w-full border-none bg-transparent text-[13px] outline-none placeholder:text-[#aaa] [&::-webkit-search-cancel-button]:hidden"
            />
            {value ? (
                <button
                    type="button"
                    onClick={() => onChange("")}
                    aria-label="Clear search"
                    className="shrink-0 text-[#bbb] hover:text-brand"
                >
                    <FaXmark className="size-3.5" />
                </button>
            ) : null}
        </div>
    );
}

/** The white strip of controls that sits above a list or table. */
export function PageToolbar({ className = "", children }) {
    return (
        <div
            className={cx(
                "flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-white px-6 py-3",
                className,
            )}
        >
            {children}
        </div>
    );
}

const statusTones = {
    active: "bg-ok-soft text-ok",
    upcoming: "bg-info-soft text-info",
    completed: "bg-[#f0f0f0] text-muted",
    presumptive: "bg-brand-soft text-brand",
    normal: "bg-ok-soft text-ok",
    disabled: "bg-[#f0f0f0] text-muted",
};

export function StatusPill({ tone = "completed", className = "", children }) {
    return (
        <span
            className={cx(
                "inline-block rounded-full px-3 py-[3px] text-[11px] font-bold",
                statusTones[tone] ?? statusTones.completed,
                className,
            )}
        >
            {children}
        </span>
    );
}

/**
 * The register's Treatment Status cell: a coloured dot plus the label.
 *
 * Read-only by design — the status follows the treatment register (an open
 * TreatmentCase means "On Treatment"), so there is nothing here to edit. Shared
 * by the ICM program screen and the RHU Patient Tracker so both portals show
 * the same wording and the same colour for the same state.
 */
const treatmentStatusTones = {
    not_enrolled: "bg-brand-soft text-brand",
    enrolled: "bg-ok-soft text-ok",
    closed: "bg-[#f0f0f0] text-muted",
};

export function TreatmentStatus({ status, className = "" }) {
    const tone = treatmentStatusTones[status?.tone] ?? treatmentStatusTones.not_enrolled;

    return (
        <span
            className={cx(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-[3px] text-[11px] font-bold whitespace-nowrap",
                tone,
                className,
            )}
        >
            <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
            {status?.label ?? "Not yet Enrolled"}
        </span>
    );
}

/**
 * Modal shell: dim backdrop, click-outside and Escape to close, and a body
 * scroll lock while it is open.
 */
export function Modal({
    open,
    onClose,
    labelledBy,
    describedBy,
    locked = false,
    className = "",
    children,
}) {
    useEffect(() => {
        if (!open) return undefined;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key === "Escape" && !locked) onClose();
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, locked, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-500 flex items-center justify-center overflow-y-auto bg-black/45 p-4 font-ui"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !locked) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                aria-describedby={describedBy}
                className={cx(
                    "my-auto w-full rounded-2xl bg-white p-7 shadow-[0_20px_60px_rgba(0,0,0,0.2)]",
                    className || "max-w-[440px]",
                )}
            >
                {children}
            </div>
        </div>
    );
}

/**
 * Label + control + inline error, matching the mockup's `pm-*` form rows.
 *
 * `required` draws the red asterisk the reference form uses. It is marked
 * aria-hidden and paired with an sr-only word so the requirement is announced
 * rather than read out as "star".
 */
export function Field({
    label,
    htmlFor,
    error,
    hint,
    required = false,
    className = "",
    children,
}) {
    return (
        <div className={cx("mb-3.5", className)}>
            <label
                htmlFor={htmlFor}
                className="mb-1.5 block text-[11.5px] font-bold text-[#555]"
            >
                {label}
                {required ? (
                    <>
                        {/* The project primary, #d94f4f — the MUI theme's primary and the
                            colour every required marker carries. */}
                        <span className="text-[#d94f4f]" aria-hidden="true">
                            {" *"}
                        </span>
                        <span className="sr-only"> (required)</span>
                    </>
                ) : null}
            </label>
            {children}
            {hint && !error ? (
                <small className="mt-1 block text-[11.5px] text-muted">{hint}</small>
            ) : null}
            {error ? (
                <small className="mt-1 block text-[11.5px] font-semibold text-brand">
                    {error}
                </small>
            ) : null}
        </div>
    );
}

/**
 * Box geometry shared by every form control — editable, disabled or read-only.
 *
 * Kept separate so the read-only variants below are built from it rather than
 * restating it: a copied class string is how the autofilled boxes ended up a
 * different radius from the inputs beside them.
 */
export const controlBaseClass =
    "w-full rounded-md border-[1.5px] border-line px-3 py-[11px] text-[13.5px]";

/** Shared input/select skin so every form control in the conversion matches. */
export const controlClass = cx(
    controlBaseClass,
    "bg-white text-ink outline-none transition-colors focus:border-brand disabled:cursor-not-allowed disabled:bg-[#f8f8f8] disabled:text-muted",
);

/**
 * A value the form fills in and the user cannot change — the enrolment modal's
 * patient particulars and diagnostic results. Same box as the editable
 * controls, greyed to read as not-editable.
 */
export const readOnlyControlClass = cx(controlBaseClass, "bg-[#f8f8f8] break-words");

/**
 * Select skin. A native select paints its arrow hard against the right edge,
 * so `appearance-none` replaces it with the chevron from `.cl-select-arrow`
 * (positioned with a gutter) and `pr-9` keeps the option text clear of it.
 */
export const selectClass = cx(controlClass, "cl-select-arrow appearance-none pr-9");

/**
 * Underlined tab strip for a record's sections. Shared: the RHU treatment
 * record and the ICM contact-tracing view both use it, with different tabs.
 */
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

/** Section heading inside a record form or panel. */
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

/** Label/value grid used by both portals' Patient Summary. */
export function InfoSummary({ items }) {
    return (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-[18px] sm:grid-cols-2 xl:grid-cols-4">
            {items.filter(Boolean).map((item) => (
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

/** A group panel in the ACF Contact Tracing form, editable or read-only. */
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

/**
 * Underlined tab strip for a record's sections. Shared: the RHU treatment
 * record and the ICM contact-tracing view both use it, with different tabs.
 */
export function EmptyState({ icon, title, description, children }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            {icon ? (
                <span className="mb-1 flex size-14 items-center justify-center rounded-full bg-shell text-2xl text-brand">
                    {icon}
                </span>
            ) : null}
            <h3 className="text-[15px] font-bold text-ink">{title}</h3>
            {description ? (
                <p className="max-w-[420px] text-[13px] text-muted">{description}</p>
            ) : null}
            {children}
        </div>
    );
}

export { ToastProvider, useToast } from "./Toast";
