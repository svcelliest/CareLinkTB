import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@inertiajs/react";
import AddressCascade from "@/Components/AddressCascade";
import { Button, Field, Modal, controlClass } from "@/Components/ui";
import { useToast } from "@/Components/ui/Toast";
import { PROVINCE, buildAddress, parseAddress } from "@/data/aklanAddresses";

/**
 * Create / edit a program.
 *
 * Two things this deliberately does *not* do:
 *
 *  - It never builds a `Date` from the schedule. `date` and `time` are posted
 *    as the wall-clock strings the coordinator typed and the server composes
 *    `scheduled_at` from them, so the stored time is the picked time. Reading
 *    an existing program back uses the server's `scheduled_date` /
 *    `scheduled_time` for the same reason.
 *  - It does not carry its own list of places. The location is assembled from
 *    the same Province → Municipality → Barangay dataset patient registration
 *    uses, through the shared `AddressCascade`.
 */

const emptyAddress = { province: "", municipality: "", barangay: "" };

const addressClasses = {
    row: "grid gap-x-3 sm:grid-cols-2",
    group: "mb-3.5",
    label: "mb-1.5 block text-[11.5px] font-bold text-[#555]",
    select: controlClass,
    error: "mt-1 block text-[11.5px] font-semibold text-brand",
};

/** Minutes past midnight, or null when the value is not a complete `HH:MM`. */
function toMinutes(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(value ?? "");
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export default function ProgramFormDialog({
    open,
    onClose,
    program = null,
    scheduleWindow,
}) {
    const isEdit = Boolean(program);
    const toast = useToast();
    const nameInput = useRef(null);
    const [address, setAddress] = useState(emptyAddress);
    // Shown instead of closing when there is unsaved input. The form itself is
    // left untouched behind it, so cancelling gives the entered values back.
    const [confirmingDiscard, setConfirmingDiscard] = useState(false);

    const { data, setData, post, patch, processing, errors, clearErrors, reset } =
        useForm({ name: "", location: "", date: "", time: "" });

    // Re-seed whenever the dialog opens, so editing one program then another
    // never shows the previous program's values.
    useEffect(() => {
        if (!open) return;

        clearErrors();
        setConfirmingDiscard(false);

        if (isEdit) {
            setData({
                name: program.name,
                location: program.location,
                date: program.scheduled_date,
                time: program.scheduled_time,
            });
            const parsed = parseAddress(program.location);
            setAddress({
                province: parsed.province || PROVINCE,
                municipality: parsed.municipality,
                barangay: parsed.barangay,
            });
        } else {
            reset();
            setAddress(emptyAddress);
        }

        window.setTimeout(() => nameInput.current?.focus(), 0);
        // `program` identity is the only meaningful change here; the form
        // helpers are recreated on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, program?.id]);

    const onAddressChange = (next) => {
        setAddress(next);
        setData("location", buildAddress(next));
    };

    // The same window the server enforces, checked here so the coordinator sees
    // it before submitting rather than after a round trip.
    const timeError = useMemo(() => {
        const minutes = toMinutes(data.time);
        if (minutes === null) return null;

        const min = toMinutes(scheduleWindow.min);
        const max = toMinutes(scheduleWindow.max);

        return minutes < min || minutes > max
            ? `Programs can only be scheduled between ${scheduleWindow.label}.`
            : null;
    }, [data.time, scheduleWindow]);

    /**
     * Anything typed that would be lost by closing. Editing compares against
     * the program as it was loaded, so simply opening an existing program and
     * closing it again is not treated as unsaved work.
     */
    const isDirty = isEdit
        ? data.name !== program.name ||
          data.location !== program.location ||
          data.date !== program.scheduled_date ||
          data.time !== program.scheduled_time
        : Boolean(data.name.trim() || data.location || data.date || data.time);

    const discardAndClose = () => {
        setConfirmingDiscard(false);
        reset();
        setAddress(emptyAddress);
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

    const submit = (event) => {
        event.preventDefault();
        if (timeError) return;

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setAddress(emptyAddress);
                onClose();
                toast.success(
                    isEdit
                        ? "Program updated successfully"
                        : "Program created successfully",
                );
            },
            onError: () =>
                toast.error(
                    isEdit
                        ? "Could not update the program. Please check the form and try again."
                        : "Could not create the program. Please check the form and try again.",
                ),
        };

        if (isEdit) {
            patch(route("icm.programs.update", program.id), options);
        } else {
            post(route("icm.programs.store"), options);
        }
    };

    return (
        <Modal
            open={open}
            onClose={requestClose}
            locked={processing}
            labelledBy="program-dialog-title"
            describedBy="program-dialog-description"
            className="relative max-w-[520px]"
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
                        {isEdit ? "Discard changes?" : "Discard this program?"}
                    </h3>
                    <p className="mb-5 text-[13px] text-muted">
                        {isEdit
                            ? "The changes you made to this program have not been saved yet."
                            : "This program has not been created yet. The details you entered will be lost."}
                    </p>
                    <div className="flex justify-end gap-2.5">
                        <Button
                            variant="secondary"
                            onClick={() => setConfirmingDiscard(false)}
                        >
                            Cancel
                        </Button>
                        <Button variant="danger" onClick={discardAndClose}>
                            {isEdit ? "Discard Changes" : "Discard"}
                        </Button>
                    </div>
                </div>
            ) : null}

            <h2
                id="program-dialog-title"
                className="mb-1 text-[17px] font-bold text-ink"
            >
                {isEdit ? "Edit Program" : "Create New Program"}
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

                <fieldset className="mb-1">
                    <legend className="mb-2 text-[11.5px] font-bold tracking-wide text-brand uppercase">
                        Location
                    </legend>
                    <AddressCascade
                        idPrefix="program-address"
                        value={address}
                        onChange={onAddressChange}
                        classes={addressClasses}
                        disabled={processing}
                    />
                </fieldset>

                {data.location ? (
                    <p className="mb-3.5 text-[12px] text-muted">
                        Location:{" "}
                        <span className="font-semibold text-ink">
                            {data.location}
                        </span>
                    </p>
                ) : null}
                {errors.location ? (
                    <small className="mb-3.5 block text-[11.5px] font-semibold text-brand">
                        {errors.location}
                    </small>
                ) : null}

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
                        error={timeError ?? errors.time ?? errors.scheduled_at}
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
                        {processing
                            ? isEdit
                                ? "Saving…"
                                : "Creating…"
                            : isEdit
                              ? "Save Changes"
                              : "Create Program"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
