import { router, useForm } from "@inertiajs/react";
import { useState } from "react";
import { FaCircleCheck, FaEnvelope, FaMagnifyingGlass, FaPlus } from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Button, Card, Field, Modal, controlClass, cx, useToast } from "@/Components/ui";

/**
 * SMS Log — "Active TB Case Alerts" from the reference.
 *
 * No SMS gateway is configured in CareLink, so sending records the notice
 * against the recipient and writes it to the activity log, exactly as the
 * provider portal's patient-notify action already does. The history table below
 * reads that log back. The banner says so rather than showing invented delivery
 * receipts.
 *
 * Recipients come from two lists the box at the left toggles between: the
 * RHU's confirmed TB patients, and the Barangay Health Worker contacts the RHU
 * keeps itself. Ticks made on either list stay made while the other is
 * showing, and Send goes to everything ticked — the line above the button
 * says how many of each so nothing leaves unseen.
 */
const MODES = [
    { value: "patients", label: "Patients" },
    { value: "bhws", label: "BHWs" },
];

export default function Index({ recipients, bhws, history, filters, municipality }) {
    const toast = useToast();
    const [search, setSearch] = useState(filters.search ?? "");
    const [historySearch, setHistorySearch] = useState(filters.history ?? "");
    const [mode, setMode] = useState("patients");
    const [addingBhw, setAddingBhw] = useState(false);

    const form = useForm({ patients: [], bhws: [], message: "" });
    const bhwForm = useForm({ name: "", address: "", contact_number: "" });

    const visit = (next = {}) =>
        router.get(
            route("rhu.sms.index"),
            {
                search: (next.search ?? search).trim() || undefined,
                history: (next.history ?? historySearch).trim() || undefined,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );

    const toggle = (key, id) =>
        form.setData(
            key,
            form.data[key].includes(id)
                ? form.data[key].filter((value) => value !== id)
                : [...form.data[key], id],
        );

    const selectedCount = form.data.patients.length + form.data.bhws.length;
    const recipientError = form.errors.patients ?? form.errors.bhws;

    const submit = (event) => {
        event.preventDefault();
        form.post(route("rhu.sms.store"), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                toast.success(
                    `${selectedCount} alert(s) logged for the selected recipient(s)`,
                );
            },
        });
    };

    const openAddBhw = () => {
        bhwForm.clearErrors();
        bhwForm.reset();
        setAddingBhw(true);
    };

    const closeAddBhw = () => {
        if (bhwForm.processing) return;
        setAddingBhw(false);
    };

    const submitBhw = (event) => {
        event.preventDefault();
        bhwForm.post(route("rhu.sms.bhws.store"), {
            preserveScroll: true,
            onSuccess: () => {
                const name = bhwForm.data.name.trim();
                bhwForm.reset();
                setAddingBhw(false);
                toast.success(`${name} has been added to the BHW contact list`);
            },
            onError: () =>
                toast.error("Could not add the contact. Please check the form and try again."),
        });
    };

    const showingPatients = mode === "patients";
    const headings = showingPatients
        ? ["Patient Contact", "Patient Name", "Select"]
        : ["Contact No.", "Name", "Address", "Select"];

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
                        Notify confirmed TB patients and barangay health workers for treatment
                        initiation and follow-up monitoring
                        {municipality ? ` in ${municipality}` : ""}.
                    </p>

                    <p className="mb-4 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-[12px] text-[#8a5a00]">
                        No SMS gateway is connected to CareLink. Sending records the alert
                        against the recipient and writes it to the activity log below — it does
                        not transmit a text message.
                    </p>

                    <form
                        onSubmit={submit}
                        className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.4fr]"
                    >
                        <div className="overflow-hidden rounded-[10px] border border-line">
                            {/* Patients / BHWs — the reference's segmented toggle
                                above the contact list. */}
                            <div
                                role="tablist"
                                aria-label="Recipient list"
                                className="mx-2.5 mt-2.5 flex gap-1.5 rounded-lg bg-[#f5f0f0] p-1.5"
                            >
                                {MODES.map((option) => {
                                    const active = mode === option.value;
                                    const count =
                                        option.value === "patients"
                                            ? form.data.patients.length
                                            : form.data.bhws.length;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            role="tab"
                                            aria-selected={active}
                                            onClick={() => setMode(option.value)}
                                            className={cx(
                                                "flex flex-1 items-center justify-center gap-1.5 rounded-[7px] px-2.5 py-2 text-[12.5px] font-bold transition-colors",
                                                active
                                                    ? "bg-white text-brand shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                                                    : "text-[#888] hover:text-[#555]",
                                            )}
                                        >
                                            {option.label}
                                            {count > 0 ? (
                                                <span
                                                    className={cx(
                                                        "rounded-full px-1.5 py-px text-[10.5px] font-bold",
                                                        active
                                                            ? "bg-brand-soft text-brand"
                                                            : "bg-white text-[#777]",
                                                    )}
                                                >
                                                    {count}
                                                </span>
                                            ) : null}
                                        </button>
                                    );
                                })}
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
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            visit();
                                        }
                                    }}
                                    onBlur={() => visit()}
                                    placeholder="Search contact"
                                    className="w-full border-0 bg-transparent text-[13px] outline-none"
                                />
                            </div>

                            <div className="max-h-[340px] overflow-y-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr className="bg-[#faf7f7]">
                                            {headings.map((heading) => (
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
                                        {showingPatients ? (
                                            recipients.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={3}
                                                        className="px-4 py-10 text-center text-[12.5px] text-muted"
                                                    >
                                                        No confirmed TB patients with a contact
                                                        number yet.
                                                    </td>
                                                </tr>
                                            ) : (
                                                recipients.map((recipient) => (
                                                    <tr
                                                        key={recipient.id}
                                                        className="hover:bg-[#fdf8f8]"
                                                    >
                                                        <td className="border-t border-shell px-3 py-[9px] text-[13px] text-[#333]">
                                                            {recipient.contact_number}
                                                        </td>
                                                        <td className="border-t border-shell px-3 py-[9px] text-[13px] text-[#333]">
                                                            {recipient.name}
                                                            {recipient.last_notified_label ? (
                                                                <span className="block text-[10.5px] text-muted">
                                                                    Last alert:{" "}
                                                                    {recipient.last_notified_label}
                                                                </span>
                                                            ) : null}
                                                        </td>
                                                        <td className="border-t border-shell px-3 py-[9px] text-center">
                                                            <input
                                                                type="checkbox"
                                                                aria-label={`Select ${recipient.name}`}
                                                                className="size-4 accent-brand"
                                                                checked={form.data.patients.includes(
                                                                    recipient.id,
                                                                )}
                                                                onChange={() =>
                                                                    toggle("patients", recipient.id)
                                                                }
                                                            />
                                                        </td>
                                                    </tr>
                                                ))
                                            )
                                        ) : bhws.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={4}
                                                    className="px-4 py-10 text-center text-[12.5px] text-muted"
                                                >
                                                    No BHW contacts added yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            bhws.map((bhw) => (
                                                <tr key={bhw.id} className="hover:bg-[#fdf8f8]">
                                                    <td className="border-t border-shell px-3 py-[9px] text-[13px] whitespace-nowrap text-[#333]">
                                                        {bhw.contact_number}
                                                    </td>
                                                    <td className="border-t border-shell px-3 py-[9px] text-[13px] text-[#333]">
                                                        {bhw.name}
                                                        {bhw.last_notified_label ? (
                                                            <span className="block text-[10.5px] text-muted">
                                                                Last alert: {bhw.last_notified_label}
                                                            </span>
                                                        ) : null}
                                                    </td>
                                                    <td className="border-t border-shell px-3 py-[9px] text-[12.5px] text-[#555]">
                                                        {bhw.address || "—"}
                                                    </td>
                                                    <td className="border-t border-shell px-3 py-[9px] text-center">
                                                        <input
                                                            type="checkbox"
                                                            aria-label={`Select ${bhw.name}`}
                                                            className="size-4 accent-brand"
                                                            checked={form.data.bhws.includes(bhw.id)}
                                                            onChange={() => toggle("bhws", bhw.id)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {!showingPatients ? (
                                <div className="border-t border-line-soft p-2.5">
                                    <Button
                                        variant="secondary"
                                        onClick={openAddBhw}
                                        className="w-full"
                                    >
                                        <FaPlus className="size-3" aria-hidden="true" />
                                        Add Contact
                                    </Button>
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
                                value={form.data.message}
                                onChange={(event) => form.setData("message", event.target.value)}
                                placeholder="e.g., Good day! You are advised to return to the RHU for further TB testing."
                                className="min-h-[130px] w-full resize-y rounded-[10px] border border-line bg-white p-[14px] text-[13px] text-[#333] outline-none focus:border-brand"
                            />

                            {form.errors.message ? (
                                <p role="alert" className="text-[12px] font-semibold text-brand">
                                    {form.errors.message}
                                </p>
                            ) : null}
                            {recipientError ? (
                                <p role="alert" className="text-[12px] font-semibold text-brand">
                                    {recipientError}
                                </p>
                            ) : null}

                            <p className="text-[12px] text-muted" aria-live="polite">
                                {selectedCount === 0
                                    ? "No recipients selected."
                                    : `Sending to ${form.data.patients.length} patient(s) and ${form.data.bhws.length} BHW(s).`}
                            </p>

                            <button
                                type="submit"
                                disabled={form.processing || selectedCount === 0}
                                className="self-start rounded-lg bg-brand px-[18px] py-2.5 text-[13.5px] font-semibold text-white hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {form.processing ? "Logging…" : "Send Message"}
                            </button>
                        </div>
                    </form>
                </Card>

                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-[13px] font-bold tracking-[0.4px] text-ink uppercase">
                        Message History
                    </h3>
                    <div className="flex min-w-[220px] items-center gap-2 rounded-lg border border-line bg-white px-3.5 py-2">
                        <FaMagnifyingGlass
                            className="size-[15px] shrink-0 text-[#aaa]"
                            aria-hidden="true"
                        />
                        <label htmlFor="sms-history-search" className="sr-only">
                            Search messages
                        </label>
                        <input
                            id="sms-history-search"
                            type="search"
                            value={historySearch}
                            onChange={(event) => setHistorySearch(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") visit();
                            }}
                            onBlur={() => visit()}
                            placeholder="Search messages..."
                            className="w-full border-0 bg-transparent text-[13px] outline-none"
                        />
                    </div>
                </div>

                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-[#faf7f7]">
                                    {["Recipient", "Message", "Date Logged", "Status"].map(
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
                                            colSpan={4}
                                            className="px-4 py-12 text-center text-[13px] text-muted"
                                        >
                                            No alerts have been logged yet.
                                        </td>
                                    </tr>
                                ) : (
                                    history.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-[#fdf8f8]">
                                            <td className="border-t border-shell px-4 py-3 text-[13px] whitespace-nowrap text-[#333]">
                                                {entry.contact_number}
                                                {entry.recipient_name ? (
                                                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                                                        {entry.recipient_name}
                                                        {entry.recipient_type === "bhw" ? (
                                                            <span className="rounded-full bg-brand-soft px-1.5 py-px text-[10px] font-bold tracking-[0.3px] text-brand uppercase">
                                                                BHW
                                                            </span>
                                                        ) : null}
                                                    </span>
                                                ) : null}
                                            </td>
                                            <td className="border-t border-shell px-4 py-3 text-[13px] text-[#333]">
                                                {entry.message}
                                            </td>
                                            <td className="border-t border-shell px-4 py-3 text-[13px] whitespace-nowrap text-[#666]">
                                                {entry.sent_at_label}
                                            </td>
                                            <td className="border-t border-shell px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ok">
                                                    <FaCircleCheck
                                                        className="size-3.5"
                                                        aria-hidden="true"
                                                    />
                                                    Logged
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

            {/* The reference's "Add BHW Contact" dialog. */}
            <Modal
                open={addingBhw}
                onClose={closeAddBhw}
                locked={bhwForm.processing}
                labelledBy="bhw-contact-title"
                describedBy="bhw-contact-description"
                className="max-w-[440px]"
            >
                <h2 id="bhw-contact-title" className="mb-1 text-[17px] font-bold text-ink">
                    Add BHW Contact
                </h2>
                <p id="bhw-contact-description" className="mb-5 text-[13px] text-muted">
                    Enter the barangay health worker's details to add them to the contact
                    list{municipality ? ` for ${municipality}` : ""}.
                </p>

                <form onSubmit={submitBhw} noValidate>
                    <Field
                        label="Full Name"
                        htmlFor="bhw-name"
                        required
                        error={bhwForm.errors.name}
                    >
                        <input
                            id="bhw-name"
                            autoFocus
                            className={controlClass}
                            value={bhwForm.data.name}
                            onChange={(event) => bhwForm.setData("name", event.target.value)}
                            placeholder="Enter full name"
                            autoComplete="off"
                        />
                    </Field>

                    <Field label="Address" htmlFor="bhw-address" error={bhwForm.errors.address}>
                        <input
                            id="bhw-address"
                            className={controlClass}
                            value={bhwForm.data.address}
                            onChange={(event) => bhwForm.setData("address", event.target.value)}
                            placeholder="e.g. Brgy. Poblacion"
                            autoComplete="off"
                        />
                    </Field>

                    <Field
                        label="Contact No."
                        htmlFor="bhw-contact"
                        required
                        error={bhwForm.errors.contact_number}
                    >
                        <input
                            id="bhw-contact"
                            type="tel"
                            inputMode="tel"
                            className={controlClass}
                            value={bhwForm.data.contact_number}
                            onChange={(event) =>
                                bhwForm.setData("contact_number", event.target.value)
                            }
                            placeholder="e.g., 09456732458"
                            autoComplete="off"
                        />
                    </Field>

                    <div className="mt-1.5 flex justify-end gap-2.5">
                        <Button
                            variant="secondary"
                            onClick={closeAddBhw}
                            disabled={bhwForm.processing}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={bhwForm.processing}>
                            {bhwForm.processing ? "Adding…" : "Add Contact"}
                        </Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
