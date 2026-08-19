import { Link, useForm, usePage } from "@inertiajs/react";
import { useMemo, useState } from "react";
import {
    FaArrowLeft,
    FaCalendarDays,
    FaCheck,
    FaCircleCheck,
    FaClock,
    FaFileCirclePlus,
    FaFlask,
    FaHouseMedical,
    FaLocationDot,
    FaMagnifyingGlass,
} from "react-icons/fa6";
import ProgramFormModal from "@/Components/forms/ProgramFormModal";
import DashboardLayout from "@/Layouts/DashboardLayout";

const formTypes = [
    {
        value: "sputum_collection",
        label: "Sputum Collection",
        description: "Collection, diagnostic testing, and treatment outcomes",
        Icon: FaFlask,
    },
    {
        value: "contact_tracing",
        label: "Contact Tracing",
        description: "Follow-up visits, household screening, and TPT outcomes",
        Icon: FaHouseMedical,
    },
];

const blankResponses = {
    sputum_collected: "",
    not_collected_reason: "",
    bhw_will_visit: "",
    needs_transport: "",
    tested_gene_xpert: "",
    tested_dssm: "",
    diagnostic_result: "",
    positive_classification: "",
    tb_case_classification: "",
    enrolled_tb_treatment: "",
    tb_registry_number: "",
    tpt_5_14: "",
    tpt_15_plus: "",
    contacts_diagnosed_tb: "",
    contacts_enrolled_treatment: "",
    visit_date: "",
    contact_method: "",
    rhu_contacted: "",
    started_medication: "",
    has_accompaniment: "",
    household_count: "",
    household_symptoms_count: "",
    household_tb_count: "",
    household_taking_medication: "",
    referral_cards_given: "",
    tpt_total: "",
    tpt_0_4: "",
    ct_tpt_5_14: "",
    ct_tpt_15_plus: "",
    tpt_not_enrolled_reason: "",
    enumerator_name: "",
    tb_case_identified: "",
    contact_enrolled_treatment: "",
    contacts_enrolled_tpt: "",
    remarks: "",
};

const blankForm = (formType) => ({
    form_type: formType,
    patient_id: "",
    patient_name: "",
    contact_number: "",
    address: "",
    status: "draft",
    responses: { ...blankResponses },
});

