<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use App\Models\TreatmentCase;
use App\Support\RhuScope;
use App\Support\TreatmentAlerts;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RhuController extends Controller
{
    /**
     * The RHU dashboard: the two headline counts, the two progress rings, and
     * the recent-activity strip from the reference.
     *
     * Every figure is computed from the live `patients`, `treatment_cases` and
     * `activities` tables, narrowed to the account's municipality by
     * {@see RhuScope}. Nothing here is sampled or hard-coded.
     */
    public function dashboard(Request $request): Response
    {
        $user = $request->user();

        // The dashboard is where the RHU starts the day, so this is where the
        // treatment alerts — low medication, approaching follow-up tests —
        // are raised for the open cases it covers.
        TreatmentAlerts::sweepFor($user);

        return Inertia::render('Rhu/Dashboard', [
            'municipality' => RhuScope::municipality($user),
            'facility' => RhuScope::facility($user),

            // Deferred so the shell paints straight away, matching the pattern
            // the provider dashboard already uses.
            'stats' => Inertia::defer(function () use ($user) {
                $patients = RhuScope::patientRecords($user);
                $openCases = RhuScope::treatmentCases($user)->whereOpen()->count();

                return [
                    // "Awaiting diagnostic confirmation": flagged presumptive
                    // during screening, with no diagnostic result recorded yet.
                    'presumptive_patients' => $patients
                        ->filter(fn (Patient $patient) => $patient->isPresumptive()
                            && ! $patient->hasDiagnosticAssessment())
                        ->count(),
                    'active_cases' => $openCases,
                    'total_patients' => $patients->count(),
                    'closed_cases' => RhuScope::treatmentCases($user)
                        ->whereNotNull('outcome')
                        ->count(),
                ];
            }),

            // Same two steps the Patient Tracker itself counts, and counted the
            // same way: sputum per patient, diagnostic per required test.
            'tracker_progress' => Inertia::defer(function () use ($user) {
                $patients = RhuScope::patientRecords($user);
                $total = $patients->count();

                return [
                    'total' => $total,
                    'collected' => $patients
                        ->filter(fn (Patient $patient) => $patient->sputumCollected())
                        ->count(),
                    'tests_completed' => $patients
                        ->sum(fn (Patient $patient) => $patient->diagnosticTestsCompleted()),
                    'tests_total' => $total * count(Patient::DIAGNOSTIC_TESTS),
                ];
            }),

            // Monitoring progress across every open case: how many of the
            // treatment months that are already due have a review recorded.
            'monitoring_progress' => Inertia::defer(function () use ($user) {
                $cases = RhuScope::treatmentCases($user)
                    ->whereOpen()
                    ->withCount('monitoringEntries')
                    // currentMonth() reads both relations now that it is
                    // derived from completed work rather than the date.
                    ->with(['monitoringEntries', 'dispensingRecords'])
                    ->get();

                $due = $cases->sum(fn (TreatmentCase $case) => $case->currentMonth());
                $recorded = $cases->sum(
                    fn (TreatmentCase $case) => min(
                        $case->monitoring_entries_count,
                        $case->currentMonth(),
                    ),
                );

                return [
                    'total' => $due,
                    'completed' => $recorded,
                    'cases' => $cases->count(),
                ];
            }),

            'recent_activities' => Inertia::defer(fn () => $user->activities()
                ->latest()
                ->take(5)
                ->get()
                ->map(fn ($activity) => [
                    'id' => $activity->id,
                    'title' => $activity->title,
                    'description' => $activity->description,
                    'tag' => self::activityTag($activity->type),
                    'datetime_label' => $activity->created_at->format('M j, Y – h:i A'),
                    'time_label' => $activity->created_at->format('h:i A'),
                ])),
        ]);
    }

    /**
     * Short uppercase module tag beside a dashboard activity row. Display only
     * — it does not change how activities are stored or queried. Mirrors the
     * provider dashboard's tagger, extended with the RHU's own action types.
     */
    private static function activityTag(string $type): string
    {
        return match (true) {
            str_starts_with($type, 'treatment.') => 'TREATMENT',
            str_starts_with($type, 'diagnostic.') => 'PATIENT TRACKER',
            $type === 'program.patient_notified' => 'SMS LOG',
            str_starts_with($type, 'program.') => 'PROGRAM',
            str_starts_with($type, 'message.') => 'INBOX',
            str_starts_with($type, 'account.') => 'ACCOUNT',
            str_starts_with($type, 'security.') => 'SECURITY',
            str_starts_with($type, 'profile.') => 'PROFILE',
            default => 'ACTIVITY',
        };
    }
}
