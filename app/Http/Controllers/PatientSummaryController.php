<?php

namespace App\Http\Controllers;

use App\Models\TreatmentEnrollment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PatientSummaryController extends Controller
{
    public function show(Request $request, TreatmentEnrollment $treatmentEnrollment): JsonResponse
    {
        $rhu = $request->user();
        $patient = $treatmentEnrollment->patient;

        abort_unless(
            $rhu instanceof User
                && $rhu->role === 'rhu'
                && $patient?->program?->location_id === $rhu->location_id,
            403,
        );

        $diagnosis = $patient->diagnosticAssessment;

        return response()->json([
            'patient' => [
                'name' => $patient->name,
                'sex' => $patient->sex,
                'age' => $patient->age,
                'date_of_birth' => $patient->date_of_birth?->toDateString(),
                'contact_number' => $patient->contact_number,
                'address' => $patient->address,
            ],
            'diagnosis_label' => $diagnosis?->diagnosisLabel(),
            'enrollment' => [
                'registry_number' => $treatmentEnrollment->registry_number,
                'treatment_facility' => $treatmentEnrollment->treatment_facility,
                'diagnosing_facility' => $treatmentEnrollment->diagnosing_facility,
                'registration_group' => $treatmentEnrollment->registration_group,
                'registration_date' => $treatmentEnrollment->registration_date?->toDateString(),
                'treatment_start_date' => $treatmentEnrollment->treatment_start_date?->toDateString(),
                'baseline_weight' => $treatmentEnrollment->baseline_weight,
                'treatment_regimen' => $treatmentEnrollment->treatment_regimen,
                'assigned_provider' => $treatmentEnrollment->assignedProvider?->name,
                'enrolled_by' => $treatmentEnrollment->creator?->name,
                'outcome' => $treatmentEnrollment->outcome,
                'is_on_treatment' => $treatmentEnrollment->isOnTreatment(),
            ],
            'treatment_progress' => [
                'total_months' => $treatmentEnrollment->regimenMonthCount(),
                'months_completed' => $treatmentEnrollment->treatmentMonitoringRecords()->count(),
            ],
            'overall_adherence_percentage' => $treatmentEnrollment->overallAdherencePercentage(),
        ]);
    }
}
