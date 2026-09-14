<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreTreatmentMonitoringRequest;
use App\Models\TreatmentEnrollment;
use App\Models\User;
use App\Support\ActivityLogger;
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
            'records' => $treatmentEnrollment->treatmentMonitoringRecords()
                ->orderBy('month_number')
                ->get(),
        ]);
    }

    public function store(StoreTreatmentMonitoringRequest $request, TreatmentEnrollment $treatmentEnrollment): JsonResponse
    {
        $rhu = $request->user();

        $record = $treatmentEnrollment->treatmentMonitoringRecords()->create([
            ...$request->validated(),
            'recorded_by' => $rhu->id,
        ]);

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
