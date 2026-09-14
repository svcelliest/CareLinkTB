<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreBhwRequest;
use App\Models\Bhw;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class BhwController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rhu = $request->user();
        abort_unless($rhu instanceof User && $rhu->role === 'rhu', 403);

        $bhws = Bhw::query()
            ->where('location_id', $rhu->location_id)
            ->orderBy('name')
            ->get(['id', 'name', 'contact_number', 'address']);

        return response()->json(['bhws' => $bhws]);
    }

    public function store(StoreBhwRequest $request): JsonResponse
    {
        $rhu = $request->user();

        try {
            $bhw = Bhw::create([
                ...$request->validated(),
                'added_by' => $rhu->id,
                'location_id' => $rhu->location_id,
            ]);
        } catch (\Throwable $exception) {
            Log::error('BHW create failed', [
                'added_by' => $rhu->id,
                'exception' => $exception->getMessage(),
            ]);
            throw $exception;
        }

        return response()->json([
            'bhw' => $bhw->only(['id', 'name', 'contact_number', 'address']),
        ]);
    }

    public function destroy(Request $request, Bhw $bhw): JsonResponse
    {
        $rhu = $request->user();

        abort_unless(
            $rhu instanceof User
                && $rhu->role === 'rhu'
                && $bhw->location_id === $rhu->location_id,
            403,
        );

        if ($bhw->smsLogs()->exists()) {
            return response()->json([
                'message' => "{$bhw->name} has SMS history and can't be removed.",
            ], 422);
        }

        $bhw->delete();

        return response()->json(['deleted' => true]);
    }
}
