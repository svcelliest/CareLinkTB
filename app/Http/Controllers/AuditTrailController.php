<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use App\Models\User;
use App\Support\PatientAuditTrail;
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

        return response()->json([
            'activities' => PatientAuditTrail::forPatient($patient),
        ]);
    }
}
