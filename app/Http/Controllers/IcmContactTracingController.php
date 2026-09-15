<?php

namespace App\Http\Controllers;

use App\Models\ContactTracingRecord;
use App\Models\TreatmentEnrollment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * ICM Contact Tracing — the coordinator's read-only view of patients under
 * treatment and the ACF contact tracing filed for them. The RHU owns the
 * treatment workflow (reviews, dispensing, follow-ups, closure, and the
 * contact tracing form itself); this screen only monitors what was filed.
 *
 * Ported from the medjofinal reference's `IcmContactTracingController`, but
 * rewritten against this session's schema: the reference's `TreatmentCase`/
 * `TreatmentContactTracing` (one row per case, ACF-header fields stored on
 * the report) map to this schema's `TreatmentEnrollment`/`ContactTracingRecord`
 * (the record is per-patient, and the ACF-header fields — address, province,
 * municipality, registry number, phone — are never stored on it at all;
 * they're computed live via `Patient::acfDefaults()`, same source the RHU's
 * own Contact Tracing form prefills from). So here they're always shown from
 * `acfDefaults()`, regardless of whether the household/visit part of the form
 * has been filed yet — they can't drift from the patient/program/enrollment
 * rows they're read from.
 *
 * Not scoped to a municipality — the ICM coordinates the whole programme, as
 * the accounts screen and the dashboard analytics already are.
 */
class IcmContactTracingController extends Controller
{
    private const CONTACT_METHOD_LABELS = [
        'call' => 'Call',
        'home_visit' => 'Home Visit',
    ];

    private const TPT_REASON_LABELS = [
        'contact_of_cd_patient' => 'Contact of CD patient',
        'rhu_not_providing_tpt' => 'RHU not providing TPT',
        'contact_refused_tpt' => 'Contact refused TPT',
        'negative_cxr' => 'Negative CXR',
        'other' => 'Other',
    ];

    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $search = trim($filters['search'] ?? '');

        $base = TreatmentEnrollment::query()->whereNull('outcome');

        $cases = (clone $base)
            ->with(['patient.contactTracingRecord', 'patient.program.location.parent'])
            ->when($search !== '', function (Builder $query) use ($search): void {
                $escaped = addcslashes($search, '%_\\');

                $query->where(fn (Builder $scoped) => $scoped
                    ->where('registry_number', 'like', '%'.$escaped.'%')
                    ->orWhereHas('patient', fn (Builder $patient) => $patient
                        ->where('name', 'like', '%'.$escaped.'%')));
            })
            ->get()
            ->sortBy(fn (TreatmentEnrollment $enrollment) => mb_strtolower($enrollment->patient?->name ?? ''))
            ->values()
            ->map(fn (TreatmentEnrollment $enrollment, int $index) => [
                'id' => $enrollment->id,
                'number' => $index + 1,
                'case_number' => $enrollment->registry_number,
                'patient_name' => $enrollment->patient?->name ?? '—',
                'municipality' => $enrollment->patient?->acfDefaults()['municipality'] ?? null,
                'has_tracing' => $enrollment->patient?->contactTracingRecord !== null,
                'tracing' => $this->tracingRow($enrollment),
            ]);

