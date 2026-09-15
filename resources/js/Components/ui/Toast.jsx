import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    FaCircleCheck,
    FaCircleExclamation,
    FaCircleInfo,
    FaXmark,
} from "react-icons/fa6";

/**
 * Local copy of the `cx` in `./index` rather than an import of it.
 *
 * `./index` re-exports this file, so importing back from it would make the
 * pair circular — and a circular module holding a React context can be
 * evaluated twice, which yields two contexts: the provider publishes to one
 * and `useToast` reads the other, so every toast silently goes nowhere.
 */
function cx(...classes) {
    return classes.filter(Boolean).join(" ");
}

/**
 * The portal's one toast notification.
 *
 * Every portal mounts this through `DashboardLayout`, so Provider, ICM and RHU
 * all raise the same surface for the same kind of event — the reason this is a
 * shared component rather than the per-page markup the account and RHU forms
 * used to carry (`.account-profile-toast`, `.rhu-forms-toast`), which had
 * drifted into three slightly different boxes.
 *
 * Colours, radius and shadow come from the design tokens in `app.css`, so a
 * toast reads as part of the same system as the status pills beside it.
 *
 * Usage:
 *
 *     const toast = useToast();
 *     toast.success("Patient added successfully");
 *     toast.error("Could not add the patient. Please try again.");
 *
 * Raise a success toast from an action's `onSuccess` — never before the
 * request has actually landed.
 */

const ToastContext = createContext(null);

const DEFAULT_DURATION = 3600;

/** Tone → icon + skin. Mirrors the status accents used across the portals. */
const tones = {
    success: {
        Icon: FaCircleCheck,
        box: "border-ok/35 bg-ok-soft text-[#24723a]",
        icon: "text-ok",
    },
    error: {
        Icon: FaCircleExclamation,
        box: "border-brand/30 bg-brand-soft text-[#a42f26]",
        icon: "text-brand",
    },
    info: {
        Icon: FaCircleInfo,
        box: "border-info/30 bg-info-soft text-[#1d4ed8]",
        icon: "text-info",
    },
};

function ToastCard({ toast, onDismiss }) {
    const { Icon, box, icon } = tones[toast.tone] ?? tones.success;

    return (
        <div
            role={toast.tone === "error" ? "alert" : "status"}
            className={cx(
                "cl-toast pointer-events-auto flex w-full items-start gap-2.5 rounded-[9px] border px-3.5 py-3 font-ui text-[12.5px] leading-snug font-semibold shadow-[0_8px_24px_rgba(43,29,26,0.16)]",
                box,
            )}
        >
            <Icon className={cx("mt-px size-4 shrink-0", icon)} aria-hidden="true" />
            <span className="min-w-0 flex-1 break-words">{toast.message}</span>
            <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
                className="-mr-1 shrink-0 rounded p-0.5 opacity-55 transition-opacity hover:opacity-100"
            >
                <FaXmark className="size-3" />
            </button>
        </div>
    );
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    // Timers are cleared on unmount so a toast raised right before a page
    // change cannot fire setState on a gone component.
    const timers = useRef(new Map());

    const dismiss = useCallback((id) => {
        const timer = timers.current.get(id);
        if (timer) {
            window.clearTimeout(timer);
            timers.current.delete(id);
        }
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    useEffect(
        () => () => {
            timers.current.forEach((timer) => window.clearTimeout(timer));
            timers.current.clear();
        },
        [],
    );

    const push = useCallback(
        (tone, message, { duration = DEFAULT_DURATION } = {}) => {
            if (!message) return undefined;

            const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            // Cap the stack so a burst of actions cannot cover the screen.
            setToasts((current) => [...current.slice(-2), { id, tone, message }]);
            timers.current.set(
                id,
                window.setTimeout(() => dismiss(id), duration),
            );

            return id;
        },
        [dismiss],
    );

    const value = useMemo(
        () => ({
            push,
            dismiss,
            success: (message, options) => push("success", message, options),
            error: (message, options) => push("error", message, options),
            info: (message, options) => push("info", message, options),
        }),
        [push, dismiss],
    );

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div
                aria-live="polite"
                className="pointer-events-none fixed top-[76px] right-6 z-[900] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2"
            >
                {toasts.map((toast) => (
                    <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

/**
 * Never throws when there is no provider above it — a page rendered outside
 * `DashboardLayout` (the landing screen) gets a no-op instead of a crash.
 */
const noop = {
    push: () => undefined,
    dismiss: () => undefined,
    success: () => undefined,
    error: () => undefined,
    info: () => undefined,
};

export function useToast() {
    return useContext(ToastContext) ?? noop;
}
