import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@inertiajs/react";
import { Button, Field, Modal, controlClass, selectClass } from "@/Components/ui";
import { useToast } from "@/Components/ui/Toast";

/**
 * Create a program. Ported from the medjofinal reference's `ProgramFormDialog`,
 * with two deliberate changes:
 *
 *  - Location picking is a real Province → Municipality cascade over the
 *    `locations` table (same pattern as Create Account), not medjofinal's
 *    free-text Province/Municipality/Barangay cascade — this project already
 *    rewrote every other address-picking screen to prefer the real FK over
 *    string parsing, so this dialog follows the same rule. No barangay level:
 *    unlike an account, nothing here needs a "double check you picked the
 *    right one" step.
 *  - `date`/`time` are posted as the wall-clock strings the coordinator
 *    typed and the server composes `scheduled_at` from them (explicitly
 *    interpreted as Asia/Manila — see StoreProgramRequest::programAttributes()),
 *    rather than building a JS `Date` here and letting `.toISOString()` drag
 *    in whichever timezone the browser happens to be running in.
 *
 * Create-only, matching the reference: nothing on the Program page currently
 * offers an "Edit" entry point, so there's no `update` route to call.
 */
export default function ProgramFormDialog({ open, onClose, locations, scheduleWindow }) {
    const toast = useToast();
    const nameInput = useRef(null);
    // Shown instead of closing when there is unsaved input. The form itself is
    // left untouched behind it, so cancelling gives the entered values back.
    const [confirmingDiscard, setConfirmingDiscard] = useState(false);

    const { data, setData, post, processing, errors, clearErrors, reset } = useForm({
        name: "",
        province_id: "",
        location_id: "",
        date: "",
        time: "",
    });

    const provinces = useMemo(
        () => locations.filter((location) => location.level === "province"),
        [locations],
    );

    const municipalities = useMemo(() => {
        if (!data.province_id) return [];

        return locations.filter(
            (location) =>
                location.level === "municipality" &&
                String(location.parent_id) === String(data.province_id),
        );
    }, [locations, data.province_id]);

    useEffect(() => {
        if (!open) return;

        clearErrors();
        setConfirmingDiscard(false);
        reset();
        window.setTimeout(() => nameInput.current?.focus(), 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const setProvince = (provinceId) => {
        setData((current) => ({ ...current, province_id: provinceId, location_id: "" }));
    };

    const isDirty = useMemo(
        () =>
            Boolean(
                data.name.trim() || data.location_id || data.date || data.time,
            ),
        [data],
    );

    const discardAndClose = () => {
        setConfirmingDiscard(false);
        reset();
        onClose();
    };

    /** Closing with unsaved input asks first; nothing is cleared until it does. */
    const requestClose = () => {
        if (processing) return;
        if (isDirty) {
            setConfirmingDiscard(true);
            return;
        }
        discardAndClose();
    };

    /** Minutes past midnight, or null when the value is not a complete `HH:MM`. */
    const toMinutes = (value) => {
        const match = /^(\d{2}):(\d{2})$/.exec(value ?? "");
        return match ? Number(match[1]) * 60 + Number(match[2]) : null;
    };

    // The same window the server enforces, checked here so the coordinator
    // sees it before submitting rather than after a round trip.
    const timeError = useMemo(() => {
        const minutes = toMinutes(data.time);
        if (minutes === null) return null;

        const min = toMinutes(scheduleWindow.min);
        const max = toMinutes(scheduleWindow.max);

        return minutes < min || minutes > max
            ? `Programs can only be scheduled between ${scheduleWindow.label}.`
            : null;
    }, [data.time, scheduleWindow]);

    const submit = (event) => {
        event.preventDefault();
        if (timeError) return;

        post(route("icm.programs.store"), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onClose();
                toast.success("Program created successfully");
            },
            onError: () =>
                toast.error(
                    "Could not create the program. Please check the form and try again.",
                ),
        });
    };

    return (
        <Modal
            open={open}
            onClose={requestClose}
            locked={processing}
            labelledBy="program-dialog-title"
            describedBy="program-dialog-description"
            className="relative max-w-[480px]"
        >
            {/* Sits over the form rather than replacing it, so the entered
                values are still there behind the question — and still there
                afterwards if the answer is Cancel. */}
            {confirmingDiscard ? (
                <div
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="program-discard-title"
                    className="absolute inset-0 z-10 flex flex-col justify-center rounded-2xl bg-white/97 p-7"
                >
                    <h3
                        id="program-discard-title"
                        className="mb-1 text-[15.5px] font-bold text-ink"
                    >
                        Discard this program?
                    </h3>
                    <p className="mb-5 text-[13px] text-muted">
                        This program has not been created yet. The details you
                        entered will be lost.
                    </p>
                    <div className="flex justify-end gap-2.5">
                        <Button
                            variant="secondary"
                            onClick={() => setConfirmingDiscard(false)}
                        >
                            Cancel
                        </Button>
                        <Button variant="danger" onClick={discardAndClose}>
                            Discard
                        </Button>
                    </div>
                </div>
            ) : null}

            <h2
                id="program-dialog-title"
                className="mb-1 text-[17px] font-bold text-ink"
            >
                Create New Program
            </h2>
            <p
                id="program-dialog-description"
                className="mb-5 text-[13px] text-muted"
            >
                This program will be visible to assigned Providers and reflect in
                their portal.
            </p>

            <form onSubmit={submit} noValidate>
                <Field
                    label="Program Name"
                    htmlFor="program-name"
                    error={errors.name}
                >
                    <input
                        id="program-name"
                        ref={nameInput}
                        type="text"
                        className={controlClass}
                        value={data.name}
                        onChange={(event) => setData("name", event.target.value)}
                        placeholder="e.g. ACF TB Program – Kalibo"
                        autoComplete="off"
                        aria-invalid={Boolean(errors.name)}
                    />
                </Field>

                <Field
                    label="Location"
                    htmlFor="program-province"
                    error={errors.location_id}
                >
                    <div className="flex flex-col gap-2.5">
                        <select
                            id="program-province"
                            className={selectClass}
                            value={data.province_id}
                            onChange={(event) => setProvince(event.target.value)}
                        >
                            <option value="">— Select Province —</option>
                            {provinces.map((province) => (
                                <option key={province.id} value={province.id}>
                                    {province.name}
                                </option>
                            ))}
                        </select>

                        {data.province_id ? (
                            <select
                                id="program-location"
                                className={selectClass}
                                value={data.location_id}
                                onChange={(event) =>
                                    setData("location_id", event.target.value)
                                }
                            >
                                <option value="">— Select Municipality —</option>
                                {municipalities.map((location) => (
                                    <option key={location.id} value={location.id}>
                                        {location.name}
                                    </option>
                                ))}
                            </select>
                        ) : null}
                    </div>
                </Field>

                <div className="grid gap-x-3 sm:grid-cols-2">
                    <Field label="Date" htmlFor="program-date" error={errors.date}>
                        <input
                            id="program-date"
                            type="date"
                            className={controlClass}
                            value={data.date}
                            onChange={(event) => setData("date", event.target.value)}
                            aria-invalid={Boolean(errors.date)}
                        />
                    </Field>

                    <Field
                        label="Time"
                        htmlFor="program-time"
                        error={timeError ?? errors.time}
                        hint={`Between ${scheduleWindow.label}`}
                    >
                        <input
                            id="program-time"
                            type="time"
                            className={controlClass}
                            value={data.time}
                            min={scheduleWindow.min}
                            max={scheduleWindow.max}
                            step="60"
                            onChange={(event) => setData("time", event.target.value)}
                            aria-invalid={Boolean(timeError || errors.time)}
                        />
                    </Field>
                </div>

                <div className="mt-1.5 flex justify-end gap-2.5">
                    <Button
                        variant="secondary"
                        onClick={requestClose}
                        disabled={processing}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={processing || Boolean(timeError)}
                    >
                        {processing ? "Creating…" : "Create Program"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
