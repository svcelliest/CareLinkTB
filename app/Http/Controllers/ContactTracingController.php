<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreContactTracingRequest;
use App\Models\Patient;
use App\Models\User;
use App\Support\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactTracingController extends Controller
{
    public function show(Request $request, Patient $patient): JsonResponse
    {
        $rhu = $request->user();

        abort_unless(
            $rhu instanceof User
                && $rhu->role === 'rhu'
                && $patient->program?->location_id === $rhu->location_id,
            403,
        );

        return response()->json([
            'contact_tracing' => $patient->contactTracingRecord,
        ]);
    }

    public function store(StoreContactTracingRequest $request, Patient $patient): JsonResponse
    {
        $rhu = $request->user();

        $record = $patient->contactTracingRecord()->updateOrCreate(
            ['patient_id' => $patient->id],
            [
                ...$request->validated(),
                'recorded_by' => $rhu->id,
            ],
        );

        ActivityLogger::record(
            $rhu,
            'contact_tracing.saved',
            'Saved contact tracing record',
            "Contact tracing was recorded for {$patient->name}.",
            ['patient_id' => $patient->id],
            $record,
        );

        return response()->json([
            'contact_tracing' => $record,
        ]);
    }
}
