<?php

namespace App\Http\Controllers;

use App\Models\ContactTracingRecord;
use App\Models\FollowUpExam;
use App\Models\MedicationDispensingRecord;
use App\Models\Patient;
use App\Models\TreatmentEnrollment;
use App\Models\TreatmentMonitoringRecord;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\MedicineSupply;
use App\Support\PatientAuditTrail;
use App\Support\TreatmentScheduleState;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Bridges the medjofinal-rhu-provider-portals frontend (`Rhu/Treatment/Show`)
 * onto this session's rebuilt backend. Reads reuse the same models/Support
 * classes the small resource controllers use (PatientSummaryController,
 * TreatmentMonitoringController, etc.) rather than duplicating their logic;
 * the 5 write actions below are new — they can't reuse those controllers
 * directly since the field names, request shapes, and response type
 * (Inertia redirect, not JSON) all differ from what this frontend expects.
 */
class RhuTreatmentController extends Controller
{
    public function index(Request $request): Response
    {
        $rhu = $request->user();

        abort_unless($rhu instanceof User && $rhu->role === 'rhu', 403);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['all', 'active', 'closed'])],
        ]);

        $search = trim($filters['search'] ?? '');
        $status = $filters['status'] ?? 'all';

        $scoped = TreatmentEnrollment::query()
            ->whereHas('patient.program', fn ($query) => $query->where('location_id', $rhu->location_id));

        $cases = (clone $scoped)
            ->with('patient')
            ->when($status === 'active', fn ($query) => $query->whereNull('outcome'))
            ->when($status === 'closed', fn ($query) => $query->whereNotNull('outcome'))
            ->when($search !== '', function ($query) use ($search) {
                $escaped = addcslashes($search, '%_\\');

                $query->where(fn ($scoped) => $scoped
                    ->where('registry_number', 'like', '%'.$escaped.'%')
                    ->orWhereHas('patient', fn ($patient) => $patient->where('name', 'like', '%'.$escaped.'%')));
            })
            ->latest('updated_at')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (TreatmentEnrollment $case) => [
                'id' => $case->id,
                'case_number' => $case->registry_number,
                'patient_name' => $case->patient?->name ?? '—',
                'status' => $case->isOnTreatment() ? 'active' : 'closed',
                'status_label' => $case->outcome ?? 'On Treatment',
                'current_month' => $case->currentMonth(),
                'updated_at_label' => $case->updated_at?->format('M j, Y'),
            ]);

        return Inertia::render('Rhu/Treatment/Index', [
            'cases' => $cases,
            'filters' => ['search' => $search, 'status' => $status],
            'stats' => [
                'total' => (clone $scoped)->count(),
                'active' => (clone $scoped)->whereNull('outcome')->count(),
                'closed' => (clone $scoped)->whereNotNull('outcome')->count(),
            ],
            'enrollment' => [
                'candidates' => $this->enrollmentCandidates($rhu),
                'registration_groups' => TreatmentEnrollment::REGISTRATION_GROUPS,
                'regimens' => TreatmentEnrollment::TREATMENT_REGIMENS,
                'assigned_provider' => $rhu->name,
                'treatment_facility' => $rhu->location?->name ? "RHU {$rhu->location->name}" : $rhu->name,
                'diagnostic_facility' => $rhu->location?->name ? "RHU {$rhu->location->name}" : $rhu->name,
                'next_case_number' => TreatmentEnrollment::allocateRegistryNumber(),
            ],
            'municipality' => $rhu->location?->name,
        ]);
    }

    /**
     * Enroll a diagnosed patient from the Patient Monitoring list's quick
     * modal. This is a second enrollment entry point alongside the existing
     * TreatmentEnrollmentController page (`rhu/patients/{patient}/enroll`)
     * — that one has the RHU type registry_number by hand; this one didn't
     * collect it at all in the pulled form, so it's allocated here instead
     * (see TreatmentEnrollment::allocateRegistryNumber()).
     */
    public function store(Request $request): RedirectResponse
    {
        $rhu = $request->user();

        abort_unless($rhu instanceof User && $rhu->role === 'rhu', 403);

        $validated = $request->validate([
            'patient_id' => ['required', 'integer'],
            'registration_group' => ['required', Rule::in(TreatmentEnrollment::REGISTRATION_GROUPS)],
            'regimen' => ['required', Rule::in(TreatmentEnrollment::TREATMENT_REGIMENS)],
            'treatment_start_date' => ['required', 'date'],
            'baseline_weight' => ['nullable', 'numeric', 'min:0', 'max:999.9'],
        ]);

        $patient = Patient::query()->findOrFail($validated['patient_id']);

        abort_unless($patient->program?->location_id === $rhu->location_id, 404);

        if ($patient->diagnosticAssessment?->tb_diagnosis === null) {
            throw ValidationException::withMessages([
                'patient_id' => 'This patient has no confirmed TB diagnosis on record and cannot be enrolled in treatment.',
            ]);
        }

        if ($patient->treatmentEnrollments()->whereNull('outcome')->exists()) {
            throw ValidationException::withMessages([
                'patient_id' => 'This patient already has an active treatment case.',
            ]);
        }

        $facility = $rhu->location?->name ? "RHU {$rhu->location->name}" : $rhu->name;

        $case = DB::transaction(function () use ($rhu, $patient, $validated, $facility): TreatmentEnrollment {
            $case = TreatmentEnrollment::create([
                'patient_id' => $patient->id,
                'registry_number' => TreatmentEnrollment::allocateRegistryNumber(lock: true),
                'treatment_facility' => $facility,
                'diagnosing_facility' => $facility,
                'registration_date' => now()->toDateString(),
                'registration_group' => $validated['registration_group'],
                'treatment_regimen' => $validated['regimen'],
                'treatment_start_date' => $validated['treatment_start_date'],
                'baseline_weight' => $validated['baseline_weight'] ?? null,
                'assigned_provider_id' => $rhu->id,
                'created_by' => $rhu->id,
            ]);

            ActivityLogger::record(
                $rhu,
                'treatment.enrolled',
                'Enrolled patient in treatment',
                "{$patient->name} was enrolled under registry number {$case->registry_number}.",
                ['patient_id' => $patient->id, 'enrollment_id' => $case->id],
                $case,
            );

            return $case;
        });

        return redirect()
            ->route('rhu.treatment.show', $case)
            ->with('success', "Patient successfully enrolled. Registry Number: {$case->registry_number}");
    }

    /**
     * Diagnosed patients in this RHU's catchment with no open treatment
     * case, with the read-only half of the enrolment form already resolved.
     *
     * @return array<int, array<string, mixed>>
     */
    private function enrollmentCandidates(User $rhu): array
    {
        $enrolledPatientIds = TreatmentEnrollment::query()
            ->whereNull('outcome')
            ->pluck('patient_id')
            ->all();

        return Patient::query()
            ->whereHas('program', fn ($query) => $query->where('location_id', $rhu->location_id))
            ->whereHas('diagnosticAssessment', fn ($query) => $query->whereNotNull('tb_diagnosis'))
            ->whereNotIn('id', $enrolledPatientIds)
            ->with('diagnosticAssessment')
            ->get()
            ->map(fn (Patient $patient) => [
                'id' => $patient->id,
                'name' => $patient->name,
                'patient_code' => $patient->patient_code ?? ('P'.str_pad((string) $patient->id, 4, '0', STR_PAD_LEFT)),
                'birthday' => $patient->date_of_birth?->format('M j, Y') ?? '—',
                'address' => $patient->address,
                'tb_diagnosis' => $patient->diagnosticAssessment?->diagnosisLabel(),
                'positives' => [
                    'dssm' => (bool) $patient->diagnosticAssessment?->result_dssm,
                    'rr' => (bool) $patient->diagnosticAssessment?->result_rr,
                    't' => (bool) $patient->diagnosticAssessment?->result_t,
                    'tt' => (bool) $patient->diagnosticAssessment?->result_tt,
                    'ti' => (bool) $patient->diagnosticAssessment?->result_ti,
                ],
            ])
            ->values()
            ->all();
    }

    public function show(Request $request, TreatmentEnrollment $case): Response
    {
        $rhu = $this->authorizeCase($request, $case);

        $patient = $case->patient;
        $diagnosis = $patient->diagnosticAssessment;
        $diagnosisLabel = $diagnosis?->diagnosisLabel();
        $currentMonth = $case->currentMonth();
        $totalMonths = $case->regimenMonthCount();
        $dueMonths = $case->followUpExamScheduleMonths();

        return Inertia::render('Rhu/Treatment/Show', [
            'case' => [
                'id' => $case->id,
                'case_number' => $case->registry_number,
                'patient_name' => $patient->name ?? '—',
                'status' => $case->isOnTreatment() ? 'active' : 'closed',
                'status_label' => $case->outcome ?? 'On Treatment',
                'current_month' => $currentMonth,
                'updated_at_label' => $case->updated_at?->format('M j, Y'),

                'registration_date' => $case->registration_date?->format('M j, Y'),
                'registration_group' => $case->registration_group,
                'regimen' => $case->treatment_regimen,
                'treatment_start_date' => $case->treatment_start_date?->format('M j, Y'),
                'assigned_provider' => $case->assignedProvider?->name,
                'treatment_facility' => $case->treatment_facility,
                'diagnostic_facility' => $case->diagnosing_facility,
                'enrolled_by' => $case->creator?->name,
                'outcome_date' => $case->outcome_date?->format('M j, Y'),
                'outcome_date_value' => $case->outcome_date?->toDateString(),
                'outcome_remarks' => $case->outcome_remarks,
                'baseline_weight' => $case->baseline_weight,
                // Read live, not frozen at enrollment — deliberate, see
                // carelink-tb memory (enrolled_as contradiction, resolved).
                'enrolled_as' => $diagnosisLabel,
                'adherence' => $case->overallAdherencePercentage(),

                'patient' => [
                    'id' => $patient->id,
                    'name' => $patient->name,
                    'age' => $patient->age,
                    'sex' => $patient->sex,
                    'address' => $patient->address,
                    'contact_number' => $patient->contact_number,
                    'birthday' => $patient->date_of_birth?->format('M j, Y') ?? '—',
                    'tb_diagnosis' => $diagnosisLabel ?? '—',
                ],
            ],

            'timeline' => $totalMonths === null ? [] : collect(range(1, $totalMonths))
                ->map(fn (int $month) => [
                    'month' => $month,
                    'recorded' => $case->treatmentMonitoringRecords()
                        ->where('month_number', $month)
                        ->first()
                        ?->isSaved() ?? false,
                    'completed' => $case->isMonthComplete($month),
                    'current' => $month === $currentMonth && $case->isOnTreatment(),
                    'due' => $currentMonth !== null && $month <= $currentMonth,
                    'locked' => $currentMonth !== null && $month > $currentMonth,
                ])
                ->values(),

            // Month/week state, review-form defaults, and this month's own
            // dispensing history — the `review`/`summary` sub-sections the
            // old payload also had per month still aren't built.
            'months' => TreatmentScheduleState::months($case),

            'dispensing_history' => TreatmentScheduleState::fullHistory($case),

            'supply' => MedicineSupply::for($case),

            'followups' => $this->followupRows($case, $dueMonths),
            'followup_schedule' => [
                'enrolled_as' => $diagnosisLabel,
                'months' => $dueMonths,
                'label' => collect($dueMonths)->map(fn (int $m) => "Month {$m}")->join(', ', ' and '),
            ],

            'contact_tracing' => $patient->contactTracingRecord,
            'acf_defaults' => $patient->acfDefaults(),

            'current_month' => $currentMonth,

            // Reshaped from PatientAuditTrail's own field names to what
            // Show.jsx's AuditTab table renders (date_label/user/action/
            // section/status) — kept separate from AuditTrailController's
            // JSON shape rather than changing that shared shape to fit here.
            'audit' => PatientAuditTrail::forPatient($patient)->map(fn (array $entry) => [
                'id' => $entry['id'],
                'date_label' => $entry['created_at']
                    ? Carbon::parse($entry['created_at'])->format('M j, Y, g:i A')
                    : null,
                'user' => $entry['actor']['name'] ?? null,
                'action' => $entry['description'] ?? $entry['title'],
                'section' => match (true) {
                    str_starts_with($entry['type'], 'treatment.enrolled') => 'Enrollment',
                    str_starts_with($entry['type'], 'treatment.outcome') => 'Outcome',
                    str_starts_with($entry['type'], 'treatment_monitoring.') => 'Treatment Monitoring',
                    str_starts_with($entry['type'], 'medication_dispensing.') => 'Medication Dispensing',
                    str_starts_with($entry['type'], 'follow_up_exam.') => 'Follow-up Exam',
                    str_starts_with($entry['type'], 'contact_tracing.') => 'Contact Tracing',
                    default => 'Case',
                },
                // Every row here is a completed write — nothing is logged
                // until it's persisted.
                'status' => 'Saved',
            ]),

            'options' => [
                // Drives the month-button strip (Array.from({length:
                // total_months})) — missing entirely was the reason no
                // month buttons rendered at all until this was added.
                'total_months' => $totalMonths,
                // Drives the top "6-Month Treatment Progress" Intensive/
                // Continuation split — per this enrollment's own regimen
                // (see intensivePhaseMonths()), not a fixed global month-2
                // cutoff the way the reference modeled it.
                'intensive_months' => $case->intensivePhaseMonths(),
                'regimen_intensive' => 'HRZE',
                'regimen_continuation' => 'HR',
                'registration_groups' => TreatmentEnrollment::REGISTRATION_GROUPS,
                'regimens' => TreatmentEnrollment::TREATMENT_REGIMENS,
                'outcomes' => TreatmentEnrollment::OUTCOMES,
                'smear_results' => FollowUpExam::RESULTS,
                'clinical_statuses' => TreatmentMonitoringRecord::CLINICAL_STATUSES,
                'doses' => MedicationDispensingRecord::DOSES,
                'side_effects' => MedicationDispensingRecord::SIDE_EFFECTS,
                'serious_side_effects' => MedicationDispensingRecord::SERIOUS_SIDE_EFFECTS,
                'problems' => MedicationDispensingRecord::PROBLEMS,
                'severities' => MedicationDispensingRecord::SEVERITIES,
                'strip_tablets' => MedicationDispensingRecord::STRIP_TABLETS,
                'pickup_cycle' => MedicationDispensingRecord::PICKUP_CYCLE,
                'visit_types' => ContactTracingRecord::VISIT_TYPES,
                'yes_no' => ContactTracingRecord::YES_NO,
                'taking_meds' => ContactTracingRecord::TAKING_MEDS,
                'tpt_reasons' => ContactTracingRecord::TPT_REASONS,
                'current_user' => $rhu->name,
            ],
        ]);
    }

    /**
     * Save one month of monitoring. Recorded once and then edited in place
     * while it's still the current month — every save re-stamps saved_at,
     * which is what re-opening the form and re-submitting ("Edit Review")
     * actually does.
     */
    public function updateMonitoring(Request $request, TreatmentEnrollment $case): RedirectResponse
    {
        $rhu = $this->authorizeCase($request, $case);

        if (! $case->isOnTreatment()) {
            throw ValidationException::withMessages([
                'weight_kg' => "This case is closed ({$case->outcome}). Monitoring entries are locked.",
            ]);
        }

        $validated = $request->validate([
            'month' => ['required', 'integer'],
            'weight_kg' => ['nullable', 'numeric', 'min:0', 'max:999.9'],
            'confirmed_dose' => ['nullable', Rule::in(MedicationDispensingRecord::DOSES)],
            'clinical_status' => ['nullable', Rule::in(TreatmentMonitoringRecord::CLINICAL_STATUSES)],
            'remarks' => ['nullable', 'string'],
        ]);

        $month = (int) $validated['month'];
        $currentMonth = $case->currentMonth();

        if ($currentMonth === null) {
            throw ValidationException::withMessages([
                'month' => 'This regimen has no defined treatment duration yet.',
            ]);
        }

        if ($month > $currentMonth) {
            throw ValidationException::withMessages([
                'month' => "Month {$month} is locked — complete Month {$currentMonth} first.",
            ]);
        }

        if ($month < $currentMonth) {
            throw ValidationException::withMessages([
                'month' => "Month {$month} is completed and can no longer be edited.",
            ]);
        }

        $case->treatmentMonitoringRecords()->updateOrCreate(
            ['month_number' => $month],
            [
                'current_weight' => $validated['weight_kg'] ?? null,
                'prescribed_dose' => $validated['confirmed_dose'] ?? null,
                'clinical_status' => $validated['clinical_status'] ?? null,
                'remarks' => $validated['remarks'] ?? null,
                'recorded_by' => $rhu->id,
                'saved_at' => now(),
            ],
        );

        ActivityLogger::record(
            $rhu,
            'treatment_monitoring.recorded',
            'Recorded monthly treatment review',
            "Month {$month} review recorded for {$case->patient?->name}.",
            ['patient_id' => $case->patient_id, 'enrollment_id' => $case->id],
            $case,
        );

        return back()->with('success', "Month {$month} clinical review was saved.");
    }

    /**
     * Record or amend one weekly medication dispensing visit. The dose
     * always comes from the month's confirmed review, never the form, so a
     * later dose change can't retroactively alter medicine already handed
     * over. doses_missed is computed from actual calendar days between
     * visits, not assumed.
     */
    public function storeDispensing(
        Request $request,
        TreatmentEnrollment $case,
        ?MedicationDispensingRecord $record = null,
    ): RedirectResponse {
        $rhu = $this->authorizeCase($request, $case);

        if ($record !== null) {
            abort_unless($record->treatmentMonitoringRecord?->treatment_enrollment_id === $case->id, 404);
        }

        if (! $case->isOnTreatment()) {
            throw ValidationException::withMessages([
                'dispensed_on' => "This treatment record is closed ({$case->outcome}).",
            ]);
        }

        $allRecords = $case->medicationDispensingRecords()->get();
        $last = $allRecords->last();

        // A recorded week is finalized once the week after it exists —
        // only the latest visit in the whole enrollment can still be
        // corrected, since every later visit's figures are computed
        // against it.
        if ($record !== null && ! ($last !== null && $last->is($record))) {
            throw ValidationException::withMessages([
                'dispensed_on' => 'This visit is finalized and can no longer be edited.',
            ]);
        }

        $month = $record?->month_number ?? $case->currentMonth();

        if ($month === null) {
            throw ValidationException::withMessages([
                'dispensed_on' => 'This regimen has no defined treatment duration yet.',
            ]);
        }

        $review = $case->treatmentMonitoringRecords()->where('month_number', $month)->first();

        if ($review === null || ! $review->isSaved()) {
            throw ValidationException::withMessages([
                'dispensed_on' => 'Save the Monthly Clinical Review first so the RHU-prescribed dose is confirmed.',
            ]);
        }

        $validated = $request->validate([
            'dispensed_on' => ['required', 'date'],
            'remaining_tablets' => ['nullable', 'integer', 'min:0'],
            'doses_taken' => ['nullable', 'integer', 'min:0'],
            'missed_reason' => ['nullable', 'string', 'max:150'],
            'missed_intervention' => ['nullable', 'string', 'max:150'],
            'side_effects' => ['nullable', 'array'],
            'remarks' => ['nullable', 'string'],
        ]);

        $dispensedOn = Carbon::parse($validated['dispensed_on']);

        $index = $record !== null ? $allRecords->search(fn ($r) => $r->is($record)) : null;
        $previous = $record !== null
            ? ($index !== false && $index > 0 ? $allRecords->get($index - 1) : null)
            : $last;

        $scheduled = $previous !== null
            ? max(0, $previous->dispensing_date->startOfDay()->diffInDays($dispensedOn->copy()->startOfDay(), absolute: false))
            : 0;

        $taken = min((int) ($validated['doses_taken'] ?? 0), $scheduled);

        $weekNumber = $record?->week_number ?? (
            $allRecords->where('month_number', $month)->where('is_initial', false)->count() + 1
        );

        $attributes = [
            'month_number' => $month,
            'week_number' => $weekNumber,
            'is_initial' => false,
            'dispensing_date' => $dispensedOn,
            'next_dispensing_date' => $dispensedOn->copy()->addDays(MedicationDispensingRecord::PICKUP_CYCLE),
            'dose' => $review->prescribed_dose,
            'weekly_supply' => MedicationDispensingRecord::STRIP_TABLETS,
            'remaining_tablets' => $validated['remaining_tablets'] ?? null,
            'doses_taken' => $taken,
            'doses_missed' => max(0, $scheduled - $taken),
            'missed_reason' => $validated['missed_reason'] ?? null,
            'missed_intervention' => $validated['missed_intervention'] ?? null,
            'side_effects' => $validated['side_effects'] ?? [],
            'remarks' => $validated['remarks'] ?? null,
        ];

        if ($record !== null) {
            $record->update($attributes);
            $saved = $record;
        } else {
            $saved = $review->medicationDispensingRecords()->create($attributes);
        }

        ActivityLogger::record(
            $rhu,
            'medication_dispensing.recorded',
            $record !== null ? 'Updated medication dispensing' : 'Recorded medication dispensing',
            sprintf(
                'Medication dispensing %s — Week %d, Month %d',
                $record !== null ? 'updated' : 'recorded',
                $weekNumber,
                $month,
            ),
            ['patient_id' => $case->patient_id, 'enrollment_id' => $case->id],
            $case,
        );

        return back()->with(
            'success',
            $saved->hasSeriousSideEffect()
                ? 'Medication dispensing saved. A reported side effect is flagged for clinical assessment.'
                : 'Medication dispensing saved.',
        );
    }

    /**
     * Record a follow-up diagnostic test result. Keyed by month rather than
     * an existing row's id — this schema only creates a row once an exam is
     * actually performed (no pre-created schedule placeholders), so a month
     * being recorded for the first time has no id yet.
     */
    public function updateFollowup(Request $request, TreatmentEnrollment $case, int $month): RedirectResponse
    {
        $rhu = $this->authorizeCase($request, $case);

        if (! $case->isOnTreatment()) {
            throw ValidationException::withMessages([
                'smear_result' => "This treatment record is closed ({$case->outcome}).",
            ]);
        }

        if (! in_array($month, $case->followUpExamScheduleMonths(), true)) {
            throw ValidationException::withMessages([
                'smear_result' => "Month {$month} is not due for a follow-up exam under the patient's current diagnosis.",
            ]);
        }

        $validated = $request->validate([
            'collection_date' => ['required', 'date', 'before_or_equal:today'],
            'result_date' => ['required', 'date', 'after_or_equal:collection_date', 'before_or_equal:today'],
            'smear_result' => ['required', Rule::in(FollowUpExam::RESULTS)],
            'afb_count' => ['nullable', 'string', 'max:60'],
            'remarks' => ['nullable', 'string'],
        ]);

        $case->followUpExams()->updateOrCreate(
            ['month_number' => $month],
            [
                'collected' => true,
                'collection_date' => $validated['collection_date'],
                'result_date' => $validated['result_date'],
                'result' => $validated['smear_result'],
                'afb_count' => $validated['smear_result'] === 'scanty' ? ($validated['afb_count'] ?? null) : null,
                'remarks' => $validated['remarks'] ?? null,
                'recorded_by' => $rhu->id,
            ],
        );

        ActivityLogger::record(
            $rhu,
            'follow_up_exam.recorded',
            'Recorded follow-up diagnostic test',
            "Month {$month} follow-up diagnostic test recorded for {$case->patient?->name}.",
            ['patient_id' => $case->patient_id, 'enrollment_id' => $case->id],
            $case,
        );

        return back()->with(
            'success',
            $validated['smear_result'] === 'negative'
                ? 'Follow-up result recorded.'
                : 'Positive result recorded and flagged for RHU review.',
        );
    }

    /**
     * Save or update the ACF Contact Tracing report. The form's field names
     * and Yes/No/label values are the old reference's — mapped onto this
     * schema's real column names and booleans/enums here, at the boundary,
     * rather than changing either side to match the other.
     */
    public function saveContactTracing(Request $request, TreatmentEnrollment $case): RedirectResponse
    {
        $rhu = $this->authorizeCase($request, $case);
        $patient = $case->patient;

        if (! $case->isOnTreatment()) {
            throw ValidationException::withMessages([
                'enumerator' => "This treatment record is closed ({$case->outcome}).",
            ]);
        }

        $validated = $request->validate([
            'visit_date' => ['nullable', 'date', 'before_or_equal:today'],
            'visit_type' => ['nullable', Rule::in(ContactTracingRecord::VISIT_TYPES)],
            'rhu_contacted' => ['nullable', Rule::in(ContactTracingRecord::YES_NO)],
            'started_medication' => ['nullable', Rule::in(ContactTracingRecord::YES_NO)],
            'accompaniment' => ['nullable', Rule::in(ContactTracingRecord::YES_NO)],
            'household_total' => ['nullable', 'integer', 'min:0'],
            'household_symptoms' => ['nullable', 'integer', 'min:0'],
            'household_tb' => ['nullable', 'integer', 'min:0'],
            'household_taking_meds' => ['nullable', Rule::in(ContactTracingRecord::TAKING_MEDS)],
            'referral_cards' => ['nullable', Rule::in(ContactTracingRecord::YES_NO)],
            'tpt_total' => ['nullable', 'integer', 'min:0'],
            'tpt_0_to_4' => ['nullable', 'integer', 'min:0'],
            'tpt_5_to_14' => ['nullable', 'integer', 'min:0'],
            'tpt_15_plus' => ['nullable', 'integer', 'min:0'],
            'tpt_reason' => ['nullable', Rule::in(ContactTracingRecord::TPT_REASONS)],
            'enumerator' => ['nullable', 'string', 'max:150'],
            'remarks' => ['nullable', 'string'],
        ]);

        $existed = $patient->contactTracingRecord()->exists();
        $yes = fn (?string $value): bool => $value === 'Yes';

        $patient->contactTracingRecord()->updateOrCreate(
            ['patient_id' => $patient->id],
            [
                'visit_date' => $validated['visit_date'] ?? null,
                'contact_method' => match ($validated['visit_type'] ?? null) {
                    'Call' => 'call',
                    'Home Visit' => 'home_visit',
                    default => null,
                },
                'rhu_contacted' => $yes($validated['rhu_contacted'] ?? null),
                'started_medication' => $yes($validated['started_medication'] ?? null),
                'has_accompaniment' => $yes($validated['accompaniment'] ?? null),
                'household_count' => $validated['household_total'] ?? null,
                'household_symptoms_count' => $validated['household_symptoms'] ?? null,
                'household_tb_count' => $validated['household_tb'] ?? null,
                'household_taking_medication' => $yes($validated['household_taking_meds'] ?? null),
                'referral_cards_given' => $yes($validated['referral_cards'] ?? null),
                'tpt_total' => $validated['tpt_total'] ?? null,
                'tpt_0_4' => $validated['tpt_0_to_4'] ?? null,
                'tpt_5_14' => $validated['tpt_5_to_14'] ?? null,
                'tpt_15_plus' => $validated['tpt_15_plus'] ?? null,
                'tpt_not_enrolled_reason' => match ($validated['tpt_reason'] ?? null) {
                    'Contact of CD patient' => 'contact_of_cd_patient',
                    'RHU not providing TPT' => 'rhu_not_providing_tpt',
                    'Contact refused TPT' => 'contact_refused_tpt',
                    'Negative CXR' => 'negative_cxr',
                    'Other' => 'other',
                    default => null,
                },
                'enumerator_name' => $validated['enumerator'] ?? null,
                'remarks' => $validated['remarks'] ?? null,
                'recorded_by' => $rhu->id,
            ],
        );

        ActivityLogger::record(
            $rhu,
            'contact_tracing.saved',
            $existed ? 'Updated contact tracing' : 'Saved contact tracing',
            $existed ? 'ACF contact tracing updated' : 'ACF contact tracing saved',
            ['patient_id' => $patient->id],
            $patient->contactTracingRecord,
        );

        return back()->with('success', $existed ? 'Contact tracing updated.' : 'Contact tracing saved.');
    }

    /**
     * Close the case with a final treatment outcome.
     */
    public function updateOutcome(Request $request, TreatmentEnrollment $case): RedirectResponse
    {
        $rhu = $this->authorizeCase($request, $case);

        if (! $case->isOnTreatment()) {
            throw ValidationException::withMessages([
                'outcome' => "This case was already closed as {$case->outcome}.",
            ]);
        }

        $validated = $request->validate([
            'outcome' => ['required', Rule::in(TreatmentEnrollment::OUTCOMES)],
            'outcome_date' => ['required', 'date', 'before_or_equal:today'],
            'outcome_remarks' => ['nullable', 'string'],
        ]);

        $case->update([
            'outcome' => $validated['outcome'],
            'outcome_date' => $validated['outcome_date'],
            'outcome_remarks' => $validated['outcome_remarks'] ?? null,
            'recorded_by' => $rhu->id,
        ]);

        ActivityLogger::record(
            $rhu,
            'treatment.outcome_recorded',
            'Closed treatment case',
            "{$case->registry_number} was closed as {$validated['outcome']}.",
            ['patient_id' => $case->patient_id, 'enrollment_id' => $case->id],
            $case,
        );

        return back()->with('success', "Case {$case->registry_number} was closed as {$validated['outcome']}.");
    }

    private function authorizeCase(Request $request, TreatmentEnrollment $case): User
    {
        $rhu = $request->user();

        abort_unless(
            $rhu instanceof User
                && $rhu->role === 'rhu'
                && $case->patient?->program?->location_id === $rhu->location_id,
            404,
        );

        return $rhu;
    }

    /**
     * The Follow-up Diagnostic Test Schedule table's rows — one per due
     * month, whether or not it's been performed yet. `id` is null for a
     * not-yet-performed month (this schema doesn't pre-create placeholder
     * rows), which is why the write action is keyed by month, not id.
     *
     * @param  int[]  $dueMonths
     * @return array<int, array<string, mixed>>
     */
    private function followupRows(TreatmentEnrollment $case, array $dueMonths): array
    {
        $existing = $case->followUpExams()->get()->keyBy('month_number');
        $today = Carbon::today();

        return collect($dueMonths)->map(function (int $month) use ($case, $existing, $today) {
            $exam = $existing->get($month);
            $dueDate = $case->followUpExamDueDate($month);

            $status = match (true) {
                $exam !== null && $exam->collected => 'Completed',
                $dueDate !== null && $dueDate->startOfDay()->lessThanOrEqualTo($today) => 'Due',
                default => 'Upcoming',
            };

            return [
                'id' => $exam?->id,
                'month' => $month,
                'due_date_label' => $dueDate?->format('M j, Y') ?? '—',
                'status' => $status,
                'smear_result' => $exam?->result,
                'afb_count' => $exam?->afb_count,
                'is_positive' => $exam !== null && $exam->result !== null && $exam->result !== 'negative',
                'collected' => $exam?->collected ?? false,
                'collection_date' => $exam?->collection_date?->toDateString(),
                'result_date' => $exam?->result_date?->toDateString(),
                'remarks' => $exam?->remarks,
            ];
        })->values()->all();
    }
}
