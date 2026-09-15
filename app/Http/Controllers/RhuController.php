<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use App\Models\Program;
use App\Models\TreatmentEnrollment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RhuController extends Controller
{
    /**
     * The RHU dashboard: the two headline counts, the two progress rings
     * (Patient Tracker and Treatment Monitoring), and the recent-activity
     * strip from the medjofinal-rhu-provider-portals reference.
     *
     * Every section is deferred so the shell paints straight away — same
     * pattern the provider dashboard already uses — and every figure is
     * computed live from `patients`/`treatment_enrollments`/`activities`,
     * scoped to the account's municipality; nothing here is sampled.
     */
    public function dashboard(Request $request): Response
    {
        $rhu = $request->user();

        return Inertia::render('Rhu/Dashboard', [
            'municipality' => $rhu->location?->name,

            'stats' => Inertia::defer(function () use ($rhu) {
                $patients = Patient::query()
                    ->whereHas('program', fn ($q) => $q->where('location_id', $rhu->location_id))
                    ->with('diagnosticAssessment')
                    ->get();

                return [
                    // "Awaiting diagnostic confirmation": flagged presumptive
                    // during screening, with no diagnostic result recorded yet.
                    'presumptive_patients' => $patients
                        ->filter(fn (Patient $p) => $p->isPresumptive() && $p->diagnosticAssessment === null)
                        ->count(),
                    'active_cases' => $this->rhuEnrollments($rhu)->whereNull('outcome')->count(),
                ];
            }),

            // The same two steps the Patient Tracker itself counts, counted
            // the same way: sputum per patient, diagnostic per required test.
            'tracker_progress' => Inertia::defer(function () use ($rhu) {
                $patients = Patient::query()
                    ->whereHas('program', fn ($q) => $q->where('location_id', $rhu->location_id))
                    ->with(['sputumCollection', 'diagnosticAssessment'])
                    ->get();

                return [
                    'total' => $patients->count(),
                    'collected' => $patients->filter(fn (Patient $p) => (bool) $p->sputumCollection?->collected)->count(),
                    'tests_completed' => $patients->filter(
                        fn (Patient $p) => (bool) $p->diagnosticAssessment?->tested_with_gxpert
                            || (bool) $p->diagnosticAssessment?->tested_with_dssm,
                    )->count(),
                    // One test (GXpert or DSSM) per patient.
                    'tests_total' => $patients->count(),
                ];
            }),

            // Across every open case: how many of the treatment months
            // already due (per TreatmentEnrollment::currentMonth()) have
            // actually been recorded complete.
            'monitoring_progress' => Inertia::defer(function () use ($rhu) {
                $enrollments = $this->rhuEnrollments($rhu)
                    ->whereNull('outcome')
                    ->with('treatmentMonitoringRecords.medicationDispensingRecords')
                    ->get();

                $due = $enrollments->sum(fn (TreatmentEnrollment $e) => $e->currentMonth() ?? 0);
                $completed = $enrollments->sum(function (TreatmentEnrollment $e) {
                    $current = $e->currentMonth();

                    if ($current === null) {
                        return 0;
                    }

                    return $e->allMonthsComplete() ? $current : $current - 1;
                });

                return [
                    'total' => $due,
                    'completed' => $completed,
                    'cases' => $enrollments->count(),
                ];
            }),

            'recent_activities' => Inertia::defer(fn () => $rhu->activities()
                ->latest()
                ->take(5)
                ->get()
                ->map(fn ($activity) => [
                    'id' => $activity->id,
                    'title' => $activity->title,
                    'tag' => self::activityTag($activity->type),
                    'datetime_label' => $activity->created_at->clone()->setTimezone('Asia/Manila')->format('M j, Y – g:i A'),
                    'time_label' => $activity->created_at->clone()->setTimezone('Asia/Manila')->format('g:i A'),
                ])),
        ]);
    }

    private function rhuEnrollments(User $rhu)
    {
        return TreatmentEnrollment::query()
            ->whereHas('patient.program', fn ($q) => $q->where('location_id', $rhu->location_id));
    }

    /**
     * Short uppercase module tag beside a dashboard activity row. Display
     * only — mirrors the provider dashboard's tagger, extended with the
     * RHU's own action types.
     */
    private static function activityTag(string $type): string
    {
        return match (true) {
            str_starts_with($type, 'treatment.') => 'TREATMENT',
            str_starts_with($type, 'diagnostic') => 'PATIENT TRACKER',
            str_starts_with($type, 'sputum_collection') => 'PATIENT TRACKER',
            $type === 'program.patient_notified' => 'SMS LOG',
            str_starts_with($type, 'program.') => 'PROGRAM',
            str_starts_with($type, 'message.') => 'INBOX',
            str_starts_with($type, 'account.') => 'ACCOUNT',
            str_starts_with($type, 'security.') => 'SECURITY',
            str_starts_with($type, 'profile.') => 'PROFILE',
            default => 'ACTIVITY',
        };
    }

    /**
     * Patient Tracker: Sputum Collection (read-only here — ICM-owned, see
     * SputumCollectionController) and Diagnostic Assessment (the RHU's own,
     * saved patient-by-patient through DiagnosticAssessmentController).
     */
    public function patientTracker(Request $request): Response
    {
        $rhu = $request->user();

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'program' => ['nullable', 'integer'],
            'tab' => ['nullable', Rule::in(['sputum', 'diagnostic'])],
        ]);

        $search = trim($filters['search'] ?? '');

        // The program filter is itself authorized: an id outside the RHU's
        // catchment is dropped rather than applied, so it cannot be used to
        // pull another municipality's roster.
        $programs = Program::where('location_id', $rhu->location_id)
            ->orderByDesc('scheduled_at')
            ->get(['id', 'name', 'scheduled_at']);

        $programId = $filters['program'] ?? null;
        if ($programId !== null && ! $programs->contains('id', $programId)) {
            $programId = null;
        }

        $scoped = Patient::query()
            ->whereHas('program', fn ($query) => $query->where('location_id', $rhu->location_id));

        $patients = (clone $scoped)
            ->with(['sputumCollection', 'diagnosticAssessment', 'treatmentEnrollments'])
            ->when($programId !== null, fn ($query) => $query->where('program_id', $programId))
            ->when($search !== '', function ($query) use ($search) {
                $escaped = addcslashes($search, '%_\\');

                $query->where(fn ($scoped) => $scoped
                    ->where('name', 'like', '%'.$escaped.'%')
                    ->orWhere('patient_code', 'like', '%'.$escaped.'%')
                    ->orWhere('contact_number', 'like', '%'.$escaped.'%'));
            })
            ->orderBy('name')
            ->get();

        // Progress is counted over the whole catchment, not the filtered
        // view, so searching/filtering does not make the module look less
        // finished.
        $all = (clone $scoped)->with(['sputumCollection', 'diagnosticAssessment'])->get();

        return Inertia::render('Rhu/PatientTracker/Index', [
            'patients' => $patients->values()->map(
                fn (Patient $patient, int $index) => $this->mapTrackerPatient($patient, $index + 1),
            ),
            'programs' => $programs->map(fn (Program $program) => [
                'id' => $program->id,
                'name' => $program->name,
                'date_label' => $program->scheduled_at->clone()->setTimezone('Asia/Manila')->format('M j, Y'),
            ]),
            'filters' => [
                'search' => $search,
                'program' => $programId,
                'tab' => $filters['tab'] ?? 'sputum',
            ],
            // A patient is done with testing once either GXpert or DSSM is
            // recorded — never both are required.
            'progress' => [
                'total' => $all->count(),
                'collected' => $all->filter(fn (Patient $p) => (bool) $p->sputumCollection?->collected)->count(),
                'tests_completed' => $all->filter(
                    fn (Patient $p) => (bool) $p->diagnosticAssessment?->tested_with_gxpert
                        || (bool) $p->diagnosticAssessment?->tested_with_dssm,
                )->count(),
                'tests_total' => $all->count(),
            ],
            'municipality' => $rhu->location?->name,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function mapTrackerPatient(Patient $patient, int $number): array
    {
        $sputum = $patient->sputumCollection;
        $diagnostic = $patient->diagnosticAssessment;

        return [
            'id' => $patient->id,
            'number' => $number,
            'name' => $patient->name,
            'contact_number' => $patient->contact_number,
            'address' => $patient->address,

            // ICM-owned — this screen only displays it.
            'sputum_collected' => match ($sputum?->collected) {
                true => '1',
                false => '0',
                default => '',
            },
            'not_collected_reason' => $sputum?->not_collected_reason,
            'icm_remarks' => $sputum?->remarks,

            // RHU-owned — editable through the Diagnostic Assessment tab.
            'tested_with_gxpert' => (bool) $diagnostic?->tested_with_gxpert,
            'tested_with_dssm' => (bool) $diagnostic?->tested_with_dssm,
            'result_dssm' => (bool) $diagnostic?->result_dssm,
            'result_rr' => (bool) $diagnostic?->result_rr,
            'result_t' => (bool) $diagnostic?->result_t,
            'result_tt' => (bool) $diagnostic?->result_tt,
            'result_ti' => (bool) $diagnostic?->result_ti,
            'result_negative' => (bool) $diagnostic?->result_negative,
            'tb_diagnosis' => $diagnostic?->tb_diagnosis,
            'diagnostic_remarks' => $diagnostic?->remarks,

            // Derived from the treatment register, never typed.
            'treatment_status' => $this->treatmentStatusFor($patient),
        ];
    }

    /**
     * @return array{tone: string, label: string}
     */
    private function treatmentStatusFor(Patient $patient): array
    {
        $enrollment = $patient->currentTreatmentEnrollment();

        if ($enrollment === null) {
            return ['tone' => 'not_enrolled', 'label' => 'Not yet Enrolled'];
        }

        if ($enrollment->isOnTreatment()) {
            return ['tone' => 'enrolled', 'label' => 'On Treatment'];
        }

        return ['tone' => 'closed', 'label' => ucwords(str_replace('_', ' ', $enrollment->outcome))];
    }
}
