import { useEffect } from "react";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";

/**
 * Confirm / success dialog used across the provider portal, matching the
 * reference portal's `showModal()` overlay rather than the browser's native
 * confirm(). `type` picks the icon treatment: amber warning for a confirm,
 * green check for a success acknowledgement.
 *
 * A button may set `loading` to show an inline spinner and block repeat
 * presses while its request is in flight.
 */
export default function ProviderModal({
    open,
    type = "confirm",
    title,
    body,
    buttons = [],
    onDismiss,
}) {
    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
            if (event.key === "Escape") onDismiss?.();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onDismiss]);

    if (!open) return null;

    return (
        <div
            className="modal-overlay visible"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(event) => {
                if (event.target === event.currentTarget) onDismiss?.();
            }}
        >
            <div className="modal-box">
                {/* both icons are sized by `.modal-icon svg`; only the tint
                    differs, matching the panel behind them */}
                <div className={`modal-icon ${type}`}>
                    {type === "success" ? (
                        <CheckCircleOutlineRoundedIcon
                            sx={{ color: "#27ae60" }}
                        />
                    ) : (
                        <WarningAmberRoundedIcon sx={{ color: "#e67e22" }} />
                    )}
                </div>
                <div className="modal-title">{title}</div>
                <div className="modal-body">{body}</div>
                <div className="modal-btn-group">
                    {buttons.map((button) => (
                        <button
                            key={button.label}
                            type="button"
                            className={`modal-btn ${button.cls}`}
                            onClick={button.onClick}
                            disabled={button.loading || button.disabled}
                        >
                            {button.loading && (
                                <span
                                    className="action-spinner"
                                    aria-hidden="true"
                                />
                            )}
                            {button.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
