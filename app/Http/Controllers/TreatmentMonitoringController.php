<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTreatmentMonitoringRequest;
use App\Models\TreatmentEnrollment;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\TreatmentScheduleState;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TreatmentMonitoringController extends Controller
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
            'regimen_month_count' => $treatmentEnrollment->regimenMonthCount(),
            'current_month' => $treatmentEnrollment->currentMonth(),
            'records' => $treatmentEnrollment->treatmentMonitoringRecords()
                ->orderBy('month_number')
                ->get(),
            'months' => TreatmentScheduleState::months($treatmentEnrollment),
        ]);
    }

    public function store(StoreTreatmentMonitoringRequest $request, TreatmentEnrollment $treatmentEnrollment): JsonResponse
    {
        $rhu = $request->user();

        abort_unless(
            $treatmentEnrollment->isOnTreatment(),
            422,
            "This enrollment is closed ({$treatmentEnrollment->outcome}). Monitoring entries are locked.",
        );

        $month = (int) $request->validated('month_number');
        $currentMonth = $treatmentEnrollment->currentMonth();

        abort_if(
            $currentMonth === null,
            422,
            'This regimen has no defined treatment duration yet, so monitoring cannot be recorded.',
        );

        abort_if($month > $currentMonth, 422, "Month {$month} is locked — complete Month {$currentMonth} first.");
        abort_if($month < $currentMonth, 422, "Month {$month} is completed and can no longer be edited.");

        // Recorded once, then edited in place while it's still the current
        // month — every save re-stamps saved_at, which is what re-opening
        // the form and re-submitting ("Edit Review") actually does.
        $record = $treatmentEnrollment->treatmentMonitoringRecords()->updateOrCreate(
            ['month_number' => $month],
            [
                ...$request->validated(),
                'recorded_by' => $rhu->id,
                'saved_at' => now(),
            ],
        );

        ActivityLogger::record(
            $rhu,
            'treatment_monitoring.recorded',
            'Recorded monthly treatment review',
            "Month {$record->month_number} review recorded for {$treatmentEnrollment->patient?->name}.",
            ['patient_id' => $treatmentEnrollment->patient_id, 'enrollment_id' => $treatmentEnrollment->id],
            $record,
        );

        return response()->json(['record' => $record]);
    }
}
