<?php

namespace App\Support;

use App\Models\Activity;
use App\Models\ContactTracingRecord;
use App\Models\DiagnosticAssessment;
use App\Models\FollowUpExam;
use App\Models\MedicationDispensingRecord;
use App\Models\Patient;
use App\Models\SputumCollection;
use App\Models\TreatmentEnrollment;
use App\Models\TreatmentMonitoringRecord;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Every activity across a patient's whole case — not just the Patient row,
 * but everything reachable from it (Diagnostic Assessment, Sputum
 * Collection, Contact Tracing, every Treatment Enrollment episode, and
 * everything chained off one). Extracted from AuditTrailController so the
 * RHU Treatment bridging controller can reuse the same gather logic.
 */
class PatientAuditTrail
{
    /**
     * @return Collection<int, array<string, mixed>>
     */
    public static function forPatient(Patient $patient): Collection
    {
        $enrollmentIds = TreatmentEnrollment::query()
            ->where('patient_id', $patient->id)
            ->pluck('id');

        $monitoringIds = TreatmentMonitoringRecord::query()
            ->whereIn('treatment_enrollment_id', $enrollmentIds)
            ->pluck('id');

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

        return Activity::query()
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
    }
}
