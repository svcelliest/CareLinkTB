import { router, useForm } from "@inertiajs/react";
import { useState } from "react";
import { FaCircleCheck, FaEnvelope, FaMagnifyingGlass } from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import { Card, cx } from "@/Components/ui";

/**
 * SMS Log — "Active TB Case Alerts" from the reference.
 *
 * No SMS gateway is configured in CareLink, so sending records the notice
 * against the patient and writes it to the activity log, exactly as the
 * provider portal's patient-notify action already does. The history table below
 * reads that log back. The banner says so rather than showing invented delivery
 * receipts.
 */
export default function Index({ recipients, history, filters, municipality }) {
    const [search, setSearch] = useState(filters.search ?? "");
    const [historySearch, setHistorySearch] = useState(filters.history ?? "");

    const form = useForm({ patients: [], message: "" });

    const visit = (next = {}) =>
        router.get(
            route("rhu.sms.index"),
            {
                search: (next.search ?? search).trim() || undefined,
                history: (next.history ?? historySearch).trim() || undefined,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );

    const toggle = (id) =>
        form.setData(
            "patients",
            form.data.patients.includes(id)
                ? form.data.patients.filter((value) => value !== id)
                : [...form.data.patients, id],
        );

    const submit = (event) => {
        event.preventDefault();
        form.post(route("rhu.sms.store"), {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
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
                        monitoring
                        {municipality ? ` in ${municipality}` : ""}.
                    </p>

                    <p className="mb-4 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-[12px] text-[#8a5a00]">
                        No SMS gateway is connected to CareLink. Sending records the alert
                        against the patient and writes it to the activity log below — it does
                        not transmit a text message.
                    </p>

                    <form
                        onSubmit={submit}
                        className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.4fr]"
                    >
                        <div className="overflow-hidden rounded-[10px] border border-line">
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
                                            {["Patient Contact", "Patient Name", "Select"].map(
                                                (heading) => (
                                                    <th
                                                        key={heading}
                                                        className="px-3 py-[9px] text-left text-[11px] font-semibold text-[#666] uppercase last:text-center"
                                                    >
                                                        {heading}
                                                    </th>
                                                ),
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recipients.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={3}
                                                    className="px-4 py-10 text-center text-[12.5px] text-muted"
                                                >
                                                    No confirmed TB patients with a contact number
                                                    yet.
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
                                                            onChange={() => toggle(recipient.id)}
                                                        />
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
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
                            {form.errors.patients ? (
                                <p role="alert" className="text-[12px] font-semibold text-brand">
                                    {form.errors.patients}
                                </p>
                            ) : null}

                            <button
                                type="submit"
                                disabled={form.processing || recipients.length === 0}
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
                                    {["Patient Contact", "Message", "Date Logged", "Status"].map(
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
                                            </td>
                                            <td className="border-t border-shell px-4 py-3 text-[13px] text-[#333]">
                                                {entry.message}
                                            </td>
                                            <td className="border-t border-shell px-4 py-3 text-[13px] whitespace-nowrap text-[#666]">
                                                {entry.sent_at_label}
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
        </DashboardLayout>
    );
}
