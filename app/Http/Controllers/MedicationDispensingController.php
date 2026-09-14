<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMedicationDispensingRequest;
use App\Models\TreatmentMonitoringRecord;
use App\Models\User;
use App\Support\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MedicationDispensingController extends Controller
{
    public function index(Request $request, TreatmentMonitoringRecord $treatmentMonitoringRecord): JsonResponse
    {
        $rhu = $request->user();

        abort_unless(
            $rhu instanceof User
                && $rhu->role === 'rhu'
                && $treatmentMonitoringRecord->treatmentEnrollment?->patient?->program?->location_id === $rhu->location_id,
            403,
        );

        return response()->json([
            'records' => $treatmentMonitoringRecord->medicationDispensingRecords()
                ->orderBy('week_number')
                ->get(),
        ]);
    }

    public function store(StoreMedicationDispensingRequest $request, TreatmentMonitoringRecord $treatmentMonitoringRecord): JsonResponse
    {
        $rhu = $request->user();

        $record = $treatmentMonitoringRecord->medicationDispensingRecords()->create([
            ...$request->validated(),
            // Duplicated from the parent monitoring row on purpose (see the
            // migration's own comment) — always taken from the parent, never
            // client-supplied, so it can't drift from the row it belongs to.
            'month_number' => $treatmentMonitoringRecord->month_number,
        ]);

        $enrollment = $treatmentMonitoringRecord->treatmentEnrollment;

        ActivityLogger::record(
            $rhu,
            'medication_dispensing.recorded',
            'Recorded weekly medication dispensing',
            "Month {$record->month_number} Week {$record->week_number} dispensing recorded for {$enrollment?->patient?->name}.",
            ['patient_id' => $enrollment?->patient_id, 'treatment_monitoring_id' => $treatmentMonitoringRecord->id],
            $record,
        );

        return response()->json(['record' => $record]);
    }
}
