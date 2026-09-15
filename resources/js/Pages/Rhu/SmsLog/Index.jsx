import { useState } from "react";
import { FaCircleCheck, FaEnvelope, FaMagnifyingGlass, FaPlus } from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Button, Card, Field, Modal, controlClass, cx } from "@/Components/ui";

const tabs = [
    { value: "patients", label: "Patients" },
    { value: "bhws", label: "BHWs" },
];

function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? "";
}

async function apiRequest(method, url, payload) {
    const response = await fetch(url, {
        method,
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-CSRF-TOKEN": csrfToken(),
        },
        credentials: "same-origin",
        body: JSON.stringify(payload ?? {}),
    });

    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }

    if (!response.ok) {
        const errors = data?.errors
            ? Object.fromEntries(
                  Object.entries(data.errors).map(([key, messages]) => [
                      key,
                      Array.isArray(messages) ? messages[0] : messages,
                  ]),
              )
            : {};
        const error = new Error(data?.message ?? "The message could not be sent.");
        error.errors = errors;
        throw error;
    }

    return data;
}

function formatSentAt(iso) {
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(iso));
}

/**
 * Recipients are either an enrolled patient or a BHW contact — never both,
 * per StoreSmsLogRequest — so selection is single-select, keyed by
 * "<type>-<id>" since patient and BHW ids can collide.
 */
