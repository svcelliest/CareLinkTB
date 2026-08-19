import { useState } from "react";
import { FaArrowRightFromBracket, FaCheck } from "react-icons/fa6";

export default function LogoutModal({ isOpen, onClose, portalLabel }) {
    const [processing, setProcessing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState("");

    const handleConfirm = async () => {
        setProcessing(true);
        setError("");

        try {
            const csrfToken = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute("content");

            const response = await fetch(route("logout"), {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    Accept: "text/html, application/xhtml+xml",
                    "X-Requested-With": "XMLHttpRequest",
                    ...(csrfToken ? { "X-CSRF-TOKEN": csrfToken } : {}),
                },
            });

            if (!response.ok && !response.redirected) {
                throw new Error("Logout failed.");
            }

            setShowSuccess(true);
            window.setTimeout(() => {
                window.location.assign("/");
            }, 1400);
        } catch (logoutError) {
            setError("Logout failed. Please try again.");
            setProcessing(false);
        }
    };

    return (
        <div
            className={`logout-modal-overlay ${isOpen ? "active" : ""}`}
            onClick={(e) => {
                if (e.target === e.currentTarget && !showSuccess) onClose();
            }}
        >
            <div className="logout-modal-card">
                {!showSuccess ? (
                    <>
                        <div className="logout-modal-icon">
                            <FaArrowRightFromBracket />
                        </div>

                        <h2 className="logout-modal-title">Log Out</h2>
                        <p className="logout-modal-text">
                            Are you sure you want to log out of the
                            <br />
                            CareLink TB {portalLabel}?
                        </p>
                        {error && <p className="logout-modal-error">{error}</p>}

                        <div className="logout-modal-actions">
                            <button
                                className="logout-btn-cancel"
                                onClick={onClose}
                                disabled={processing}
                            >
                                Cancel
                            </button>
                            <button
                                className="logout-btn-confirm"
                                onClick={handleConfirm}
                                disabled={processing}
                            >
                                <FaArrowRightFromBracket />
                                {processing ? "Logging out…" : "Yes, Log Out"}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="logout-success-icon">
                            <FaCheck />
                        </div>

                        <h2 className="logout-modal-title">
                            Logged Out Successfully
                        </h2>
                        <p className="logout-modal-text">
                            You have been logged out. Redirecting to the home
                            page.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
