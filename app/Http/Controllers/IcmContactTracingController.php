<?php

namespace App\Http\Controllers;

use App\Models\TreatmentCase;
use App\Models\TreatmentContactTracing;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * ICM Contact Tracing — the coordinator's view of patients under treatment and
 * the ACF contact tracing filed for them.
 *
 * This is deliberately a much smaller surface than the RHU's Patient
 * Monitoring. The RHU owns the treatment workflow — reviews, weekly dispensing,
 * follow-up examinations, case closure. The ICM coordinates, so it gets two
 * read-only tabs: who the patient is, and what contact tracing was done.
 *
 * Nothing here writes, and no new tables were added: the list is the existing
 * `treatment_cases`, and the report is the existing `treatment_contact_tracings`
 * the RHU fills in.
 *
 * Unlike the RHU, an ICM coordinator is not scoped to one municipality — the
 * accounts screen and the dashboard analytics are province-wide, and so is this.
 */
class IcmContactTracingController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $search = trim($filters['search'] ?? '');

        // "Currently under treatment" is the existing open-case scope — a case
        // with no outcome recorded. Closed cases are excluded, which is what
        // keeps completed and lost-to-follow-up patients off this list.
        $base = TreatmentCase::query()->whereOpen();

        // The whole register at once, one row per patient, in the same shape
        // as the RHU's Patient Tracker: every ACF answer is a column, so the
        // coordinator reads the filed forms side by side.
        $cases = (clone $base)
            ->with(['patient', 'contactTracing'])
            ->when($search !== '', function (Builder $query) use ($search): void {
                $escaped = addcslashes($search, '%_\\');

                $query->where(fn (Builder $scoped) => $scoped
                    ->where('case_number', 'like', '%'.$escaped.'%')
                    ->orWhereHas('patient', fn (Builder $patient) => $patient
                        ->where('name', 'like', '%'.$escaped.'%')));
            })
            ->get()
            ->sortBy(fn (TreatmentCase $case) => mb_strtolower($case->patient?->name ?? ''))
            ->values()
            ->map(fn (TreatmentCase $case, int $index) => [
                'id' => $case->id,
                'number' => $index + 1,
                'case_number' => $case->case_number,
                'patient_name' => $case->patient?->name ?? '—',
                'contact_number' => $case->patient?->contact_number,
                'municipality' => $case->municipality,
                'has_tracing' => $case->contactTracing !== null,
                'tracing' => $this->tracingRow($case),
            ]);

        return Inertia::render('Icm/ContactTracing/Index', [
            'cases' => $cases,
            'filters' => ['search' => $search],
            'stats' => [
                'under_treatment' => (clone $base)->count(),
                'traced' => (clone $base)->whereHas('contactTracing')->count(),
                'pending' => (clone $base)->whereDoesntHave('contactTracing')->count(),
            ],
            // The same option lists the RHU's form offers, so the register's
            // selects show the recorded answer with its exact wording.
            'options' => [
                'visit_types' => TreatmentContactTracing::VISIT_TYPES,
                'yes_no' => TreatmentContactTracing::YES_NO,
                'taking_meds' => TreatmentContactTracing::TAKING_MEDS,
                'tpt_reasons' => TreatmentContactTracing::TPT_REASONS,
            ],
        ]);
    }

    /**
     * The filed ACF answers as one flat row of the register — the raw values,
     * keyed as the RHU's form stores them, so a select can show the recorded
     * option. Blank when nothing has been filed yet.
     *
     * @return array<string, string>
     */
    private function tracingRow(TreatmentCase $case): array
    {
        $report = $case->contactTracing;

        $text = fn (mixed $value): string => $value === null ? '' : (string) $value;

        return [
            'patient_address' => $text($report?->patient_address ?? $case->patient?->address),
            'acf_date' => $report?->acf_date?->toDateString() ?? '',
            'province' => $text($report?->province),
            'municipality' => $text($report?->municipality),
            'community' => $text($report?->community),
            'registry_no' => $text($report?->registry_no),
            'phone' => $text($report?->phone ?? $case->patient?->contact_number),
            'visit_date' => $report?->visit_date?->toDateString() ?? '',
            'visit_type' => $text($report?->visit_type),
            'rhu_contacted' => $text($report?->rhu_contacted),
            'started_medication' => $text($report?->started_medication),
            'accompaniment' => $text($report?->accompaniment),
            'household_total' => $text($report?->household_total),
            'household_symptoms' => $text($report?->household_symptoms),
            'household_tb' => $text($report?->household_tb),
            'household_taking_meds' => $text($report?->household_taking_meds),
            'referral_cards' => $text($report?->referral_cards),
            'tpt_total' => $text($report?->tpt_total),
            'tpt_0_to_4' => $text($report?->tpt_0_to_4),
            'tpt_5_to_14' => $text($report?->tpt_5_to_14),
            'tpt_15_plus' => $text($report?->tpt_15_plus),
            'tpt_reason' => $text($report?->tpt_reason),
            'enumerator' => $text($report?->enumerator),
        ];
    }

    /**
     * One patient: the summary, and the contact tracing filed for them.
     *
     * Two tabs, both read-only. The RHU's monitoring, dispensing, follow-up and
     * closure screens are not reachable from here.
     */
    public function show(TreatmentCase $case): Response
    {
        $case->load(['patient', 'contactTracing', 'enroller', 'monitoringEntries', 'dispensingRecords']);

        return Inertia::render('Icm/ContactTracing/Show', [
            'case' => [
                'id' => $case->id,
                'case_number' => $case->case_number,
                'status_label' => $case->outcome ?? 'On Treatment',
                'is_closed' => $case->isClosed(),
                'current_month' => $case->currentMonth(),
                'total_months' => TreatmentCase::TOTAL_MONTHS,
                'municipality' => $case->municipality,
                'treatment_facility' => $case->treatment_facility,
                'diagnostic_facility' => $case->diagnostic_facility,
                'assigned_provider' => $case->assigned_provider,
                'registration_group' => $case->registration_group,
                'registration_date' => $case->registration_date?->format('M j, Y'),
                'treatment_start_date' => $case->treatment_start_date?->format('M j, Y'),
                'regimen' => $case->regimen,
                'enrolled_as' => $case->enrolled_as,
                'enrolled_by' => $case->enroller?->name,

                'patient' => [
                    'name' => $case->patient?->name,
                    'age' => $case->patient?->age,
                    'sex' => $case->patient?->sex,
                    'address' => $case->patient?->address,
                    'contact_number' => $case->patient?->contact_number,
                    'tb_diagnosis' => $case->patient?->tbDiagnosisLabel() ?? '—',
                ],
            ],
            'tracing' => $this->tracing($case),
        ]);
    }

    /**
     * The ACF report as label/value rows, grouped exactly as the form files it.
     *
     * Presented rather than sent raw because this view never edits it — the
     * coordinator reads what the RHU recorded.
     *
     * @return array<string, mixed>|null
     */
    private function tracing(TreatmentCase $case): ?array
    {
        $report = $case->contactTracing;

        if ($report === null) {
            return null;
        }

        $value = fn (?string $text): string => filled($text) ? $text : '—';

        return [
            'recorded_by' => $report->recorder?->name,
            'updated_at_label' => $report->updated_at->format('M j, Y – g:i A'),
            'groups' => [
                [
                    'title' => '1. ACF Activity',
                    'items' => [
                        ['label' => 'TB Patient Name (Enrolled in TB DOTS)', 'value' => $case->patient?->name],
                        ['label' => "Patient's Address (Base in Attendance Sheet)", 'value' => $value($report->patient_address)],
                        ['label' => 'Date of ACF Activity', 'value' => $report->acf_date?->format('M j, Y') ?? '—'],
                        ['label' => 'Province', 'value' => $value($report->province)],
                        ['label' => 'Municipality', 'value' => $value($report->municipality)],
                        ['label' => 'Community', 'value' => $value($report->community)],
                        ['label' => 'TB Registry Number', 'value' => $value($report->registry_no)],
                        ['label' => "Patient's phone Number if available", 'value' => $value($report->phone)],
                    ],
                ],
                [
                    'title' => '2. Patient Follow-up',
                    'items' => [
                        ['label' => 'Date of Call or Home Visit', 'value' => $report->visit_date?->format('M j, Y') ?? '—'],
                        ['label' => 'Call or Home Visit?', 'value' => $value($report->visit_type)],
                        ['label' => '1. Has the RHU/CHO contacted you?', 'value' => $value($report->rhu_contacted)],
                        ['label' => 'Have you started medication?', 'value' => $value($report->started_medication)],
                        ['label' => '2. Do you have accompaniment to the RHU?', 'value' => $value($report->accompaniment)],
                    ],
                ],
                [
                    'title' => '3. Household Assessment',
                    'items' => [
                        ['label' => '3. How many people live in your household?', 'value' => (string) $report->household_total],
                        ['label' => '4. How many HH members have symptoms?', 'value' => (string) $report->household_symptoms],
                        ['label' => '5. How many HH members have TB?', 'value' => (string) $report->household_tb],
                        ['label' => 'If have, are they taking TB medication?', 'value' => $value($report->household_taking_meds)],
                        ['label' => '6. Were referral cards given?', 'value' => $value($report->referral_cards)],
                        ['label' => '7. If already, how many HH members enrolled in preventive therapy (TPT)?', 'value' => (string) $report->tpt_total],
                    ],
                ],
                [
                    'title' => '4. TPT Enrollment',
                    'items' => [
                        ['label' => '# of HH members enrolled in preventive therapy (TPT) 0 to 4 years old', 'value' => (string) $report->tpt_0_to_4],
                        ['label' => '# of HH members enrolled in preventive therapy (TPT) 5 to 14 years old', 'value' => (string) $report->tpt_5_to_14],
                        ['label' => '# of HH members enrolled in preventive therapy (TPT) 15 years old and above', 'value' => (string) $report->tpt_15_plus],
                        ['label' => 'Reason why HH members not enrolled for TPT', 'value' => $value($report->tpt_reason)],
                        ['label' => 'Enumerator Name', 'value' => $value($report->enumerator)],
                    ],
                ],
            ],
        ];
    }
}
