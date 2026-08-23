import { useEffect, useRef } from "react";
import {
    FaFlask,
    FaHouseMedical,
    FaNotesMedical,
    FaUser,
    FaXmark,
} from "react-icons/fa6";

const yesNoOptions = [
    { value: "", label: "Select an answer" },
    { value: "1", label: "Yes" },
    { value: "0", label: "No" },
];

function Field({ label, error, hint, wide = false, children }) {
    return (
        <label className={`rhu-form-field ${wide ? "wide" : ""}`}>
            <span>{label}</span>
            {children}
            {hint && !error && <small className="rhu-form-hint">{hint}</small>}
            {error && <small className="rhu-form-error">{error}</small>}
        </label>
    );
}

function Section({ icon: Icon, title, description, children }) {
    return (
        <section className="rhu-form-section">
            <header>
                <span><Icon aria-hidden="true" /></span>
                <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                </div>
            </header>
            <div className="rhu-form-grid">{children}</div>
        </section>
    );
}

export default function ProgramFormModal({
    formType,
    form,
    onClose,
    onSubmit,
}) {
    const firstInput = useRef(null);
    const { data, setData, errors, processing } = form;
    const isSputum = formType === "sputum_collection";
    const title = isSputum ? "Sputum Collection" : "Contact Tracing";

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key === "Escape" && !processing) onClose();
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);
        window.setTimeout(() => firstInput.current?.focus(), 0);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose, processing]);

    const setResponse = (key, value) => {
        setData("responses", { ...data.responses, [key]: value });
    };
    const responseError = (key) => errors[`responses.${key}`];

    return (
        <div
            className="rhu-form-overlay"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !processing) onClose();
            }}
        >
            <div
                className="rhu-form-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="rhu-form-title"
            >
                <header className="rhu-form-modal-header">
                    <div>
                        <span className="rhu-form-modal-kicker">New patient record</span>
                        <h2 id="rhu-form-title">{title}</h2>
                        <p>Complete what you know now. You can save an incomplete record as a draft.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={processing}
                        aria-label="Close form"
                    >
                        <FaXmark />
                    </button>
                </header>

                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        onSubmit("completed");
                    }}
                >
                    <div className="rhu-form-scroll">
                        <Section
                            icon={FaUser}
                            title="Patient details"
                            description="Identify the patient before recording health information."
                        >
                            <Field label="Patient ID" error={errors.patient_id}>
                                <input
                                    ref={firstInput}
                                    type="text"
                                    value={data.patient_id}
                                    onChange={(event) => setData("patient_id", event.target.value)}
                                    placeholder="Optional local or program ID"
                                    aria-invalid={Boolean(errors.patient_id)}
                                />
                            </Field>
                            <Field label="Patient name *" error={errors.patient_name}>
                                <input
                                    type="text"
                                    value={data.patient_name}
                                    onChange={(event) => setData("patient_name", event.target.value)}
                                    placeholder="Full name"
                                    aria-invalid={Boolean(errors.patient_name)}
                                />
                            </Field>
                            <Field label="Age" error={errors.age}>
                                <input
                                    type="number"
                                    min="0"
                                    max="120"
                                    value={data.age}
                                    onChange={(event) => setData("age", event.target.value)}
                                    placeholder="Age in years"
                                    aria-invalid={Boolean(errors.age)}
                                />
                            </Field>
                            <Field label="Sex" error={errors.sex}>
                                <select
                                    value={data.sex}
                                    onChange={(event) => setData("sex", event.target.value)}
                                    aria-invalid={Boolean(errors.sex)}
                                >
                                    <option value="">Select sex</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </Field>
                            <Field label="Contact number" error={errors.contact_number}>
                                <input
                                    type="tel"
                                    value={data.contact_number}
                                    onChange={(event) => setData("contact_number", event.target.value)}
                                    placeholder="e.g. +63 912 345 6789"
                                    aria-invalid={Boolean(errors.contact_number)}
                                />
                            </Field>
                            <Field label="Home address" error={errors.address}>
                                <input
                                    type="text"
                                    value={data.address}
                                    onChange={(event) => setData("address", event.target.value)}
                                    placeholder="Barangay, municipality, province"
                                    aria-invalid={Boolean(errors.address)}
                                />
                            </Field>
                        </Section>

                        {isSputum ? (
                            <>
                                <Section
                                    icon={FaNotesMedical}
                                    title="Collection"
                                    description="Record collection status and any support the patient needs."
                                >
                                    <Field
                                        label="Was sputum collected? *"
                                        error={responseError("sputum_collected")}
                                    >
                                        <select
                                            value={data.responses.sputum_collected}
                                            onChange={(event) => setResponse("sputum_collected", event.target.value)}
                                            aria-invalid={Boolean(responseError("sputum_collected"))}
                                        >
                                            {yesNoOptions.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="BHW will visit patient">
                                        <select
                                            value={data.responses.bhw_will_visit}
                                            onChange={(event) => setResponse("bhw_will_visit", event.target.value)}
                                        >
                                            {yesNoOptions.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Needs transport subsidy">
                                        <select
                                            value={data.responses.needs_transport}
                                            onChange={(event) => setResponse("needs_transport", event.target.value)}
                                        >
                                            {yesNoOptions.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field
                                        label="Reason not collected"
                                        error={responseError("not_collected_reason")}
                                        wide
                                    >
                                        <textarea
                                            value={data.responses.not_collected_reason}
                                            onChange={(event) => setResponse("not_collected_reason", event.target.value)}
                                            placeholder="Add a reason only when sputum was not collected"
                                            rows="3"
                                        />
                                    </Field>
                                </Section>

                                <Section
                                    icon={FaFlask}
                                    title="Diagnostic testing"
                                    description="Capture tests performed and the latest available result."
                                >
                                    <Field label="Tested with GeneXpert">
                                        <select
                                            value={data.responses.tested_gene_xpert}
                                            onChange={(event) => setResponse("tested_gene_xpert", event.target.value)}
                                        >
                                            {yesNoOptions.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Tested with DSSM">
                                        <select
                                            value={data.responses.tested_dssm}
                                            onChange={(event) => setResponse("tested_dssm", event.target.value)}
                                        >
                                            {yesNoOptions.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Diagnostic result">
                                        <select
                                            value={data.responses.diagnostic_result}
                                            onChange={(event) => setResponse("diagnostic_result", event.target.value)}
                                        >
                                            <option value="">Select result</option>
                                            <option value="pending">Pending</option>
                                            <option value="negative">Negative</option>
                                            <option value="positive">Positive</option>
                                        </select>
                                    </Field>
                                    <Field label="Positive classification">
                                        <select
                                            value={data.responses.positive_classification}
                                            onChange={(event) => setResponse("positive_classification", event.target.value)}
                                        >
                                            <option value="">Not applicable</option>
                                            <option value="dssm">DSSM</option>
                                            <option value="rr">RR</option>
                                            <option value="t">T</option>
                                            <option value="tt">TT</option>
                                            <option value="ti">TI</option>
                                        </select>
                                    </Field>
                                </Section>

                                <Section
                                    icon={FaHouseMedical}
                                    title="Treatment & contact outcomes"
                                    description="Record diagnosis, enrollment, and preventive therapy outcomes."
                                >
                                    <Field label="TB case classification">
                                        <select
                                            value={data.responses.tb_case_classification}
                                            onChange={(event) => setResponse("tb_case_classification", event.target.value)}
                                        >
                                            <option value="">Select classification</option>
                                            <option value="none">No TB case identified</option>
                                            <option value="bc_ds_tb">Bacteriologically confirmed DS-TB</option>
                                            <option value="cd_ds_tb">Clinically diagnosed DS-TB</option>
                                            <option value="rr_tb">Rifampicin-resistant TB</option>
                                        </select>
                                    </Field>
                                    <Field label="Enrolled in TB treatment">
                                        <select
                                            value={data.responses.enrolled_tb_treatment}
                                            onChange={(event) => setResponse("enrolled_tb_treatment", event.target.value)}
                                        >
                                            {yesNoOptions.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="TB registry number">
                                        <input
                                            type="text"
                                            value={data.responses.tb_registry_number}
                                            onChange={(event) => setResponse("tb_registry_number", event.target.value)}
                                            placeholder="Registry number"
                                        />
                                    </Field>
                                    <Field label="Contacts enrolled to TPT, age 5–14">
                                        <input
                                            type="number" min="0"
                                            value={data.responses.tpt_5_14}
                                            onChange={(event) => setResponse("tpt_5_14", event.target.value)}
                                        />
                                    </Field>
                                    <Field label="Contacts enrolled to TPT, age 15+">
                                        <input
                                            type="number" min="0"
                                            value={data.responses.tpt_15_plus}
                                            onChange={(event) => setResponse("tpt_15_plus", event.target.value)}
                                        />
                                    </Field>
                                    <Field label="Contacts diagnosed with TB">
                                        <input
                                            type="number" min="0"
                                            value={data.responses.contacts_diagnosed_tb}
                                            onChange={(event) => setResponse("contacts_diagnosed_tb", event.target.value)}
                                        />
                                    </Field>
                                    <Field label="Diagnosed contacts enrolled">
                                        <input
                                            type="number" min="0"
                                            value={data.responses.contacts_enrolled_treatment}
                                            onChange={(event) => setResponse("contacts_enrolled_treatment", event.target.value)}
                                        />
                                    </Field>
                                    <Field label="Remarks" wide>
                                        <textarea
                                            value={data.responses.remarks}
                                            onChange={(event) => setResponse("remarks", event.target.value)}
                                            placeholder="Optional notes or follow-up details"
                                            rows="3"
                                        />
                                    </Field>
                                </Section>
                            </>
                        ) : (
                            <>
                                <Section
                                    icon={FaNotesMedical}
                                    title="Follow-up visit"
                                    description="Record when and how the patient was reached."
                                >
                                    <Field label="Date of call or home visit *" error={responseError("visit_date")}>
                                        <input
                                            type="date"
                                            value={data.responses.visit_date}
                                            onChange={(event) => setResponse("visit_date", event.target.value)}
                                            aria-invalid={Boolean(responseError("visit_date"))}
                                        />
                                    </Field>
                                    <Field label="Contact method *" error={responseError("contact_method")}>
                                        <select
                                            value={data.responses.contact_method}
                                            onChange={(event) => setResponse("contact_method", event.target.value)}
                                            aria-invalid={Boolean(responseError("contact_method"))}
                                        >
                                            <option value="">Select method</option>
                                            <option value="call">Phone call</option>
                                            <option value="home_visit">Home visit</option>
                                        </select>
                                    </Field>
                                    <Field label="RHU/CHO has contacted patient">
                                        <select
                                            value={data.responses.rhu_contacted}
                                            onChange={(event) => setResponse("rhu_contacted", event.target.value)}
                                        >
                                            {yesNoOptions.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Patient started medication">
                                        <select
                                            value={data.responses.started_medication}
                                            onChange={(event) => setResponse("started_medication", event.target.value)}
                                        >
                                            {yesNoOptions.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </Field>
                                    <Field label="Has accompaniment to RHU">
                                        <select
                                            value={data.responses.has_accompaniment}
                                            onChange={(event) => setResponse("has_accompaniment", event.target.value)}
                                        >
                                            {yesNoOptions.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </Field>
                                </Section>

                                <Section
                                    icon={FaHouseMedical}
                                    title="Household assessment"
                                    description="Summarize household exposure, symptoms, and referrals."
                                >
                                    <Field label="People in household">
                                        <input type="number" min="0" value={data.responses.household_count} onChange={(event) => setResponse("household_count", event.target.value)} />
                                    </Field>
                                    <Field label="Members with symptoms">
                                        <input type="number" min="0" value={data.responses.household_symptoms_count} onChange={(event) => setResponse("household_symptoms_count", event.target.value)} />
                                    </Field>
                                    <Field label="Members with TB">
                                        <input type="number" min="0" value={data.responses.household_tb_count} onChange={(event) => setResponse("household_tb_count", event.target.value)} />
                                    </Field>
                                    <Field label="Members with TB taking medication">
                                        <select value={data.responses.household_taking_medication} onChange={(event) => setResponse("household_taking_medication", event.target.value)}>
                                            {yesNoOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Referral cards given">
                                        <select value={data.responses.referral_cards_given} onChange={(event) => setResponse("referral_cards_given", event.target.value)}>
                                            {yesNoOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </Field>
                                </Section>

                                <Section
                                    icon={FaFlask}
                                    title="Preventive therapy & outcomes"
                                    description="Record TPT enrollment and any newly identified TB cases."
                                >
                                    <Field label="Total household members in TPT">
                                        <input type="number" min="0" value={data.responses.tpt_total} onChange={(event) => setResponse("tpt_total", event.target.value)} />
                                    </Field>
                                    <Field label="TPT, age 0–4">
                                        <input type="number" min="0" value={data.responses.tpt_0_4} onChange={(event) => setResponse("tpt_0_4", event.target.value)} />
                                    </Field>
                                    <Field label="TPT, age 5–14">
                                        <input type="number" min="0" value={data.responses.ct_tpt_5_14} onChange={(event) => setResponse("ct_tpt_5_14", event.target.value)} />
                                    </Field>
                                    <Field label="TPT, age 15+">
                                        <input type="number" min="0" value={data.responses.ct_tpt_15_plus} onChange={(event) => setResponse("ct_tpt_15_plus", event.target.value)} />
                                    </Field>
                                    <Field label="Reason members are not enrolled" wide>
                                        <textarea rows="3" value={data.responses.tpt_not_enrolled_reason} onChange={(event) => setResponse("tpt_not_enrolled_reason", event.target.value)} placeholder="Optional reason or barrier" />
                                    </Field>
                                    <Field label="Enumerator name">
                                        <input type="text" value={data.responses.enumerator_name} onChange={(event) => setResponse("enumerator_name", event.target.value)} />
                                    </Field>
                                    <Field label="TB case identified">
                                        <select value={data.responses.tb_case_identified} onChange={(event) => setResponse("tb_case_identified", event.target.value)}>
                                            {yesNoOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Enrolled in TB treatment">
                                        <select value={data.responses.contact_enrolled_treatment} onChange={(event) => setResponse("contact_enrolled_treatment", event.target.value)}>
                                            {yesNoOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Contacts enrolled to TPT">
                                        <input type="number" min="0" value={data.responses.contacts_enrolled_tpt} onChange={(event) => setResponse("contacts_enrolled_tpt", event.target.value)} />
                                    </Field>
                                    <Field label="Remarks" wide>
                                        <textarea rows="3" value={data.responses.remarks} onChange={(event) => setResponse("remarks", event.target.value)} placeholder="Optional notes or follow-up details" />
                                    </Field>
                                </Section>
                            </>
                        )}
                    </div>

                    <footer className="rhu-form-actions">
                        <p>Fields marked * are required to complete the form.</p>
                        <div>
                            <button type="button" className="secondary" onClick={() => onSubmit("draft")} disabled={processing}>
                                {processing ? "Saving…" : "Save draft"}
                            </button>
                            <button type="submit" className="primary" disabled={processing}>
                                {processing ? "Saving…" : "Complete form"}
                            </button>
                        </div>
                    </footer>
                </form>
            </div>
        </div>
    );
}
