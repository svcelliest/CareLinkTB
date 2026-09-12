<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\Patient;
use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\RhuScope;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * SMS Log — the reference's "Active TB Case Alerts" screen.
 *
 * No SMS gateway is configured in this application. The provider portal
 * already faces the same limitation and resolves it the same way: sending
 * records that the patient was notified — `patients.notified_at` plus an
 * activity carrying the message — rather than pretending a message was
 * delivered. The history table below is that log, read back; it is real data,
 * not a mock feed, and the screen says plainly that it is a record of notices
 * rather than gateway delivery receipts.
 */
class RhuSmsLogController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'history' => ['nullable', 'string', 'max:100'],
        ]);

        $search = trim($filters['search'] ?? '');
        $historySearch = trim($filters['history'] ?? '');

        // The alert list is the RHU's confirmed TB cases — the patients the
        // reference screen is for — with a contact number to send to.
        $recipients = RhuScope::patientRecords($user)
            ->filter(fn (Patient $patient) => $patient->isDiagnosedWithTb()
                && filled($patient->contact_number))
            ->when($search !== '', fn ($rows) => $rows->filter(
                fn (Patient $patient) => str_contains(mb_strtolower($patient->name), mb_strtolower($search))
                    || str_contains((string) $patient->contact_number, $search),
            ))
            ->values()
            ->map(fn (Patient $patient) => [
                'id' => $patient->id,
                'name' => $patient->name,
                'contact_number' => $patient->contact_number,
                'tb_diagnosis' => $patient->tbDiagnosisLabel(),
                'last_notified_label' => $patient->notified_at?->format('M j, Y – g:i A'),
            ]);

        return Inertia::render('Rhu/SmsLog/Index', [
            'recipients' => $recipients,
            'history' => $this->history($user, $historySearch),
            'filters' => ['search' => $search, 'history' => $historySearch],
            'municipality' => RhuScope::municipality($user),
        ]);
    }

    /**
     * Log an alert against the selected patients.
     */
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'patients' => ['required', 'array', 'min:1', 'max:200'],
            'patients.*' => ['integer'],
            'message' => ['required', 'string', 'max:480'],
        ], [
            'patients.required' => 'Select at least one patient to notify.',
        ]);

        $patients = Patient::query()
            ->whereIn('id', $validated['patients'])
            ->get()
            ->filter(fn (Patient $patient) => RhuScope::coversPatient($user, $patient));

        // As on the Patient Tracker, an id outside the catchment fails the
        // whole request rather than being quietly skipped.
        abort_unless($patients->count() === count(array_unique($validated['patients'])), 404);

        DB::transaction(function () use ($patients, $user, $validated): void {
            foreach ($patients as $patient) {
                $patient->update(['notified_at' => now()]);

                ActivityLogger::record(
                    $user,
                    'program.patient_notified',
                    'Logged TB case alert',
                    "An alert was logged for {$patient->name} ({$patient->contact_number}).",
                    [
                        'patient_id' => $patient->id,
                        'contact_number' => $patient->contact_number,
                        'message' => $validated['message'],
                    ],
                    $patient,
                );
            }
        });

        return back()->with(
            'success',
            $patients->count().' alert(s) were logged for the selected patients.',
        );
    }

    /**
     * The message history: the alert activities logged by the RHU accounts
     * covering this municipality.
     *
     * @return array<int, array<string, mixed>>
     */
    private function history(User $user, string $search): array
    {
        $municipality = RhuScope::municipality($user);

        if ($municipality === null) {
            return [];
        }

        $staffIds = User::query()
            ->where('role', 'rhu')
            ->where('municipality', $municipality)
            ->pluck('id');

        return Activity::query()
            ->where('type', 'program.patient_notified')
            ->whereIn('user_id', $staffIds)
            ->when($search !== '', function ($query) use ($search): void {
                $escaped = addcslashes($search, '%_\\');
                $query->where('description', 'like', '%'.$escaped.'%');
            })
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn (Activity $activity) => [
                'id' => $activity->id,
                'contact_number' => $activity->metadata['contact_number'] ?? '—',
                'message' => $activity->metadata['message'] ?? $activity->description,
                'sent_at_label' => $activity->created_at->format('Y-m-d h:i A'),
            ])
            ->all();
    }
}
