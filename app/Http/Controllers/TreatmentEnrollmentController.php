<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTreatmentEnrollmentRequest;
use App\Models\Patient;
use App\Models\TreatmentEnrollment;
use App\Models\User;
use App\Support\ActivityLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class TreatmentEnrollmentController extends Controller
{
    public function create(Request $request, Patient $patient): Response
    {
        $rhu = $request->user();

        abort_unless(
            $rhu instanceof User
                && $rhu->role === 'rhu'
                && $patient->program?->location_id === $rhu->location_id,
            403,
        );

        $diagnosis = $patient->diagnosticAssessment;

        abort_unless(
            $diagnosis !== null && $diagnosis->tb_diagnosis !== null,
            422,
            'Patient must have a positive TB diagnosis before enrollment.',
        );

        return Inertia::render('Rhu/Enrollments/Create', [
            'patient' => [
                'id' => $patient->id,
                'name' => $patient->name,
                'age' => $patient->age,
                'sex' => $patient->sex,
                'address' => $patient->address,
                'contact_number' => $patient->contact_number,
            ],
            'diagnosis' => [
                'result_dssm' => $diagnosis->result_dssm,
                'result_rr' => $diagnosis->result_rr,
                'result_t' => $diagnosis->result_t,
                'result_tt' => $diagnosis->result_tt,
                'result_ti' => $diagnosis->result_ti,
                'tb_diagnosis' => $diagnosis->tb_diagnosis,
            ],
        ]);
    }

    public function store(StoreTreatmentEnrollmentRequest $request, Patient $patient): RedirectResponse
    {
        $rhu = $request->user();

        $diagnosis = $patient->diagnosticAssessment;

        abort_unless(
            $diagnosis !== null && $diagnosis->tb_diagnosis !== null,
            422,
            'Patient must have a positive TB diagnosis before enrollment.',
        );

        $enrollment = DB::transaction(function () use ($rhu, $patient, $request): TreatmentEnrollment {
            $enrollment = $patient->treatmentEnrollments()->create([
                ...$request->validated(),
                'assigned_provider_id' => $rhu->id,
                'created_by' => $rhu->id,
            ]);

            ActivityLogger::record(
                $rhu,
                'treatment.enrolled',
                'Enrolled patient in treatment',
                "{$patient->name} was enrolled under case number {$enrollment->case_number}.",
                ['patient_id' => $patient->id, 'enrollment_id' => $enrollment->id],
                $enrollment,
            );

            return $enrollment;
        });

        return redirect()
            ->route('rhu.programs.show', $patient->program_id)
            ->with('success', "{$patient->name} was enrolled in treatment.");
    }
}
