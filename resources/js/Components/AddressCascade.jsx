import {
    MUNICIPALITIES,
    PROVINCE,
    barangaysFor,
} from "@/data/aklanAddresses";

/**
 * Province → Municipality → Barangay cascade, backed by the single address
 * dataset in `@/data/aklanAddresses`.
 *
 * Provider patient registration and ICM program creation both render this, so
 * the two screens can never drift apart on which municipalities or barangays
 * are selectable. The two screens are styled differently, so every element
 * takes its class names from `classes` — the defaults are the `field-*`
 * classes patient registration has always used.
 */

const defaultClasses = {
    row: "field-row",
    group: "field-group",
    label: "field-label",
    select: "field-select",
    error: "field-error",
};

export default function AddressCascade({
    value,
    onChange,
    classes = {},
    disabled = false,
    errors = {},
    idPrefix = "address",
    labels = {},
}) {
    const css = { ...defaultClasses, ...classes };
    const { province = "", municipality = "", barangay = "" } = value ?? {};

    // Narrowing a level always clears the levels below it, otherwise a stale
    // barangay from the previous municipality would stay selected.
    const setProvince = (next) =>
        onChange({ province: next, municipality: "", barangay: "" });
    const setMunicipality = (next) =>
        onChange({ province, municipality: next, barangay: "" });
    const setBarangay = (next) => onChange({ province, municipality, barangay: next });

    return (
        <>
            <div className={css.group}>
                <label className={css.label} htmlFor={`${idPrefix}-province`}>
                    {labels.province ?? "Province"}
                </label>
                <select
                    id={`${idPrefix}-province`}
                    className={css.select}
                    value={province}
                    disabled={disabled}
                    onChange={(event) => setProvince(event.target.value)}
                >
                    <option value="">Select province</option>
                    <option value={PROVINCE}>{PROVINCE}</option>
                </select>
                {errors.province && <small className={css.error}>{errors.province}</small>}
            </div>

            <div className={css.row}>
                <div className={css.group}>
                    <label
                        className={css.label}
                        htmlFor={`${idPrefix}-municipality`}
                    >
                        {labels.municipality ?? "Municipality / City"}
                    </label>
                    <select
                        id={`${idPrefix}-municipality`}
                        className={css.select}
                        value={municipality}
                        disabled={disabled || !province}
                        onChange={(event) => setMunicipality(event.target.value)}
                    >
                        <option value="">Select municipality</option>
                        {MUNICIPALITIES.map((entry) => (
                            <option key={entry.name} value={entry.name}>
                                {entry.name}
                            </option>
                        ))}
                    </select>
                    {errors.municipality && (
                        <small className={css.error}>{errors.municipality}</small>
                    )}
                </div>

                <div className={css.group}>
                    <label className={css.label} htmlFor={`${idPrefix}-barangay`}>
                        {labels.barangay ?? "Barangay"}
                    </label>
                    <select
                        id={`${idPrefix}-barangay`}
                        className={css.select}
                        value={barangay}
                        disabled={disabled || !municipality}
                        onChange={(event) => setBarangay(event.target.value)}
                    >
                        <option value="">Select barangay</option>
                        {barangaysFor(municipality).map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                    {errors.barangay && (
                        <small className={css.error}>{errors.barangay}</small>
                    )}
                </div>
            </div>
        </>
    );
}
