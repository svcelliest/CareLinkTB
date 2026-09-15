<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSmsLogRequest;
use App\Models\Bhw;
use App\Models\Patient;
use App\Models\SmsLog;
use App\Models\User;
use App\Support\UniSmsClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The page (index) renders through Inertia like the rest of the app; the
 * send action (store) stays a plain JSON endpoint (see the RHU treatment
 * pages) so a validation failure doesn't trigger a full Inertia page swap
 * on a form embedded in a page that's also live-polling.
 */
class SmsLogController extends Controller
{
    public function index(Request $request): Response
    {
        $rhu = $request->user();
        abort_unless($rhu instanceof User && $rhu->role === 'rhu', 403);

        $history = SmsLog::query()
            ->with(['patient', 'bhw', 'sender'])
            ->where(function ($query) use ($rhu) {
                $query->whereHas(
                    'patient.program',
                    fn ($q) => $q->where('location_id', $rhu->location_id),
                )->orWhereHas(
                    'bhw',
                    fn ($q) => $q->where('location_id', $rhu->location_id),
                );
            })
            ->orderByDesc('sent_at')
            ->get()
            ->map(fn (SmsLog $log) => [
                'id' => $log->id,
                'recipient' => $log->patient?->name ?? $log->bhw?->name,
                'recipient_type' => $log->patient_id ? 'patient' : 'bhw',
                'contact_number' => $log->contact_number,
                'message' => $log->message,
                'sent_by' => $log->sender?->name,
                'sent_at' => $log->sent_at->toIso8601String(),
            ]);

        // Only patients ever enrolled in treatment monitoring are eligible
        // SMS recipients — routine screening-only patients don't need
        // treatment reminders.
        $patients = Patient::query()
            ->whereHas('program', fn ($q) => $q->where('location_id', $rhu->location_id))
            ->whereHas('treatmentEnrollments')
            ->orderBy('name')
            ->get(['id', 'name', 'contact_number'])
            ->map(fn (Patient $patient) => [
                'id' => $patient->id,
                'type' => 'patient',
                'name' => $patient->name,
                'contact_number' => $patient->contact_number,
            ]);

        $bhws = Bhw::query()
            ->where('location_id', $rhu->location_id)
            ->orderBy('name')
            ->get(['id', 'name', 'contact_number', 'address'])
            ->map(fn (Bhw $bhw) => [
                'id' => $bhw->id,
                'type' => 'bhw',
                'name' => $bhw->name,
                'contact_number' => $bhw->contact_number,
                'address' => $bhw->address,
            ]);

        return Inertia::render('Rhu/SmsLog/Index', [
            'municipality' => $rhu->location?->name,
            'recipients' => $patients->concat($bhws)->values(),
            'history' => $history,
        ]);
    }

    public function store(StoreSmsLogRequest $request, UniSmsClient $sms): JsonResponse
    {
        $rhu = $request->user();

        $patient = $request->validated('patient_id')
            ? Patient::find($request->validated('patient_id'))
            : null;
        $bhw = $request->validated('bhw_id')
            ? Bhw::find($request->validated('bhw_id'))
            : null;

        $contactNumber = $patient?->contact_number ?? $bhw?->contact_number;
        $message = $request->validated('message');

        try {
            $sms->send($contactNumber, $message);
        } catch (\Throwable $exception) {
            Log::error('SMS dispatch failed', [
                'sent_by' => $rhu->id,
                'patient_id' => $patient?->id,
                'bhw_id' => $bhw?->id,
                'exception' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'The SMS could not be sent. Please try again.',
            ], 422);
        }

        $log = SmsLog::create([
            'patient_id' => $patient?->id,
            'bhw_id' => $bhw?->id,
            'sent_by' => $rhu->id,
            'contact_number' => $contactNumber,
            'message' => $message,
            'sent_at' => now(),
        ]);

        return response()->json([
            'log' => [
                'id' => $log->id,
                'recipient' => $patient?->name ?? $bhw?->name,
                'recipient_type' => $patient ? 'patient' : 'bhw',
                'contact_number' => $log->contact_number,
                'message' => $log->message,
                'sent_at' => $log->sent_at->toIso8601String(),
            ],
        ]);
    }
}
