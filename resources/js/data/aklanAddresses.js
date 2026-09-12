/**
 * Aklan address reference for provider patient registration, ICM program
 * locations, and the RHU municipality on account creation.
 *
 * The data itself lives in `aklanAddresses.json` beside this file, because PHP
 * reads the same file (see `App\Support\AklanAddresses`) for the server-side
 * municipality validation and the municipality analytics. There is exactly one
 * copy of this dataset; do not add a second list anywhere.
 *
 * Source: ACF-Scope.pdf (the ACF programme coverage document). It covers 15
 * of Aklan's 17 municipalities — Altavas and Tangalan are out of scope and are
 * deliberately absent, so do not "complete" this list from other sources.
 *
 * Patients still store a single `address` string built as
 * "Barangay, Municipality, Province" (see buildAddress), so the patient data
 * model is unchanged.
 */

import dataset from "./aklanAddresses.json";

export const PROVINCE = dataset.province;

export const MUNICIPALITIES = dataset.municipalities;

/** Municipality names only, for filters and single-level dropdowns. */
export const MUNICIPALITY_NAMES = MUNICIPALITIES.map((entry) => entry.name);

export function barangaysFor(municipality) {
    return (
        MUNICIPALITIES.find((m) => m.name === municipality)?.barangays ?? []
    );
}

/** Collapses the three dropdowns back into the stored address string. */
export function buildAddress({ barangay, municipality, province }) {
    return [barangay, municipality, province].filter(Boolean).join(", ");
}

/** Inverse of buildAddress, for re-opening a saved patient in the form. */
export function parseAddress(address) {
    const [barangay = "", municipality = "", province = ""] = String(address ?? "")
        .split(",")
        .map((part) => part.trim());
    return { barangay, municipality, province };
}
