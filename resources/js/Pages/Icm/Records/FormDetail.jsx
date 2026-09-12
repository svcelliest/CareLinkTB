import { useState } from "react";
import { useToast } from "@/Components/ui/Toast";
import { Link, router } from "@inertiajs/react";
import { FaArrowLeft, FaDownload, FaFloppyDisk, FaPen } from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";

const YES_NO_LABELS = { 1: "Yes", 0: "No", "": "—" };

const NOT_COLLECTED_REASONS = [
    "No RHU Staff or BHW",
    "Patient Refused",
    "Patient Absent",
    "No Supplies",
    "Other",
];

const SPUTUM_FIELDS = [
    { key: "sputum_collected", label: "Sputum Collected", type: "yesno" },
    { key: "not_collected_reason", label: "Initial Reason if not Collected", type: "text" },
    { key: "bhw_will_visit", label: "BHW Will Visit Patient", type: "yesno" },
    { key: "needs_transport", label: "Needs Transport Subsidy", type: "yesno" },
    { key: "tested_gene_xpert", label: "Tested with GeneXpert", type: "yesno" },
    { key: "tested_dssm", label: "Tested with DSSM", type: "yesno" },
    { key: "diagnostic_result", label: "Diagnostic Result", type: "text" },
    { key: "positive_classification", label: "Positive Classification", type: "text" },
    { key: "tb_case_classification", label: "TB Case Classification", type: "text" },
    { key: "enrolled_tb_treatment", label: "Enrolled in TB Treatment", type: "yesno" },
    { key: "tb_registry_number", label: "TB Registry Number", type: "text" },
    { key: "tpt_5_14", label: "Contacts Enrolled to TPT, age 5–14", type: "text" },
    { key: "tpt_15_plus", label: "Contacts Enrolled to TPT, age 15+", type: "text" },
    { key: "contacts_diagnosed_tb", label: "Contacts Diagnosed with TB", type: "text" },
    { key: "contacts_enrolled_treatment", label: "Diagnosed Contacts Enrolled", type: "text" },
    { key: "remarks", label: "Remarks", type: "text" },
];

const CONTACT_TRACING_FIELDS = [
    { key: "visit_date", label: "Date of Call or Home Visit", type: "text" },
    { key: "contact_method", label: "Call or Home Visit", type: "text" },
    { key: "rhu_contacted", label: "RHU/CHO Contacted Patient", type: "yesno" },
    { key: "started_medication", label: "Patient Started Medication", type: "yesno" },
    { key: "has_accompaniment", label: "Has Accompaniment to RHU", type: "yesno" },
    { key: "household_count", label: "People in Household", type: "text" },
    { key: "household_symptoms_count", label: "Members with Symptoms", type: "text" },
    { key: "household_tb_count", label: "Members with TB", type: "text" },
    { key: "household_taking_medication", label: "Members with TB Taking Medication", type: "yesno" },
    { key: "referral_cards_given", label: "Referral Cards Given", type: "yesno" },
    { key: "tpt_total", label: "Total Household Members in TPT", type: "text" },
    { key: "tpt_0_4", label: "TPT, age 0–4", type: "text" },
    { key: "ct_tpt_5_14", label: "TPT, age 5–14", type: "text" },
    { key: "ct_tpt_15_plus", label: "TPT, age 15+", type: "text" },
    { key: "tpt_not_enrolled_reason", label: "Reason Members Not Enrolled", type: "text" },
    { key: "enumerator_name", label: "Enumerator Name", type: "text" },
    { key: "tb_case_identified", label: "TB Case Identified", type: "yesno" },
    { key: "contact_enrolled_treatment", label: "Enrolled in TB Treatment", type: "yesno" },
    { key: "contacts_enrolled_tpt", label: "Contacts Enrolled to TPT", type: "text" },
    { key: "remarks", label: "Remarks", type: "text" },
];

function formatValue(value, type) {
    if (type === "yesno") {
        return YES_NO_LABELS[value] ?? "—";
    }
    return value === "" || value === null || value === undefined ? "—" : String(value);
}

