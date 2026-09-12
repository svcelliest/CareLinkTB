<?php

namespace App\Http\Controllers;

use App\Http\Requests\Rhu\RecordFollowupResultRequest;
use App\Http\Requests\Rhu\SaveContactTracingRequest;
use App\Http\Requests\Rhu\StoreDispensingRecordRequest;
use App\Http\Requests\Rhu\StoreTreatmentEnrollmentRequest;
use App\Http\Requests\Rhu\UpdateTreatmentMonitoringRequest;
use App\Http\Requests\Rhu\UpdateTreatmentOutcomeRequest;
use App\Models\Patient;
use App\Models\TreatmentCase;
use App\Models\TreatmentContactTracing;
use App\Models\TreatmentDispensingRecord;
use App\Models\TreatmentFollowup;
use App\Models\TreatmentMonitoringEntry;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\AklanAddresses;
use App\Support\MedicineSupply;
use App\Support\RhuScope;
use App\Support\TreatmentAlerts;
use App\Support\TreatmentRecordPresenter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Patient Monitoring — treatment enrolment, the six-month monitoring record,
 * and case closure.
 *
 * A treatment case is opened *from* an existing patient record and points at
 * it; the patient's name, address and diagnostic results are always read back
 * through that relation rather than copied, so the two can never disagree.
 */
