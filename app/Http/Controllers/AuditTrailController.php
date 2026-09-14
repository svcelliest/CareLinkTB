<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\ContactTracingRecord;
use App\Models\DiagnosticAssessment;
use App\Models\FollowUpExam;
use App\Models\MedicationDispensingRecord;
use App\Models\Patient;
use App\Models\SputumCollection;
use App\Models\TreatmentEnrollment;
use App\Models\TreatmentMonitoringRecord;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditTrailController extends Controller
{
    public function index(Request $request, Patient $patient): JsonResponse
    {
        $rhu = $request->user();

        abort_unless(
            $rhu instanceof User
                && $rhu->role === 'rhu'
                && $patient->program?->location_id === $rhu->location_id,
            403,
        );

        $enrollmentIds = TreatmentEnrollment::query()
            ->where('patient_id', $patient->id)
            ->pluck('id');

        $monitoringIds = TreatmentMonitoringRecord::query()
            ->whereIn('treatment_enrollment_id', $enrollmentIds)
            ->pluck('id');

        // Every table that can hold a piece of this patient's case, not
        // just the patients row itself — Diagnostic Assessment, Sputum
        // Collection, Contact Tracing, every Treatment Enrollment episode,
        // and everything chained off an enrollment (Treatment Monitoring,
        // Medication Dispensing, Follow-up Exams).
        $subjectIdsByType = [
            Patient::class => [$patient->id],
            SputumCollection::class => [$patient->sputumCollection?->id],
            DiagnosticAssessment::class => [$patient->diagnosticAssessment?->id],
            ContactTracingRecord::class => [$patient->contactTracingRecord?->id],
            TreatmentEnrollment::class => $enrollmentIds->all(),
            TreatmentMonitoringRecord::class => $monitoringIds->all(),
            MedicationDispensingRecord::class => MedicationDispensingRecord::query()
                ->whereIn('treatment_monitoring_id', $monitoringIds)
                ->pluck('id')
                ->all(),
            FollowUpExam::class => FollowUpExam::query()
                ->whereIn('treatment_enrollment_id', $enrollmentIds)
                ->pluck('id')
                ->all(),
        ];

        $activities = Activity::query()
            ->where(function (Builder $query) use ($subjectIdsByType) {
                foreach ($subjectIdsByType as $type => $ids) {
                    $ids = array_values(array_filter($ids));

                    if ($ids === []) {
                        continue;
                    }

                    $query->orWhere(function (Builder $subQuery) use ($type, $ids) {
                        $subQuery->where('subject_type', $type)->whereIn('subject_id', $ids);
                    });
                }
            })
            ->with('user')
            ->latest()
            ->get()
            ->map(fn (Activity $activity) => [
                'id' => $activity->id,
                'type' => $activity->type,
                'title' => $activity->title,
                'description' => $activity->description,
                'created_at' => $activity->created_at?->toIso8601String(),
                'actor' => $activity->user ? [
                    'name' => $activity->user->name,
                    'role' => $activity->user->role,
                ] : null,
            ]);

        return response()->json(['activities' => $activities]);
    }
}
