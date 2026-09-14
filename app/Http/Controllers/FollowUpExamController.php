<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreFollowUpExamRequest;
use App\Models\TreatmentEnrollment;
use App\Models\User;
use App\Support\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FollowUpExamController extends Controller
{
    public function index(Request $request, TreatmentEnrollment $treatmentEnrollment): JsonResponse
    {
        $rhu = $request->user();

        abort_unless(
            $rhu instanceof User
                && $rhu->role === 'rhu'
                && $treatmentEnrollment->patient?->program?->location_id === $rhu->location_id,
            403,
        );

        return response()->json([
            'due_months' => $treatmentEnrollment->followUpExamScheduleMonths(),
            'exams' => $treatmentEnrollment->followUpExams()
                ->orderBy('month_number')
                ->get(),
        ]);
    }

    public function store(StoreFollowUpExamRequest $request, TreatmentEnrollment $treatmentEnrollment): JsonResponse
    {
        $rhu = $request->user();

        $exam = $treatmentEnrollment->followUpExams()->create([
            ...$request->validated(),
            'recorded_by' => $rhu->id,
        ]);

        ActivityLogger::record(
            $rhu,
            'follow_up_exam.recorded',
            'Recorded follow-up exam',
            "Month {$exam->month_number} follow-up exam recorded for {$treatmentEnrollment->patient?->name}.",
            ['patient_id' => $treatmentEnrollment->patient_id, 'enrollment_id' => $treatmentEnrollment->id],
            $exam,
        );

        return response()->json(['exam' => $exam]);
    }
}
