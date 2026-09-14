<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDiagnosticAssessmentRequest;
use App\Models\Patient;
use App\Models\User;
use App\Support\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DiagnosticAssessmentController extends Controller
{
    public function show(Request $request, Patient $patient): JsonResponse
    {
        $user = $request->user();

        abort_unless($user instanceof User && $this->canView($user, $patient), 403);

        return response()->json([
            'diagnostic_assessment' => $patient->diagnosticAssessment,
        ]);
    }

    public function store(StoreDiagnosticAssessmentRequest $request, Patient $patient): JsonResponse
    {
        $rhu = $request->user();

        $record = $patient->diagnosticAssessment()->updateOrCreate(
            ['patient_id' => $patient->id],
            [
                ...$request->validated(),
                'recorded_by' => $rhu->id,
            ],
        );

        ActivityLogger::record(
            $rhu,
            'diagnostic_assessment.saved',
            'Saved diagnostic assessment',
            "Diagnostic assessment was recorded for {$patient->name}.",
            ['patient_id' => $patient->id],
            $record,
        );

        return response()->json(['diagnostic_assessment' => $record]);
    }

    private function canView(User $user, Patient $patient): bool
    {
        return match ($user->role) {
            'icm' => $patient->program?->created_by === $user->id,
            'rhu' => $patient->program?->location_id === $user->location_id,
            default => false,
        };
    }
}