        return Inertia::render('Icm/ContactTracing/Index', [
            'cases' => $cases,
            'filters' => ['search' => $search],
            'stats' => [
                'under_treatment' => (clone $base)->count(),
                'traced' => (clone $base)->whereHas('patient.contactTracingRecord')->count(),
                'pending' => (clone $base)->whereDoesntHave('patient.contactTracingRecord')->count(),
            ],
            'options' => [
                'visit_types' => ContactTracingRecord::VISIT_TYPES,
                'yes_no' => ContactTracingRecord::YES_NO,
                'taking_meds' => ContactTracingRecord::TAKING_MEDS,
                'tpt_reasons' => ContactTracingRecord::TPT_REASONS,
            ],
        ]);
    }

    /**
     * One register row: the ACF-header fields from `acfDefaults()` (always
     * present), and the filed visit/household/TPT answers from the patient's
     * `ContactTracingRecord` if one exists yet (blank otherwise).
     *
     * @return array<string, string>
     */
    private function tracingRow(TreatmentEnrollment $enrollment): array
    {
        $patient = $enrollment->patient;
        $defaults = $patient?->acfDefaults() ?? [];
        $report = $patient?->contactTracingRecord;

        $text = fn (mixed $value): string => $value === null ? '' : (string) $value;
        $yesNo = fn (?bool $value): string => $value === null ? '' : ($value ? 'Yes' : 'No');

        return [
            'patient_address' => $text($defaults['patient_address'] ?? null),
            'acf_date' => $text($defaults['acf_date'] ?? null),
            'province' => $text($defaults['province'] ?? null),
            'municipality' => $text($defaults['municipality'] ?? null),
            'community' => $text($defaults['community'] ?? null),
            'registry_no' => $text($defaults['registry_no'] ?? null),
            'phone' => $text($defaults['phone'] ?? null),
            'visit_date' => $report?->visit_date?->toDateString() ?? '',
            'visit_type' => $report?->contact_method !== null
                ? $text(self::CONTACT_METHOD_LABELS[$report->contact_method] ?? null)
                : '',
            'rhu_contacted' => $report ? $yesNo($report->rhu_contacted) : '',
            'started_medication' => $report ? $yesNo($report->started_medication) : '',
            'accompaniment' => $report ? $yesNo($report->has_accompaniment) : '',
            'household_total' => $text($report?->household_count),
            'household_symptoms' => $text($report?->household_symptoms_count),
            'household_tb' => $text($report?->household_tb_count),
            'household_taking_meds' => $report ? $yesNo($report->household_taking_medication) : '',
            'referral_cards' => $report ? $yesNo($report->referral_cards_given) : '',
            'tpt_total' => $text($report?->tpt_total),
            'tpt_0_to_4' => $text($report?->tpt_0_4),
            'tpt_5_to_14' => $text($report?->tpt_5_14),
            'tpt_15_plus' => $text($report?->tpt_15_plus),
            'tpt_reason' => $report?->tpt_not_enrolled_reason !== null
                ? $text(self::TPT_REASON_LABELS[$report->tpt_not_enrolled_reason] ?? null)
                : '',
            'enumerator' => $text($report?->enumerator_name),
        ];
    }

    /**
     * One patient: the summary, and the contact tracing filed for them.
     * Both tabs are read-only — the RHU's monitoring, dispensing, follow-up
     * and closure screens are not reachable from here.
     */
    public function show(TreatmentEnrollment $case): Response
    {
        $case->load([
            'patient.contactTracingRecord.recorder',
            'patient.diagnosticAssessment',
            'patient.program.location.parent',
            'assignedProvider',
            'creator',
        ]);

        $patient = $case->patient;

        return Inertia::render('Icm/ContactTracing/Show', [
            'case' => [
                'id' => $case->id,
                'case_number' => $case->registry_number,
                'status_label' => $case->outcome ?? 'On Treatment',
                'is_closed' => ! $case->isOnTreatment(),
                'current_month' => $case->currentMonth(),
                'total_months' => $case->regimenMonthCount(),
                'municipality' => $patient?->acfDefaults()['municipality'] ?? null,
                'treatment_facility' => $case->treatment_facility,
                'diagnostic_facility' => $case->diagnosing_facility,
                'assigned_provider' => $case->assignedProvider?->name,
                'registration_group' => $case->registration_group,
                'registration_date' => $case->registration_date?->format('M j, Y'),
                'treatment_start_date' => $case->treatment_start_date?->format('M j, Y'),
                'regimen' => $case->treatment_regimen,
                'enrolled_as' => $patient?->diagnosticAssessment?->diagnosisLabel(),
                'enrolled_by' => $case->creator?->name,

                'patient' => [
                    'name' => $patient?->name,
                    'age' => $patient?->age,
                    'sex' => $patient?->sex,
                    'address' => $patient?->address,
                    'contact_number' => $patient?->contact_number,
                    'tb_diagnosis' => $patient?->diagnosticAssessment?->diagnosisLabel() ?? '—',
                ],
            ],
            'tracing' => $this->tracing($case),
        ]);
    }

    /**
     * The ACF report as label/value rows, grouped exactly as the RHU's form
     * files it. Null when nothing has been filed yet for this patient — the
     * coordinator reads what the RHU recorded, never an empty form.
     *
     * @return array<string, mixed>|null
     */
    private function tracing(TreatmentEnrollment $enrollment): ?array
    {
        $patient = $enrollment->patient;
        $report = $patient?->contactTracingRecord;

        if ($report === null) {
            return null;
        }

        $defaults = $patient->acfDefaults();
        $value = fn (?string $text): string => filled($text) ? $text : '—';
        $yesNo = fn (?bool $value): string => $value ? 'Yes' : 'No';

        return [
            'recorded_by' => $report->recorder?->name,
            'updated_at_label' => $report->updated_at->format('M j, Y – g:i A'),
            'groups' => [
                [
                    'title' => '1. ACF Activity',
                    'items' => [
                        ['label' => 'TB Patient Name (Enrolled in TB DOTS)', 'value' => $patient->name],
                        ['label' => "Patient's Address (Base in Attendance Sheet)", 'value' => $value($defaults['patient_address'] ?? null)],
                        ['label' => 'Date of ACF Activity', 'value' => isset($defaults['acf_date']) ? \Illuminate\Support\Carbon::parse($defaults['acf_date'])->format('M j, Y') : '—'],
                        ['label' => 'Province', 'value' => $value($defaults['province'] ?? null)],
                        ['label' => 'Municipality', 'value' => $value($defaults['municipality'] ?? null)],
                        ['label' => 'Community', 'value' => $value($defaults['community'] ?? null)],
                        ['label' => 'TB Registry Number', 'value' => $value($defaults['registry_no'] ?? null)],
                        ['label' => "Patient's phone Number if available", 'value' => $value($defaults['phone'] ?? null)],
                    ],
                ],
                [
                    'title' => '2. Patient Follow-up',
                    'items' => [
                        ['label' => 'Date of Call or Home Visit', 'value' => $report->visit_date?->format('M j, Y') ?? '—'],
                        ['label' => 'Call or Home Visit?', 'value' => $value(self::CONTACT_METHOD_LABELS[$report->contact_method] ?? null)],
                        ['label' => '1. Has the RHU/CHO contacted you?', 'value' => $yesNo($report->rhu_contacted)],
                        ['label' => 'Have you started medication?', 'value' => $yesNo($report->started_medication)],
                        ['label' => '2. Do you have accompaniment to the RHU?', 'value' => $yesNo($report->has_accompaniment)],
                    ],
                ],
                [
                    'title' => '3. Household Assessment',
                    'items' => [
                        ['label' => '3. How many people live in your household?', 'value' => (string) $report->household_count],
                        ['label' => '4. How many HH members have symptoms?', 'value' => (string) $report->household_symptoms_count],
                        ['label' => '5. How many HH members have TB?', 'value' => (string) $report->household_tb_count],
                        ['label' => 'If have, are they taking TB medication?', 'value' => $yesNo($report->household_taking_medication)],
                        ['label' => '6. Were referral cards given?', 'value' => $yesNo($report->referral_cards_given)],
                        ['label' => '7. If already, how many HH members enrolled in preventive therapy (TPT)?', 'value' => (string) $report->tpt_total],
                    ],
                ],
                [
                    'title' => '4. TPT Enrollment',
                    'items' => [
                        ['label' => '# of HH members enrolled in preventive therapy (TPT) 0 to 4 years old', 'value' => (string) $report->tpt_0_4],
                        ['label' => '# of HH members enrolled in preventive therapy (TPT) 5 to 14 years old', 'value' => (string) $report->tpt_5_14],
                        ['label' => '# of HH members enrolled in preventive therapy (TPT) 15 years old and above', 'value' => (string) $report->tpt_15_plus],
                        ['label' => 'Reason why HH members not enrolled for TPT', 'value' => $value(self::TPT_REASON_LABELS[$report->tpt_not_enrolled_reason] ?? null)],
                        ['label' => 'Enumerator Name', 'value' => $value($report->enumerator_name)],
                    ],
                ],
            ],
        ];
    }
}
