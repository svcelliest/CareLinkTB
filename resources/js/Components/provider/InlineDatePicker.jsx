// Flowbite's datepicker is a vanilla-JS widget that renders its own markup into
// a plain element, so React cannot own the DOM inside it. This wrapper keeps it
// on exactly the contract the `<input type="date">` it replaces had: `value`
// and `onChange` speak "YYYY-MM-DD" strings, which is the shape `form.birthday`,
// `calcAge()` and the future-date guard in Screening already work in.
//
// Passing a non-INPUT element to the constructor is what selects Flowbite's
// inline mode — there is no `inline: true` option.
import { useEffect, useRef } from "react";
import Datepicker from "flowbite-datepicker/Datepicker";

// Flowbite's own format token for an ISO date, not a JS format string.
const ISO_FORMAT = "yyyy-mm-dd";

// "1998-04-23" -> a Date at LOCAL midnight. `new Date(iso)` would read it as
// UTC and land on the previous day for anyone west of Greenwich.
function toLocalDate(iso) {
    if (!iso) return undefined;
    const [year, month, day] = iso.split("-").map(Number);
    if (!year || !month || !day) return undefined;
    return new Date(year, month - 1, day);
}

export default function InlineDatePicker({
    value = "",
    onChange,
    minDate = "",
    maxDate = "",
    className = "",
}) {
    const hostRef = useRef(null);
    const pickerRef = useRef(null);
    // Read through refs so a new `onChange` identity on every parent render
    // doesn't tear the picker down and rebuild it (which would reset the view
    // to the current month mid-interaction).
    const onChangeRef = useRef(onChange);
    const valueRef = useRef(value);
    onChangeRef.current = onChange;
    valueRef.current = value;

    useEffect(() => {
        const host = hostRef.current;
        const picker = new Datepicker(host, {
            format: ISO_FORMAT,
            minDate: toLocalDate(minDate),
            maxDate: toLocalDate(maxDate),
            clearBtn: true,
            // A birthday is never today, so the "Today" shortcut here is only a
            // fast way to enter a date the form will reject.
            todayBtn: false,
            todayHighlight: false,
        });
        pickerRef.current = picker;

        // Seed the existing value before subscribing, so re-mounting with a
        // value doesn't echo back out as a change the parent has to absorb.
        if (valueRef.current) {
            picker.setDate(toLocalDate(valueRef.current));
        }

        const handleChangeDate = () => {
            onChangeRef.current(picker.getDate(ISO_FORMAT) ?? "");
        };
        host.addEventListener("changeDate", handleChangeDate);

        return () => {
            host.removeEventListener("changeDate", handleChangeDate);
            picker.destroy();
            pickerRef.current = null;
        };
    }, [minDate, maxDate]);

    // Mirror changes that originated outside the picker: clearing the form
    // after a save, or loading a patient into it for editing. The equality
    // guard is what keeps this from ping-ponging with `handleChangeDate`.
    useEffect(() => {
        const picker = pickerRef.current;
        if (!picker) return;
        if ((picker.getDate(ISO_FORMAT) ?? "") === value) return;
        picker.setDate(value ? toLocalDate(value) : { clear: true });
    }, [value]);

    return <div ref={hostRef} className={className} />;
}