export default function Show({ program }) {
    const { flash } = usePage().props;
    const [activeType, setActiveType] = useState("sputum_collection");
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const form = useForm(blankForm(activeType));

    const activeMeta = formTypes.find((item) => item.value === activeType);
    const visibleEntries = useMemo(() => {
        const query = search.trim().toLowerCase();

        return program.form_entries.filter((entry) => {
            if (entry.form_type !== activeType) return false;
            if (!query) return true;

            return [entry.patient_name, entry.patient_id, entry.contact_number]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(query));
        });
    }, [activeType, program.form_entries, search]);

    const counts = useMemo(() => {
        return formTypes.reduce((result, item) => {
            const entries = program.form_entries.filter(
                (entry) => entry.form_type === item.value,
            );
            result[item.value] = {
                total: entries.length,
                completed: entries.filter((entry) => entry.status === "completed").length,
            };
            return result;
        }, {});
    }, [program.form_entries]);

    const openForm = () => {
        form.clearErrors();
        form.setData(blankForm(activeType));
        setModalOpen(true);
    };

    const closeForm = () => {
        if (form.processing) return;
        form.clearErrors();
        setModalOpen(false);
    };

    const submitForm = (status) => {
        form.transform((data) => ({ ...data, status }));
        form.post(route("rhu.programs.forms.store", program.id), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setModalOpen(false);
            },
            onFinish: () => form.transform((data) => data),
        });
    };

    return (
        <DashboardLayout
            role="rhu"
            title="Program Forms"
            contentClassName="dash-content-rhu-forms"
        >
            <section className="rhu-forms-page">
                {flash?.success && (
                    <div className="rhu-forms-toast" role="status">
                        <FaCircleCheck aria-hidden="true" />
                        {flash.success}
                    </div>
                )}

                <header className="rhu-forms-program-header">
                    <Link href={route("rhu.programs.index")} className="rhu-forms-back">
                        <FaArrowLeft aria-hidden="true" />
                        All programs
                    </Link>
                    <div className="rhu-forms-program-copy">
                        <div>
                            <span className={`programs-status programs-status-${program.status}`}>
                                {program.status}
                            </span>
                            <h2>{program.name}</h2>
                        </div>
                        <div className="rhu-forms-program-meta">
                            <span><FaLocationDot aria-hidden="true" />{program.location}</span>
                            <span><FaCalendarDays aria-hidden="true" />{program.date_label}</span>
                            <span><FaClock aria-hidden="true" />{program.time_label}</span>
                        </div>
                    </div>
                </header>

                <div className="rhu-forms-body">
                    <div className="rhu-form-type-grid">
                        {formTypes.map(({ value, label, description, Icon }) => {
                            const typeCounts = counts[value];
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    className={activeType === value ? "active" : ""}
                                    onClick={() => {
                                        setActiveType(value);
                                        setSearch("");
                                    }}
                                >
                                    <span className="rhu-form-type-icon"><Icon aria-hidden="true" /></span>
                                    <span className="rhu-form-type-copy">
                                        <strong>{label}</strong>
                                        <small>{description}</small>
                                    </span>
                                    <span className="rhu-form-type-count">
                                        <strong>{typeCounts.completed}/{typeCounts.total}</strong>
                                        <small>complete</small>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="rhu-records-card">
                        <header className="rhu-records-heading">
                            <div>
                                <span className="rhu-records-icon"><activeMeta.Icon aria-hidden="true" /></span>
                                <div>
                                    <h3>{activeMeta.label}</h3>
                                    <p>{visibleEntries.length} {visibleEntries.length === 1 ? "record" : "records"} shown</p>
                                </div>
                            </div>
                            <button type="button" onClick={openForm}>
                                <FaFileCirclePlus aria-hidden="true" />
                                Add patient record
                            </button>
                        </header>

                        <div className="rhu-records-toolbar">
                            <label>
                                <FaMagnifyingGlass aria-hidden="true" />
                                <span className="sr-only">Search patient records</span>
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search patient name, ID, or contact"
                                />
                            </label>
                            <span>Drafts can be completed later</span>
                        </div>

                        <div className="rhu-records-list" aria-live="polite">
                            {visibleEntries.length > 0 ? (
                                visibleEntries.map((entry) => (
                                    <article key={entry.id}>
                                        <span className="rhu-record-avatar">
                                            {entry.patient_name
                                                .split(/\s+/)
                                                .slice(0, 2)
                                                .map((part) => part[0])
                                                .join("")
                                                .toUpperCase()}
                                        </span>
                                        <div className="rhu-record-copy">
                                            <h4>{entry.patient_name}</h4>
                                            <p>
                                                {entry.patient_id || "No patient ID"}
                                                <span aria-hidden="true">·</span>
                                                {entry.contact_number || "No contact number"}
                                            </p>
                                        </div>
                                        <div className="rhu-record-updated">
                                            <span>Last saved</span>
                                            <strong>{entry.updated_at_label}</strong>
                                        </div>
                                        <span className={`rhu-record-status ${entry.status}`}>
                                            {entry.status === "completed" && <FaCheck aria-hidden="true" />}
                                            {entry.status === "completed" ? "Complete" : "Draft"}
                                        </span>
                                    </article>
                                ))
                            ) : (
                                <div className="rhu-records-empty">
                                    <span><activeMeta.Icon aria-hidden="true" /></span>
                                    <h4>No {activeMeta.label.toLowerCase()} records yet</h4>
                                    <p>
                                        Add one patient at a time using a short,
                                        guided form instead of a wide spreadsheet.
                                    </p>
                                    <button type="button" onClick={openForm}>
                                        <FaFileCirclePlus aria-hidden="true" />
                                        Add first patient record
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {modalOpen && (
                <ProgramFormModal
                    formType={activeType}
                    form={form}
                    onClose={closeForm}
                    onSubmit={submitForm}
                />
            )}
        </DashboardLayout>
    );
}
