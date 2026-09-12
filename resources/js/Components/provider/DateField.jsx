// A date input that opens Flowbite's calendar as a dropdown, in the shape
// people expect a date field to have: a text box you can type into, a calendar
// icon, and a panel that appears under it on focus.
//
// Flowbite picks its mode from the element it is handed — an INPUT gets the
// dropdown, anything else renders the calendar permanently inline — so the
// `<input>` below is load-bearing, not cosmetic.
import { useEffect, useId, useRef } from "react";
import Datepicker from "flowbite-datepicker/Datepicker";
import { FaRegCalendar } from "react-icons/fa6";
import "../../../css/app/12a-provider-programs.css";

// Flowbite format tokens. The box SHOWS the readable format; the value handed
// back to the form is always ISO, so `form.birthday`, `calcAge()` and the
// future-date guard in Screening keep working in the shape they always had.
const DISPLAY_FORMAT = "mm/dd/yyyy";
const ISO_FORMAT = "yyyy-mm-dd";

// "1998-04-23" -> a Date at LOCAL midnight. `new Date(iso)` would read it as
// UTC and land on the previous day for anyone west of Greenwich.
function toLocalDate(iso) {
    if (!iso) return undefined;
    const [year, month, day] = iso.split("-").map(Number);
    if (!year || !month || !day) return undefined;
    return new Date(year, month - 1, day);
}

export default function DateField({
    value = "",
    onChange,
    minDate = "",
    maxDate = "",
    placeholder = DISPLAY_FORMAT,
}) {
    // useId() emits colons, which are not valid in a CSS selector unescaped,
    // and Flowbite only accepts its `container` as a selector string.
    const wrapperId = `datefield-${useId().replace(/:/g, "")}`;
    const inputRef = useRef(null);
    const pickerRef = useRef(null);
    // Read through refs so a new `onChange` identity on every parent render
    // doesn't tear the picker down and rebuild it mid-interaction.
    const onChangeRef = useRef(onChange);
    const valueRef = useRef(value);
    onChangeRef.current = onChange;
    valueRef.current = value;

    useEffect(() => {
        const input = inputRef.current;
        const picker = new Datepicker(input, {
            format: DISPLAY_FORMAT,
            minDate: toLocalDate(minDate),
            maxDate: toLocalDate(maxDate),
            autohide: true,
            clearBtn: true,
            // A birthday is never today, so the "Today" shortcut here is only a
            // fast way to enter a date the form will reject.
            todayBtn: false,
            todayHighlight: false,
            // Anchor the dropdown to the wrapper rather than <body>. The
            // dashboard content area scrolls, and a body-anchored panel is
            // positioned once and then sits still while the page moves under
            // it. Positioned against the wrapper it travels with the field.
            container: `#${wrapperId}`,
        });
        pickerRef.current = picker;

        // Seed the existing value before subscribing, so opening the form on a
        // patient doesn't echo back out as a change the parent has to absorb.
        if (valueRef.current) {
            picker.setDate(toLocalDate(valueRef.current));
        }

        const handleChangeDate = () => {
            onChangeRef.current(picker.getDate(ISO_FORMAT) ?? "");
        };
        input.addEventListener("changeDate", handleChangeDate);

        return () => {
            input.removeEventListener("changeDate", handleChangeDate);
            picker.destroy();
            pickerRef.current = null;
        };
    }, [minDate, maxDate, wrapperId]);

    // Mirror changes that originated outside the picker: clearing the form
    // after a save, or loading a patient into it for editing. The equality
    // guard is what keeps this from ping-ponging with `handleChangeDate`.
    useEffect(() => {
        const picker = pickerRef.current;
        if (!picker) return;
        if ((picker.getDate(ISO_FORMAT) ?? "") === value) return;
        picker.setDate(value ? toLocalDate(value) : { clear: true });
    }, [value]);

    return (
        <div className="field-datefield" id={wrapperId}>
            <input
                ref={inputRef}
                type="text"
                className="field-input"
                placeholder={placeholder}
                autoComplete="off"
            />
            <FaRegCalendar className="field-datefield-icon" aria-hidden="true" />
        </div>
    );
}