class RhuTreatmentController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['all', 'active', 'closed'])],
        ]);

        $search = trim($filters['search'] ?? '');
        $status = $filters['status'] ?? 'all';

        // Raise any alerts the open cases have earned as the list is opened.
        TreatmentAlerts::sweepFor($user);

        $cases = RhuScope::treatmentCases($user)
            // mapCaseRow() asks each case for its current month, which is now
            // read from the record rather than the calendar.
            ->with(['patient', 'monitoringEntries', 'dispensingRecords'])
            ->when($status === 'active', fn ($query) => $query->whereNull('outcome'))
            ->when($status === 'closed', fn ($query) => $query->whereNotNull('outcome'))
            ->when($search !== '', function ($query) use ($search): void {
                $escaped = addcslashes($search, '%_\\');

                $query->where(fn ($scoped) => $scoped
                    ->where('case_number', 'like', '%'.$escaped.'%')
                    ->orWhereHas('patient', fn ($patient) => $patient
                        ->where('name', 'like', '%'.$escaped.'%')));
            })
            ->latest('updated_at')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (TreatmentCase $case) => $this->mapCaseRow($case));

        $all = RhuScope::treatmentCases($user);

        return Inertia::render('Rhu/Treatment/Index', [
            'cases' => $cases,
            'filters' => ['search' => $search, 'status' => $status],
            'stats' => [
                'total' => (clone $all)->count(),
                'active' => (clone $all)->whereNull('outcome')->count(),
                'closed' => (clone $all)->whereNotNull('outcome')->count(),
            ],
            // Everything the enrolment modal needs: the eligible patients with
            // their read-only particulars already resolved, plus the reference
            // lists the form's three selects are built from.
            'enrollment' => [
                'candidates' => $this->enrollmentCandidates($user),
                'registration_groups' => TreatmentCase::REGISTRATION_GROUPS,
                'regimens' => TreatmentCase::REGIMENS,
                // The assigned treatment provider is the signed-in RHU account
                // and both facilities are the RHU's own; the form shows them
                // read-only and store() sets them from the account again.
                'assigned_provider' => $user->name,
                'treatment_facility' => RhuScope::facility($user),
                'diagnostic_facility' => RhuScope::facility($user),
                'next_case_number' => TreatmentCase::allocateCaseNumber(),
            ],
            'municipality' => RhuScope::municipality($user),
        ]);
    }

    public function show(Request $request, TreatmentCase $case): Response
    {
        $user = $request->user();

        // The whole point of §18: a case id typed into the address bar is
        // checked against the account's catchment before anything is read.
        abort_unless(RhuScope::coversTreatmentCase($user, $case), 404);

        $case->load([
            'patient.program',
            'monitoringEntries.recorder',
            'dispensingRecords',
            'followups',
            'contactTracing',
            'enroller',
        ]);

        $currentMonth = $case->currentMonth();

        // Raise any alert this record has earned — a low balance, a follow-up
        // test coming up — as the RHU opens it. See TreatmentAlerts for why
        // this runs here rather than on a schedule.
        TreatmentAlerts::forCase($case);

        return Inertia::render('Rhu/Treatment/Show', [
            'case' => [
                ...$this->mapCaseRow($case),
                'registration_date' => $case->registration_date?->format('M j, Y'),
                'registration_group' => $case->registration_group,
                'regimen' => $case->regimen,
                'treatment_start_date' => $case->treatment_start_date?->format('M j, Y'),
                'assigned_provider' => $case->assigned_provider,
                'treatment_facility' => $case->treatment_facility,
                'diagnostic_facility' => $case->diagnostic_facility,
                'enrolled_by' => $case->enroller?->name,
                'outcome_date' => $case->outcome_date?->format('M j, Y'),
                'outcome_date_value' => $case->outcome_date?->toDateString(),
                'outcome_remarks' => $case->outcome_remarks,
                'baseline_weight' => $case->baseline_weight,
                'enrolled_as' => $case->enrolled_as,
                'adherence' => $case->adherencePercent(),

                'patient' => [
                    'id' => $case->patient?->id,
                    'name' => $case->patient?->name,
                    'age' => $case->patient?->age,
                    'sex' => $case->patient?->sex,
                    'address' => $case->patient?->address,
                    'contact_number' => $case->patient?->contact_number,
                    'birthday' => $this->birthdayLabel($case->patient),
                    'tb_diagnosis' => $case->patient?->tbDiagnosisLabel() ?? '—',
                    'diagnostic_result' => $case->patient?->response('diagnostic_result') ?? '',
                ],
            ],

            // The six-month timeline: every month, whether it is recorded, and
            // which phase it belongs to. A month is `completed` once its review
            // and four weekly returns are in; the month after the last
            // completed one is `current`; the rest are `locked`. It advances
            // only as the RHU completes months — never on the calendar.
            'timeline' => collect(range(1, TreatmentCase::TOTAL_MONTHS))
                ->map(fn (int $month) => [
                    'month' => $month,
                    'phase' => TreatmentCase::phaseFor($month),
                    'regimen' => TreatmentCase::regimenFor($month),
                    'recorded' => $case->monitoringEntries
                        ->firstWhere('month', $month)?->isSaved() ?? false,
                    'completed' => $case->isMonthComplete($month),
                    'current' => $month === $currentMonth && ! $case->isClosed(),
                    'due' => $month <= $currentMonth,
                    'locked' => $month > $currentMonth,
                ]),

            // Everything the Treatment Monitoring tab renders per month: the
            // clinical review, the four week cards, the dispensing history and
            // the summary. All derived server-side — see the presenter.
            'months' => TreatmentRecordPresenter::months($case),

            // The permanent record of every dispensing across the whole
            // treatment, independent of the month or week being viewed.
            'dispensing_history' => TreatmentRecordPresenter::fullHistory($case),

            // The Medicine Tracker's live balance. Null until the first
            // dispensing, which the screen shows as its own empty state.
            'supply' => MedicineSupply::for($case),

            'followups' => TreatmentRecordPresenter::followups($case),
            // The RHU's schedule, spelled out so the screen can state it: a
            // bacteriologically confirmed case has three follow-up diagnostic
            // tests, a clinically diagnosed one has a single test after two
            // months. Both derive from TreatmentFollowup::SCHEDULE.
            'followup_schedule' => [
                'enrolled_as' => $case->enrolled_as,
                'months' => TreatmentFollowup::scheduleFor($case->enrolled_as),
                'label' => collect(TreatmentFollowup::scheduleFor($case->enrolled_as))
                    ->map(fn (int $month) => "Month {$month}")
                    ->join(', ', ' and '),
                'rules' => [
                    [
                        'classification' => 'Bacteriologically Confirmed',
                        'tests' => count(TreatmentFollowup::SCHEDULE['Bacteriologically Confirmed']),
                        'months' => TreatmentFollowup::SCHEDULE['Bacteriologically Confirmed'],
                    ],
                    [
                        'classification' => 'Clinically Diagnosed',
                        'tests' => count(TreatmentFollowup::SCHEDULE['default']),
                        'months' => TreatmentFollowup::SCHEDULE['default'],
                    ],
                ],
            ],

            'contact_tracing' => $this->contactTracing($case),

            // What the ACF Activity block opens with when no report has been
            // filed yet: everything the system already holds about the patient
            // and the program they were screened at. Anything missing is left
            // blank for the RHU to fill in, never invented.
            'acf_defaults' => $this->acfDefaults($case),

            'current_month' => $currentMonth,

            // The audit trail is the app's existing activity log filtered to
            // this case — there is no second audit store.
            'audit' => $this->auditTrail($case),

            'options' => [
                'clinical_statuses' => TreatmentMonitoringEntry::CLINICAL_STATUSES,
                'smear_results' => TreatmentFollowup::SMEAR_RESULTS,
                'severities' => TreatmentDispensingRecord::SEVERITIES,
                'outcomes' => TreatmentCase::OUTCOMES,
                'intensive_months' => TreatmentCase::INTENSIVE_MONTHS,
                'total_months' => TreatmentCase::TOTAL_MONTHS,
                'regimen_intensive' => TreatmentCase::REGIMEN_INTENSIVE,
                'regimen_continuation' => TreatmentCase::REGIMEN_CONTINUATION,

                'doses' => TreatmentDispensingRecord::DOSES,
                'side_effects' => TreatmentDispensingRecord::SIDE_EFFECTS,
                'serious_side_effects' => TreatmentDispensingRecord::SERIOUS_SIDE_EFFECTS,
                'problems' => TreatmentDispensingRecord::PROBLEMS,
                'strip_tablets' => TreatmentDispensingRecord::STRIP_TABLETS,
                'pickup_cycle' => TreatmentDispensingRecord::PICKUP_CYCLE,

                'visit_types' => TreatmentContactTracing::VISIT_TYPES,
                'yes_no' => TreatmentContactTracing::YES_NO,
                'taking_meds' => TreatmentContactTracing::TAKING_MEDS,
                'tpt_reasons' => TreatmentContactTracing::TPT_REASONS,

                // "Recorded By" on the outcome form shows the signed-in user.
                'current_user' => $user->name,
            ],
        ]);
    }

    /**
     * The ACF Activity fields as the system already knows them.
     *
     * The patient record carries the address and phone, the case carries the
     * TB registry number, and the program the patient was screened at carries
     * the ACF date and location. The address is split through the same
     * Province → Municipality → Barangay reader the rest of the app uses, so
     * the three fields agree with the register.
     *
     * @return array<string, string>
     */
    private function acfDefaults(TreatmentCase $case): array
    {
        $patient = $case->patient;
        $program = $patient?->program;
        $address = $patient?->address ?? '';

        $parts = array_map('trim', explode(',', $address));
        // Stored as "Barangay, Municipality, Province"; a shorter address
        // simply leaves the trailing levels blank.
        [$community, $municipality, $province] = [
            $parts[0] ?? '',
            $parts[1] ?? '',
            $parts[2] ?? '',
        ];

        return [
            'patient_address' => $address,
            'acf_date' => $program?->scheduled_at?->toDateString() ?? '',
            'province' => $province ?: AklanAddresses::province(),
            'municipality' => $municipality
                ?: (AklanAddresses::municipalityFromAddress($address) ?? ''),
            'community' => $community,
            'registry_no' => $case->case_number,
            'phone' => $patient?->contact_number ?? '',
        ];
    }

    /**
     * The saved ACF Contact Tracing report, or null when none has been filed.
     *
     * @return array<string, mixed>|null
     */
    private function contactTracing(TreatmentCase $case): ?array
    {
        $tracing = $case->contactTracing;

        if ($tracing === null) {
            return null;
        }

        return [
            ...$tracing->only([
                'patient_address', 'province', 'municipality', 'community',
                'registry_no', 'phone', 'visit_type', 'rhu_contacted',
                'started_medication', 'accompaniment', 'household_total',
                'household_symptoms', 'household_tb', 'household_taking_meds',
                'referral_cards', 'tpt_total', 'tpt_0_to_4', 'tpt_5_to_14',
                'tpt_15_plus', 'tpt_reason', 'enumerator',
            ]),
            'acf_date' => $tracing->acf_date?->toDateString(),
            'visit_date' => $tracing->visit_date?->toDateString(),
        ];
    }

    /**
     * Enrol a diagnosed patient and open their treatment case.
     *
     * Everything that identifies the patient is taken from the patient record,
     * never from the request: the browser sends only the five editable fields
     * plus the patient id, and even that id is re-checked against the RHU's
     * catchment and against the diagnosis before a case is opened.
     */
    public function store(StoreTreatmentEnrollmentRequest $request): RedirectResponse
    {
        $user = $request->user();
        $patient = Patient::findOrFail($request->validated('patient_id'));

        abort_unless(RhuScope::coversPatient($user, $patient), 404);

        if (! $patient->isDiagnosedWithTb()) {
            throw ValidationException::withMessages([
                'patient_id' => 'This patient has no confirmed TB diagnosis on record and cannot be enrolled in treatment.',
            ]);
        }

        // Three fields are the RHU's own and are set here rather than posted:
        // registration is dated today, the assigned treatment provider is the
        // signed-in RHU account, and both facilities are the RHU's facility.
        $facility = RhuScope::facility($user);

        $case = DB::transaction(function () use ($user, $patient, $request, $facility): TreatmentCase {
            // Re-read under a lock so two submits — a double click, or a retry
            // — cannot both pass the "already enrolled" check and open two
            // cases for the same patient.
            $existing = TreatmentCase::query()
                ->where('patient_id', $patient->id)
                ->whereNull('outcome')
                ->lockForUpdate()
                ->first();

            if ($existing !== null) {
                throw ValidationException::withMessages([
                    'patient_id' => "This patient already has an active treatment case ({$existing->case_number}).",
                ]);
            }

            $case = TreatmentCase::create([
                'patient_id' => $patient->id,
                'enrolled_by' => $user->id,
                // Allocated inside this transaction with the sequence locked.
                'case_number' => TreatmentCase::allocateCaseNumber(lock: true),
                'municipality' => AklanAddresses::municipalityFromAddress($patient->address),
                'registration_date' => now()->toDateString(),
                'registration_group' => $request->validated('registration_group'),
                'regimen' => $request->validated('regimen'),
                'treatment_start_date' => $request->validated('treatment_start_date'),
                'assigned_provider' => $user->name,
                'treatment_facility' => $facility,
                'diagnostic_facility' => $facility,
                // Taken at enrolment so the initial release below is dosed
                // from the patient's actual weight band rather than the
                // lowest dose, and kept as the baseline later reviews are
                // read against.
                'baseline_weight' => $request->validated('baseline_weight'),
                // Decides the follow-up diagnostic test schedule, so it is frozen
                // onto the case rather than re-read from the register later.
                'enrolled_as' => $patient->enrolledAsLabel(),
            ]);

            $start = $case->treatment_start_date;

            // The follow-up schedule exists from enrolment — the reference
            // lists the months as "Upcoming" long before any result arrives.
            foreach (TreatmentFollowup::scheduleFor($case->enrolled_as) as $month) {
                $case->followups()->create([
                    'month' => $month,
                    'due_date' => $start->copy()->addDays($month * 28),
                ]);
            }

            // The first medicine supply is released immediately after
            // enrolment. It is week 0 and flagged initial, so it seeds the
            // medicine tracker without counting as one of the four weekly
            // returns.
            $case->dispensingRecords()->create([
                'recorded_by' => $user->id,
                'month' => 1,
                'week' => 0,
                'is_initial' => true,
                'dispensed_on' => $start,
                'next_dispensing_on' => $start->copy()
                    ->addDays(TreatmentDispensingRecord::PICKUP_CYCLE),
                'dose' => TreatmentCase::bandDose($case->baseline_weight)
                    ?? TreatmentDispensingRecord::DOSES[0],
                'weekly_supply' => TreatmentDispensingRecord::STRIP_TABLETS,
                'remarks' => 'Initial medication release after enrollment',
            ]);

            // The reference's audit trail carries this release as its own row
            // beside the enrolment, so it is logged rather than left implicit.
            ActivityLogger::record(
                $user,
                'treatment.initial_release',
                'Released initial medication',
                'Initial medication release after enrollment',
                ['treatment_case_id' => $case->id, 'section' => 'Enrollment'],
                $case,
            );

            // The reference's audit trail carries this release as its own row
            // beside the enrolment, so it is logged rather than left implicit.
            ActivityLogger::record(
                $user,
                'treatment.initial_release',
                'Released initial medication',
                'Initial medication release after enrollment',
                ['treatment_case_id' => $case->id, 'section' => 'Enrollment'],
                $case,
            );

            // Keep the program register in step: the Final Classification's
            // treatment-status column now reads "Enrolled", and the case number
            // becomes that row's TB registry number. Both are additive merges
            // into the existing document — no other answer is touched.
            $patient->update([
                'responses' => [
                    ...($patient->responses ?? []),
                    'enrolled_tb_treatment' => '1',
                    'tb_registry_number' => $case->case_number,
                ],
            ]);

            ActivityLogger::record(
                $user,
                'treatment.enrolled',
                'Enrolled patient in treatment',
                "{$patient->name} was enrolled in TB treatment as {$case->case_number}.",
                ['treatment_case_id' => $case->id, 'patient_id' => $patient->id],
                $case,
            );

            return $case;
        });

        return redirect()
            ->route('rhu.treatment.show', $case)
            ->with('success', "Patient successfully enrolled. TB Case Number: {$case->case_number}");
    }

    /**
     * Save one month of monitoring. Recorded once and then edited in place, so
     * this is an upsert on (case, month) rather than an insert.
     */
    public function updateMonitoring(
        UpdateTreatmentMonitoringRequest $request,
        TreatmentCase $case,
    ): RedirectResponse {
        $user = $request->user();

        abort_unless(RhuScope::coversTreatmentCase($user, $case), 404);

        // A closed case is a closed record: monitoring entries are locked and
        // reopening requires the outcome to be cleared first.
        if ($case->isClosed()) {
            throw ValidationException::withMessages([
                'month' => "This case is closed ({$case->outcome}). Monitoring entries are locked.",
            ]);
        }

        $month = (int) $request->validated('month');
        $case->load(['monitoringEntries', 'dispensingRecords']);
        $currentMonth = $case->currentMonth();

        // Only the month in progress can be reviewed. A later month is locked
        // until this one is completed, and a completed month is finalized.
        // This is the stale-data guard: the screen the browser rendered may be
        // minutes old, so the month is re-derived here from the record.
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

        $data = $request->safe()->except('month');

        DB::transaction(function () use ($case, $user, $month, $data): void {
            $case->monitoringEntries()->updateOrCreate(
                ['month' => $month],
                [
                    ...$data,
                    'recorded_by' => $user->id,
                    // Saving locks the review; the screen reopens it only
                    // through "Edit Review".
                    'saved_at' => now(),
                ],
            );

            // The first review establishes the baseline weight the dose bands
            // are read against. It is set once and then left alone — a later
            // month's weight is progress, not a new baseline.
            if ($case->baseline_weight === null && isset($data['weight_kg'])) {
                $case->baseline_weight = $data['weight_kg'];
            }

            // Touch the case so the patient list's "Last Updated" column moves
            // when a month is recorded.
            $case->save();
            $case->touch();

            ActivityLogger::record(
                $user,
                'treatment.monitoring_recorded',
                'Updated treatment monitoring',
                "Monthly clinical review saved — Month {$month}",
                ['treatment_case_id' => $case->id, 'month' => $month, 'section' => "Month {$month}"],
                $case,
            );
        });

        return back()->with('success', "Month {$month} clinical review was saved.");
    }

    /**
     * Record or amend one weekly medication dispensing visit.
     *
     * A visit closes the previous week and opens the next, so the figures the
     * form previews — scheduled doses, expected tablets, missed doses — are all
     * recomputed here from the stored sequence rather than trusted from the
     * browser. The dose likewise comes from the month's confirmed review.
     */
    public function storeDispensing(
        StoreDispensingRecordRequest $request,
        TreatmentCase $case,
        ?TreatmentDispensingRecord $record = null,
    ): RedirectResponse {
        $user = $request->user();

        abort_unless(RhuScope::coversTreatmentCase($user, $case), 404);

        if ($record !== null) {
            abort_unless($record->treatment_case_id === $case->id, 404);
        }

        if ($case->isClosed()) {
            throw ValidationException::withMessages([
                'dispensed_on' => "This treatment record is closed ({$case->outcome}).",
            ]);
        }

        $case->load(['monitoringEntries', 'dispensingRecords']);

        // A recorded week is finalized once the week after it has been
        // recorded: every later visit's figures are computed against it, so
        // it is viewable but no longer editable. Only the latest visit can
        // still be corrected.
        if ($record !== null && ! $case->lastDispensing()?->is($record)) {
            throw ValidationException::withMessages([
                'dispensed_on' => "Week {$record->week} of Month {$record->month} is finalized and can no longer be edited.",
            ]);
        }

        $month = $record?->month ?? $case->currentMonth();
        $review = $case->monitoringEntries->firstWhere('month', $month);

        // The reference refuses to dispense before the month's review is saved:
        // without it there is no confirmed dose to dispense at.
        if ($review === null || ! $review->isSaved()) {
            throw ValidationException::withMessages([
                'dispensed_on' => 'Save the Monthly Clinical Review first so the RHU-prescribed dose is confirmed.',
            ]);
        }

        $validated = $request->validated();

        $previous = $record !== null
            ? $case->dispensingRecords->values()->get(
                $case->dispensingRecords->values()->search(
                    fn (TreatmentDispensingRecord $r) => $r->is($record),
                ) - 1,
            )
            : $case->lastDispensing();

        $dispensedOn = Carbon::parse($validated['dispensed_on']);
        $scheduled = $previous !== null
            ? max(0, $previous->dispensed_on->startOfDay()
                ->diffInDays($dispensedOn->startOfDay(), absolute: false))
            : 0;

        $taken = min((int) ($validated['doses_taken'] ?? 0), $scheduled);

        $saved = DB::transaction(function () use (
            $case, $user, $record, $month, $review, $validated, $dispensedOn, $scheduled, $taken,
        ): TreatmentDispensingRecord {
            $weeklyReturns = $case->dispensingRecords
                ->where('month', $month)
                ->where('is_initial', false);

            $attributes = [
                'recorded_by' => $user->id,
                'month' => $month,
                'week' => $record?->week ?? ($weeklyReturns->count() + 1),
                'is_initial' => false,
                'dispensed_on' => $dispensedOn,
                // The weekly return is always one pickup cycle on. Computed
                // here from the dispensing date rather than taken from the
                // form, so the schedule cannot drift from the visit it
                // follows.
                'next_dispensing_on' => $dispensedOn->copy()
                    ->addDays(TreatmentDispensingRecord::PICKUP_CYCLE),
                // Never taken from the request: this is the confirmed clinical
                // decision for the month.
                'dose' => $review->confirmed_dose,
                'weekly_supply' => TreatmentDispensingRecord::STRIP_TABLETS,
                'remaining_tablets' => $validated['remaining_tablets'] ?? null,
                'doses_taken' => $taken,
                'doses_missed' => max(0, $scheduled - $taken),
                'missed_reason' => $validated['missed_reason'] ?? null,
                'missed_intervention' => $validated['missed_intervention'] ?? null,
                'side_effects' => $validated['side_effects'] ?? [],
                'side_effect_severity' => $validated['side_effect_severity'] ?? null,
                'side_effect_action' => $validated['side_effect_action'] ?? null,
                'side_effect_referred' => (bool) ($validated['side_effect_referred'] ?? false),
                'problems' => $validated['problems'] ?? [],
                'problem_action' => $validated['problem_action'] ?? null,
                'problem_followup_on' => $validated['problem_followup_on'] ?? null,
                'remarks' => $validated['remarks'] ?? null,
            ];

            $saved = $record !== null
                ? tap($record)->update($attributes)
                : $case->dispensingRecords()->create($attributes);

            $case->touch();

            ActivityLogger::record(
                $user,
                'treatment.dispensing_recorded',
                $record !== null ? 'Updated medication dispensing' : 'Recorded medication dispensing',
                sprintf(
                    'Medication dispensing %s — Week %d, Month %d',
                    $record !== null ? 'updated' : 'recorded',
                    $saved->week,
                    $month,
                ),
                [
                    'treatment_case_id' => $case->id,
                    'month' => $month,
                    'week' => $saved->week,
                    'section' => "Month {$month}",
                ],
                $case,
            );

            return $saved;
        });

        // The balance may already be low on the day it is dispensed at a high
        // dose, so the alert is checked on the fresh record, not only on the
        // next page view.
        TreatmentAlerts::forCase($case->fresh(['patient', 'dispensingRecords', 'followups']));

        return back()->with(
            'success',
            $saved->hasSeriousSideEffect()
                ? 'Medication dispensing saved. A reported side effect is flagged for clinical assessment.'
                : 'Medication dispensing saved.',
        );
    }

    /**
     * Record a follow-up diagnostic test result against its scheduled row.
     */
    public function updateFollowup(
        RecordFollowupResultRequest $request,
        TreatmentCase $case,
        TreatmentFollowup $followup,
    ): RedirectResponse {
        $user = $request->user();

        abort_unless(RhuScope::coversTreatmentCase($user, $case), 404);
        abort_unless($followup->treatment_case_id === $case->id, 404);

        if ($case->isClosed()) {
            throw ValidationException::withMessages([
                'smear_result' => "This treatment record is closed ({$case->outcome}).",
            ]);
        }

        $validated = $request->validated();
        $smear = $validated['smear_result'];

        DB::transaction(function () use ($case, $user, $followup, $validated, $smear): void {
            $followup->update([
                'recorded_by' => $user->id,
                'collected' => true,
                'collection_date' => $validated['collection_date'],
                'result_date' => $validated['result_date'],
                'smear_result' => $smear,
                // Only a scanty result carries a count; anything else clears it
                // so a stale figure cannot survive a corrected result.
                'afb_count' => $smear === 'Scanty (+n)' ? ($validated['afb_count'] ?? null) : null,
                'remarks' => $validated['remarks'] ?? null,
            ]);

            $case->touch();

            ActivityLogger::record(
                $user,
                'treatment.followup_recorded',
                'Recorded follow-up diagnostic test',
                "Follow-up diagnostic test recorded ({$smear})",
                [
                    'treatment_case_id' => $case->id,
                    'month' => $followup->month,
                    'section' => "Month {$followup->month}",
                ],
                $case,
            );
        });

        return back()->with(
            'success',
            $smear === 'Negative'
                ? 'Follow-up result recorded.'
                : 'Positive result recorded and flagged for RHU review.',
        );
    }

    /**
     * Save or update the ACF Contact Tracing report for this case.
     */
    public function saveContactTracing(
        SaveContactTracingRequest $request,
        TreatmentCase $case,
    ): RedirectResponse {
        $user = $request->user();

        abort_unless(RhuScope::coversTreatmentCase($user, $case), 404);

        if ($case->isClosed()) {
            throw ValidationException::withMessages([
                'enumerator' => "This treatment record is closed ({$case->outcome}).",
            ]);
        }

        $existed = $case->contactTracing()->exists();

        DB::transaction(function () use ($case, $user, $request, $existed): void {
            $case->contactTracing()->updateOrCreate(
                ['treatment_case_id' => $case->id],
                [...$request->validated(), 'recorded_by' => $user->id],
            );

            $case->touch();

            ActivityLogger::record(
                $user,
                'treatment.contact_tracing_saved',
                $existed ? 'Updated contact tracing' : 'Saved contact tracing',
                $existed
                    ? 'ACF contact tracing updated'
                    : 'ACF contact tracing saved',
                ['treatment_case_id' => $case->id, 'section' => 'Contact Tracing'],
                $case,
            );
        });

        return back()->with(
            'success',
            $existed ? 'Contact tracing updated.' : 'Contact tracing saved.',
        );
    }

    /**
     * Close the case with a treatment outcome.
     */
    public function updateOutcome(
        UpdateTreatmentOutcomeRequest $request,
        TreatmentCase $case,
    ): RedirectResponse {
        $user = $request->user();

        abort_unless(RhuScope::coversTreatmentCase($user, $case), 404);

        if ($case->isClosed()) {
            throw ValidationException::withMessages([
                'outcome' => "This case was already closed as {$case->outcome}.",
            ]);
        }

        $outcome = $request->validated('outcome');

        DB::transaction(function () use ($case, $user, $request, $outcome): void {
            $locked = TreatmentCase::query()->lockForUpdate()->find($case->getKey());

            if ($locked === null || $locked->isClosed()) {
                return;
            }

            $locked->update([
                'outcome' => $outcome,
                'outcome_date' => $request->validated('outcome_date'),
                'outcome_remarks' => $request->validated('outcome_remarks'),
                'closed_at' => now(),
            ]);

            ActivityLogger::record(
                $user,
                'treatment.case_closed',
                'Closed treatment case',
                "{$locked->case_number} was closed as {$outcome}.",
                ['treatment_case_id' => $locked->id, 'outcome' => $outcome],
                $locked,
            );
        });

        return back()->with('success', "Case {$case->case_number} was closed as {$outcome}.");
    }

    /**
     * Diagnosed patients in this RHU's catchment with no open treatment case,
     * with the read-only half of the enrolment form already resolved.
     *
     * @return array<int, array<string, mixed>>
     */
    private function enrollmentCandidates(User $user): array
    {
        $enrolledPatientIds = TreatmentCase::query()
            ->whereNull('outcome')
            ->pluck('patient_id')
            ->all();

        return RhuScope::patientRecords($user)
            ->filter(fn (Patient $patient) => $patient->isDiagnosedWithTb()
                && ! in_array($patient->id, $enrolledPatientIds, true))
            ->values()
            ->map(fn (Patient $patient) => [
                'id' => $patient->id,
                'name' => $patient->name,
                'patient_code' => $patient->patient_code ?? ('P'.str_pad((string) $patient->id, 4, '0', STR_PAD_LEFT)),
                'birthday' => $this->birthdayLabel($patient),
                'address' => $patient->address,
                'tb_diagnosis' => $patient->tbDiagnosisLabel(),

                // The five positive sub-classification ticks, shown read-only
                // on the enrolment form exactly as the register prints them.
                'positives' => collect(Patient::POSITIVE_CLASSIFICATIONS)
                    ->mapWithKeys(fn (string $code) => [
                        $code => $patient->response('diagnostic_result') === 'positive'
                            && $patient->response('positive_classification') === $code,
                    ]),
            ])
            ->all();
    }

    private function birthdayLabel(?Patient $patient): string
    {
        $birthday = $patient?->response('birthday');

        if (! $birthday) {
            return '—';
        }

        return Carbon::parse($birthday)->format('M j, Y');
    }

    /**
     * @return array<int, array<string, string|null>>
     */
    private function auditTrail(TreatmentCase $case): array
    {
        return \App\Models\Activity::query()
            ->with('user')
            ->where('subject_type', $case->getMorphClass())
            ->where('subject_id', $case->getKey())
            ->latest()
            ->limit(50)
            ->get()
            ->map(fn ($activity) => [
                'id' => $activity->id,
                // The audit trail reads in the reference's wording. The stored
                // description stays as it is, because Recent Activities shows
                // it across the portal where the patient's name is wanted.
                'action' => match ($activity->type) {
                    'treatment.enrolled' => 'Treatment enrollment saved',
                    default => $activity->description ?? $activity->title,
                },
                // The reference labels a row by the part of the record it
                // touched — the month for anything monthly, otherwise the
                // section name. The logger stores that alongside the activity.
                'section' => $activity->metadata['section'] ?? match ($activity->type) {
                    'treatment.enrolled' => 'Enrollment',
                    'treatment.case_closed' => 'Outcome',
                    'treatment.contact_tracing_saved' => 'Contact Tracing',
                    default => 'Case',
                },
                'user' => $activity->user?->name,
                'date_label' => $activity->created_at->format('M j, Y, g:i A'),
                // Every row in this trail is a completed write; nothing is
                // logged until it has been persisted.
                'status' => 'Saved',
            ])
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function mapCaseRow(TreatmentCase $case): array
    {
        return [
            'id' => $case->id,
            'case_number' => $case->case_number,
            'patient_name' => $case->patient?->name ?? '—',
            'status' => $case->isClosed() ? 'closed' : 'active',
            'status_label' => $case->outcome ?? 'On Treatment',
            'current_month' => $case->currentMonth(),
            'updated_at_label' => $case->updated_at->format('M j, Y'),
        ];
    }
}