function exportResponsesCsv(patient, fields) {
    const header = ["Field", "Value"];
    const rows = fields.map((field) => [
        field.label,
        formatValue(patient.responses[field.key], field.type),
    ]);
    const csv = [header, ...rows]
        .map((row) =>
            row
                .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
                .join(","),
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${patient.name.replace(/\s+/g, "_")}_form.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

export default function FormDetail({ patient }) {
    const toast = useToast();
    const isSputum = patient.form_type === "sputum_collection";
    const fields = isSputum ? SPUTUM_FIELDS : CONTACT_TRACING_FIELDS;
    const formLabel = isSputum ? "Sputum Collection Form" : "Contact Tracing Form";

    /** Same CSV the button always wrote — the toast only reports the outcome. */
    const handleExport = () => {
        try {
            exportResponsesCsv(patient, fields);
            toast.success("Export completed successfully");
        } catch {
            toast.error("Export failed. Please try again.");
        }
    };

    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sputumCollected, setSputumCollected] = useState(
        patient.responses.sputum_collected ?? "",
    );
    const [notCollectedReason, setNotCollectedReason] = useState(
        patient.responses.not_collected_reason ?? "",
    );

    const saveEdits = () => {
        setSaving(true);
        router.patch(
            route("icm.records.update", patient.id),
            {
                sputum_collected: sputumCollected,
                not_collected_reason: notCollectedReason,
            },
            {
                preserveScroll: true,
                onSuccess: () => setEditing(false),
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <DashboardLayout
            role="icm"
            title={patient.name}
            contentClassName="dash-content-form-detail"
        >
            <div className="form-detail-page">
                <header className="form-detail-header">
                    <div>
                        <Link
                            href={route("icm.records.index")}
                            className="form-detail-back"
                        >
                            <FaArrowLeft aria-hidden="true" />
                            <span>{formLabel} — {patient.name}</span>
                        </Link>
                        <div className="form-detail-meta">
                            Type: {formLabel} · Program: {patient.program_name} ·
                            RHU: {patient.rhu_name} · Created: {patient.created_at}
                        </div>
                    </div>
                    <div className="form-detail-actions">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleExport}
                        >
                            <FaDownload aria-hidden="true" />
                            Export
                        </button>
                        {isSputum && (
                            <button
                                type="button"
                                className="fd-edit-btn"
                                onClick={() => {
                                    if (editing) {
                                        saveEdits();
                                    } else {
                                        setEditing(true);
                                    }
                                }}
                                disabled={saving}
                            >
                                {editing ? (
                                    <FaFloppyDisk aria-hidden="true" />
                                ) : (
                                    <FaPen aria-hidden="true" />
                                )}
                                {saving ? "Saving…" : editing ? "SAVE" : "UPDATE"}
                            </button>
                        )}
                    </div>
                </header>

                <div className="form-detail-body">
                    <div className="fd-table-card">
                        <table className="fd-table">
                            <thead>
                                <tr>
                                    <th className="left">Field</th>
                                    <th className="left">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fields.map((field) => {
                                    const isEditableField =
                                        editing &&
                                        (field.key === "sputum_collected" ||
                                            field.key === "not_collected_reason");

                                    if (isEditableField && field.key === "sputum_collected") {
                                        return (
                                            <tr key={field.key}>
                                                <td className="left">{field.label}</td>
                                                <td className="left">
                                                    <select
                                                        className="fd-yesno-select"
                                                        value={sputumCollected}
                                                        onChange={(event) =>
                                                            setSputumCollected(
                                                                event.target.value,
                                                            )
                                                        }
                                                    >
                                                        <option value="">Select an answer</option>
                                                        <option value="1">Yes</option>
                                                        <option value="0">No</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    if (isEditableField && field.key === "not_collected_reason") {
                                        return (
                                            <tr key={field.key}>
                                                <td className="left">{field.label}</td>
                                                <td className="left">
                                                    <select
                                                        className="fd-reason-select"
                                                        value={notCollectedReason}
                                                        onChange={(event) =>
                                                            setNotCollectedReason(
                                                                event.target.value,
                                                            )
                                                        }
                                                    >
                                                        <option value="">Not applicable</option>
                                                        {NOT_COLLECTED_REASONS.map(
                                                            (reason) => (
                                                                <option
                                                                    key={reason}
                                                                    value={reason}
                                                                >
                                                                    {reason}
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    return (
                                        <tr key={field.key}>
                                            <td className="left">{field.label}</td>
                                            <td className="left">
                                                {formatValue(
                                                    patient.responses[field.key],
                                                    field.type,
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
