<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSputumCollectionRequest;
use App\Models\Patient;
use App\Models\User;
use App\Support\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SputumCollectionController extends Controller
{
    public function show(Request $request, Patient $patient): JsonResponse
    {
        $user = $request->user();

        abort_unless($user instanceof User && $this->canView($user, $patient), 403);

        return response()->json([
            'sputum_collection' => $patient->sputumCollection,
        ]);
    }

    public function store(StoreSputumCollectionRequest $request, Patient $patient): JsonResponse
    {
        $coordinator = $request->user();

        $record = $patient->sputumCollection()->updateOrCreate(
            ['patient_id' => $patient->id],
            [
                ...$request->validated(),
                'recorded_by' => $coordinator->id,
            ],
        );

        ActivityLogger::record(
            $coordinator,
            'sputum_collection.saved',
            'Saved sputum collection record',
            "Sputum collection was recorded for {$patient->name}.",
            ['patient_id' => $patient->id],
            $record,
        );

        return response()->json(['sputum_collection' => $record]);
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