export default function Index({ municipality, recipients: initialRecipients, history: initialHistory }) {
    const [tab, setTab] = useState("patients");
    const [search, setSearch] = useState("");
    const [selectedKey, setSelectedKey] = useState(null);
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [errors, setErrors] = useState({});
    const [history, setHistory] = useState(initialHistory);
    const [recipients, setRecipients] = useState(initialRecipients);

    const [bhwModalOpen, setBhwModalOpen] = useState(false);
    const [bhwForm, setBhwForm] = useState({ name: "", contact_number: "", address: "" });
    const [bhwSaving, setBhwSaving] = useState(false);
    const [bhwErrors, setBhwErrors] = useState({});

    const openBhwModal = () => {
        setBhwForm({ name: "", contact_number: "", address: "" });
        setBhwErrors({});
        setBhwModalOpen(true);
    };

    const submitBhw = async (event) => {
        event.preventDefault();
        if (bhwSaving) return;

        setBhwSaving(true);
        setBhwErrors({});

        try {
            const data = await apiRequest("POST", route("rhu.bhws.store"), bhwForm);
            setRecipients((current) => [
                ...current,
                { ...data.bhw, type: "bhw" },
            ]);
            setBhwModalOpen(false);
        } catch (error) {
            setBhwErrors(error.errors ?? { name: error.message });
        } finally {
            setBhwSaving(false);
        }
    };

    const tabType = tab === "patients" ? "patient" : "bhw";

    const filteredRecipients = recipients.filter((recipient) => {
        if (recipient.type !== tabType) return false;

        const term = search.trim().toLowerCase();
        if (!term) return true;
        return (
            recipient.name.toLowerCase().includes(term) ||
            recipient.contact_number?.toLowerCase().includes(term)
        );
    });

    const switchTab = (nextTab) => {
        setTab(nextTab);
        setSearch("");
    };

    const selected = recipients.find(
        (recipient) => `${recipient.type}-${recipient.id}` === selectedKey,
    );

    const submit = async (event) => {
        event.preventDefault();
        if (!selected || sending) return;

        setSending(true);
        setErrors({});

        try {
            const payload = {
                message,
                ...(selected.type === "patient"
                    ? { patient_id: selected.id }
                    : { bhw_id: selected.id }),
            };
            const data = await apiRequest("POST", route("rhu.sms-logs.store"), payload);
            setHistory((current) => [data.log, ...current]);
            setMessage("");
            setSelectedKey(null);
        } catch (error) {
            setErrors(error.errors ?? { message: error.message });
        } finally {
            setSending(false);
        }
    };

    return (
        <DashboardLayout role="rhu" title="SMS Log">
            <div className="font-ui">
                <Card className="mb-6 px-6 py-[22px]">
                    <div className="mb-1.5 flex items-center gap-3">
                        <span
                            className="flex size-9 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-[#f5c6c6] bg-brand-soft text-brand"
                            aria-hidden="true"
                        >
                            <FaEnvelope className="size-[18px]" />
                        </span>
                        <h2 className="text-lg font-bold text-ink">Active TB Case Alerts</h2>
                    </div>
                    <p className="mb-[18px] pl-12 text-[12.5px] text-muted">
                        Notify confirmed TB patients for treatment initiation and follow-up
                        monitoring{municipality ? ` in ${municipality}` : ""}.
                    </p>

                    <form
                        onSubmit={submit}
                        className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.4fr]"
                    >
                        <div className="overflow-hidden rounded-[10px] border border-line">
                            <div className="flex gap-1 rounded-[10px] bg-shell p-1 m-2.5">
                                {tabs.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => switchTab(option.value)}
                                        className={cx(
                                            "flex-1 rounded-lg py-1.5 text-[12.5px] font-semibold transition-colors",
                                            tab === option.value
                                                ? "bg-white text-ink shadow-sm"
                                                : "text-muted hover:text-ink",
                                        )}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-2 border-b border-line-soft px-3 py-2.5">
                                <FaMagnifyingGlass
                                    className="size-[15px] shrink-0 text-[#aaa]"
                                    aria-hidden="true"
                                />
                                <label htmlFor="sms-search" className="sr-only">
                                    Search contact
                                </label>
                                <input
                                    id="sms-search"
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search contact"
                                    className="w-full border-0 bg-transparent text-[13px] outline-none"
                                />
                            </div>

                            <div className="max-h-[340px] overflow-y-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-[#faf7f7]">
                                            {(tab === "bhws"
                                                ? ["Contact No.", "Name", "Address", "Select"]
                                                : ["Contact No.", "Name", "Select"]
                                            ).map((heading) => (
                                                <th
                                                    key={heading}
                                                    className="px-3 py-[9px] text-left text-[11px] font-semibold text-[#666] uppercase last:text-center"
                                                >
                                                    {heading}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecipients.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={tab === "bhws" ? 4 : 3}
                                                    className="px-4 py-10 text-center text-[12.5px] text-muted"
                                                >
                                                    {tab === "bhws"
                                                        ? "No matching BHWs with a contact number."
                                                        : "No matching patients with a contact number."}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRecipients.map((recipient) => {
                                                const key = `${recipient.type}-${recipient.id}`;
                                                return (
                                                    <tr key={key} className="hover:bg-[#fdf8f8]">
                                                        <td className="border-t border-shell px-3 py-[9px] text-[13px] text-[#333]">
                                                            {recipient.contact_number}
                                                        </td>
                                                        <td className="border-t border-shell px-3 py-[9px] text-[13px] text-[#333]">
                                                            {recipient.name}
                                                        </td>
                                                        {tab === "bhws" ? (
                                                            <td className="border-t border-shell px-3 py-[9px] text-[13px] text-[#333]">
                                                                {recipient.address || "—"}
                                                            </td>
                                                        ) : null}
                                                        <td className="border-t border-shell px-3 py-[9px] text-center">
                                                            <input
                                                                type="radio"
                                                                name="recipient"
                                                                aria-label={`Select ${recipient.name}`}
                                                                className="size-4 accent-brand"
                                                                checked={selectedKey === key}
                                                                onChange={() =>
                                                                    setSelectedKey(key)
                                                                }
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {tab === "bhws" ? (
                                <div className="border-t border-line-soft p-2.5">
                                    <button
                                        type="button"
                                        onClick={openBhwModal}
                                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-strong"
                                    >
                                        <FaPlus className="size-3" aria-hidden="true" />
                                        Add Contact
                                    </button>
                                </div>
                            ) : null}
                        </div>

                        <div className="flex flex-col gap-3">
                            <label htmlFor="sms-message" className="sr-only">
                                Message
                            </label>
                            <textarea
                                id="sms-message"
                                rows={8}
                                value={message}
                                onChange={(event) => setMessage(event.target.value)}
                                placeholder="e.g., Good day! You are advised to return to the RHU for further TB testing."
                                className="min-h-[130px] w-full resize-y rounded-[10px] border border-line bg-white p-[14px] text-[13px] text-[#333] outline-none focus:border-brand"
                            />

                            {selected ? (
                                <p className="text-[12px] text-muted">
                                    Sending to <span className="font-semibold">{selected.name}</span>{" "}
                                    ({selected.contact_number})
                                </p>
                            ) : null}

                            {errors.message ? (
                                <p role="alert" className="text-[12px] font-semibold text-brand">
                                    {errors.message}
                                </p>
                            ) : null}
                            {errors.patient_id || errors.bhw_id ? (
                                <p role="alert" className="text-[12px] font-semibold text-brand">
                                    {errors.patient_id ?? errors.bhw_id}
                                </p>
                            ) : null}

                            <button
                                type="submit"
                                disabled={sending || !selected || !message.trim()}
                                className="self-start rounded-lg bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {sending ? "Sending…" : "Send Message"}
                            </button>
                        </div>
                    </form>
                </Card>

                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-[13px] font-bold tracking-[0.4px] text-ink uppercase">
                        Message History
                    </h3>
                </div>

                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-[#faf7f7]">
                                    {["Recipient", "Contact", "Message", "Date Sent", "Status"].map(
                                        (heading) => (
                                            <th
                                                key={heading}
                                                className="px-4 py-3 text-left text-[11px] font-semibold text-[#666] uppercase"
                                            >
                                                {heading}
                                            </th>
                                        ),
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {history.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-4 py-12 text-center text-[13px] text-muted"
                                        >
                                            No messages have been sent yet.
                                        </td>
                                    </tr>
                                ) : (
                                    history.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-[#fdf8f8]">
                                            <td className="border-t border-shell px-4 py-3 text-[13px] whitespace-nowrap text-[#333]">
                                                {entry.recipient}
                                            </td>
                                            <td className="border-t border-shell px-4 py-3 text-[13px] whitespace-nowrap text-[#333]">
                                                {entry.contact_number}
                                            </td>
                                            <td className="border-t border-shell px-4 py-3 text-[13px] text-[#333]">
                                                {entry.message}
                                            </td>
                                            <td className="border-t border-shell px-4 py-3 text-[13px] whitespace-nowrap text-[#666]">
                                                {formatSentAt(entry.sent_at)}
                                            </td>
                                            <td className="border-t border-shell px-4 py-3">
                                                <span
                                                    className={cx(
                                                        "inline-flex items-center gap-1.5 text-[12px] font-semibold text-ok",
                                                    )}
                                                >
                                                    <FaCircleCheck
                                                        className="size-3.5"
                                                        aria-hidden="true"
                                                    />
                                                    Sent
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            <Modal
                open={bhwModalOpen}
                onClose={() => setBhwModalOpen(false)}
                locked={bhwSaving}
                labelledBy="bhw-dialog-title"
                className="max-w-[420px]"
            >
                <h2 id="bhw-dialog-title" className="mb-1 text-[17px] font-bold text-ink">
                    Add BHW Contact
                </h2>
                <p className="mb-5 text-[13px] text-muted">
                    Barangay health worker contacts appear here as SMS recipients
                    alongside enrolled patients.
                </p>

                <form onSubmit={submitBhw} noValidate>
                    <Field label="Name" htmlFor="bhw-name" error={bhwErrors.name}>
                        <input
                            id="bhw-name"
                            type="text"
                            className={controlClass}
                            value={bhwForm.name}
                            onChange={(event) =>
                                setBhwForm((current) => ({ ...current, name: event.target.value }))
                            }
                            placeholder="e.g. Juana Dela Cruz"
                            autoComplete="off"
                        />
                    </Field>

                    <Field
                        label="Contact Number"
                        htmlFor="bhw-contact"
                        error={bhwErrors.contact_number}
                    >
                        <input
                            id="bhw-contact"
                            type="text"
                            className={controlClass}
                            value={bhwForm.contact_number}
                            onChange={(event) =>
                                setBhwForm((current) => ({
                                    ...current,
                                    contact_number: event.target.value,
                                }))
                            }
                            placeholder="e.g. 0917 123 4567"
                            autoComplete="off"
                        />
                    </Field>

                    <Field
                        label="Address (optional)"
                        htmlFor="bhw-address"
                        error={bhwErrors.address}
                    >
                        <input
                            id="bhw-address"
                            type="text"
                            className={controlClass}
                            value={bhwForm.address}
                            onChange={(event) =>
                                setBhwForm((current) => ({ ...current, address: event.target.value }))
                            }
                            placeholder="e.g. Barangay Poblacion"
                            autoComplete="off"
                        />
                    </Field>

                    <div className="mt-1.5 flex justify-end gap-2.5">
                        <Button
                            variant="secondary"
                            onClick={() => setBhwModalOpen(false)}
                            disabled={bhwSaving}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={bhwSaving}>
                            {bhwSaving ? "Adding…" : "Add BHW"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
