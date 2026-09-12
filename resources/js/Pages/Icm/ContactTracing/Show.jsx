import { Link } from "@inertiajs/react";
import { useState } from "react";
import { FaChevronLeft, FaHouseChimneyMedical } from "react-icons/fa6";
import DashboardLayout from "@/Layouts/DashboardLayout";
import {
    Card,
    ContactGroup,
    EmptyState,
    FormSection,
    InfoSummary,
    StatusPill,
    TabStrip,
} from "@/Components/ui";

/**
 * The ICM's patient view: exactly two tabs.
 *
 * This is intentionally not the RHU's treatment record. The coordinator needs
 * to know who the patient is and what contact tracing was done — the monthly
 * reviews, weekly dispensing, follow-up examinations and case closure stay in
 * the RHU portal, where that work is owned and where it can be written.
 *
 * Everything here is read-only; there is no form and no write route behind it.
 */

const tabs = [
    { value: "summary", label: "Patient Summary" },
    { value: "tracing", label: "Contact Tracing" },
];

function initials(name) {
    return String(name ?? "")
        .split(" ")
        .map((word) => word[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

export default function Show({ case: record, tracing }) {
    const [tab, setTab] = useState("summary");

    return (
        <DashboardLayout
            role="icm"
            title={record.patient.name ?? "Patient"}
            contentClassName="dash-content-panel"
        >
            <section className="mx-auto w-full max-w-[1240px] font-ui">
                <Link
                    href={route("icm.contact-tracing.index")}
                    className="mb-3.5 inline-flex items-center gap-2 text-[15px] font-bold text-ink hover:text-brand"
                >
                    <FaChevronLeft className="size-4 text-brand" aria-hidden="true" />
                    Contact Tracing
                </Link>

                <Card className="mb-[18px] flex flex-wrap items-center justify-between gap-5 px-[22px] py-[18px]">
                    <div className="flex items-center gap-3.5">
                        <span
                            className="grid size-[52px] place-items-center rounded-xl bg-brand-soft font-extrabold text-brand"
                            aria-hidden="true"
                        >
                            {initials(record.patient.name)}
                        </span>
                        <div>
                            <h2 className="text-lg font-bold text-ink">
                                {record.patient.name}
                            </h2>
                            <div className="mt-1 flex flex-wrap items-center gap-2.5">
                                <span className="text-[11.5px] font-semibold text-muted">
                                    Case No. {record.case_number}
                                </span>
                                <StatusPill tone={record.is_closed ? "completed" : "active"}>
                                    {record.is_closed
                                        ? record.status_label
                                        : `On Treatment · Month ${record.current_month}`}
                                </StatusPill>
                            </div>
                        </div>
                    </div>
                </Card>

                <Card className="overflow-hidden">
                    <TabStrip
                        tabs={tabs}
                        value={tab}
                        onChange={setTab}
                        label="Patient record sections"
                    />

                    <div className="p-5">
                        {tab === "summary" ? <Summary record={record} /> : null}
                        {tab === "tracing" ? <Tracing tracing={tracing} /> : null}
                    </div>
                </Card>
            </section>
        </DashboardLayout>
    );
}

function Summary({ record }) {
    return (
        <FormSection title="Patient Summary">
            <InfoSummary
                items={[
                    { label: "Name", value: record.patient.name },
                    { label: "Gender", value: record.patient.sex ?? "—" },
                    {
                        label: "Age",
                        value: record.patient.age ? `${record.patient.age} years old` : "—",
                    },
                    { label: "Contact Number", value: record.patient.contact_number ?? "—" },
                    { label: "TB Case Number", value: record.case_number },
                    { label: "TB Diagnosis", value: record.patient.tb_diagnosis },
                    { label: "Enrolled / Screened As", value: record.enrolled_as ?? "—" },
                    { label: "Registration Group", value: record.registration_group },
                    {
                        label: "Treatment Status",
                        value: record.is_closed
                            ? record.status_label
                            : `On Treatment · Month ${record.current_month} of ${record.total_months}`,
                    },
                    { label: "Treatment Start Date", value: record.treatment_start_date },
                    { label: "Registration Date", value: record.registration_date },
                    { label: "Municipality", value: record.municipality ?? "—" },
                    { label: "Treatment Facility", value: record.treatment_facility },
                    { label: "Diagnostic Facility", value: record.diagnostic_facility },
                    { label: "Assigned Treatment Provider", value: record.assigned_provider },
                    { label: "Enrolled By", value: record.enrolled_by ?? "—" },
                    { label: "Address", value: record.patient.address, full: true },
                ]}
            />
        </FormSection>
    );
}

function Tracing({ tracing }) {
    if (tracing === null) {
        return (
            <EmptyState
                icon={<FaHouseChimneyMedical aria-hidden="true" />}
                title="No contact tracing filed yet"
                description="The ACF contact tracing report for this patient has not been recorded. It is filed by the RHU handling the treatment case."
            />
        );
    }

    return (
        <>
            <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-[13px] font-extrabold text-[#1f2937]">
                        ACF Contact Tracing
                    </h3>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
                        Field wording follows the original ACF Contact Tracing Report table.
                        Recorded by the RHU — shown here for reference.
                    </p>
                </div>
                <span className="text-[10px] text-muted">
                    {tracing.recorded_by ? `${tracing.recorded_by} · ` : ""}
                    {tracing.updated_at_label}
                </span>
            </div>

            {tracing.groups.map((group) => (
                <ContactGroup key={group.title} title={group.title}>
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-[18px] sm:grid-cols-2 xl:grid-cols-3">
                        {group.items.map((item) => (
                            <div key={item.label} className="min-w-0">
                                <dt className="mb-1 text-[10px] font-semibold tracking-[0.03em] text-[#6b7280] uppercase">
                                    {item.label}
                                </dt>
                                <dd className="text-[13px] font-bold break-words text-[#1f2937]">
                                    {item.value ?? "—"}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </ContactGroup>
            ))}
        </>
    );
}
