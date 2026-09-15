<?php

namespace App\Http\Controllers;

use App\Http\Requests\Rhu\StoreBhwRequest;
use App\Models\Activity;
use App\Models\Bhw;
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
 *
 * Recipients come from two lists the screen toggles between: the RHU's
 * confirmed TB patients, and the Barangay Health Worker contacts the RHU
 * keeps itself ({@see Bhw}). A BHW alert is logged the same way, under its
 * own activity type so the history can say who it went to.
 */
class RhuSmsLogController extends Controller
{
    /** Activity type of an alert logged for a patient — shared with the provider portal. */
    public const PATIENT_ALERT = 'program.patient_notified';

    /** Activity type of an alert logged for a BHW contact. */
    public const BHW_ALERT = 'sms.bhw_notified';

    public function index(Request $request): Response
    {
        $user = $request->user();

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'history' => ['nullable', 'string', 'max:100'],
        ]);

        $search = trim($filters['search'] ?? '');
        $historySearch = trim($filters['history'] ?? '');

        $matches = fn (string $name, ?string $number) => $search === ''
            || str_contains(mb_strtolower($name), mb_strtolower($search))
            || str_contains((string) $number, $search);

        // The alert list is the RHU's confirmed TB cases — the patients the
        // reference screen is for — with a contact number to send to.
        $recipients = RhuScope::patientRecords($user)
            ->filter(fn (Patient $patient) => $patient->isDiagnosedWithTb()
                && filled($patient->contact_number)
                && $matches($patient->name, $patient->contact_number))
            ->values()
            ->map(fn (Patient $patient) => [
                'id' => $patient->id,
                'name' => $patient->name,
                'contact_number' => $patient->contact_number,
                'tb_diagnosis' => $patient->tbDiagnosisLabel(),
                'last_notified_label' => $patient->notified_at?->format('M j, Y – g:i A'),
            ]);

        // The same search box narrows whichever list is showing.
        $bhws = RhuScope::bhws($user)
            ->orderBy('name')
            ->get()
            ->filter(fn (Bhw $bhw) => $matches($bhw->name, $bhw->contact_number))
            ->values()
            ->map(fn (Bhw $bhw) => [
                'id' => $bhw->id,
                'name' => $bhw->name,
                'contact_number' => $bhw->contact_number,
                'address' => $bhw->address,
                'last_notified_label' => $bhw->notified_at?->format('M j, Y – g:i A'),
            ]);

        return Inertia::render('Rhu/SmsLog/Index', [
            'recipients' => $recipients,
            'bhws' => $bhws,
            'history' => $this->history($user, $historySearch),
            'filters' => ['search' => $search, 'history' => $historySearch],
            'municipality' => RhuScope::municipality($user),
        ]);
    }

    /**
     * Log an alert against the selected patients and/or BHW contacts.
     */
    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'patients' => ['required_without:bhws', 'array', 'max:200'],
            'patients.*' => ['integer'],
            'bhws' => ['required_without:patients', 'array', 'max:200'],
            'bhws.*' => ['integer'],
            'message' => ['required', 'string', 'max:480'],
        ], [
            'patients.required_without' => 'Select at least one recipient to notify.',
            'bhws.required_without' => 'Select at least one recipient to notify.',
        ]);

        $patientIds = array_values(array_unique($validated['patients'] ?? []));
        $bhwIds = array_values(array_unique($validated['bhws'] ?? []));

        $patients = Patient::query()
            ->whereIn('id', $patientIds)
            ->get()
            ->filter(fn (Patient $patient) => RhuScope::coversPatient($user, $patient));

        $bhws = RhuScope::bhws($user)->whereIn('id', $bhwIds)->get();

        // As on the Patient Tracker, an id outside the catchment fails the
        // whole request rather than being quietly skipped.
        abort_unless($patients->count() === count($patientIds), 404);
        abort_unless($bhws->count() === count($bhwIds), 404);

        $message = $validated['message'];

        DB::transaction(function () use ($patients, $bhws, $user, $message): void {
            foreach ($patients as $patient) {
                $patient->update(['notified_at' => now()]);

                ActivityLogger::record(
                    $user,
                    self::PATIENT_ALERT,
                    'Logged TB case alert',
                    "An alert was logged for {$patient->name} ({$patient->contact_number}).",
                    [
                        'patient_id' => $patient->id,
                        'recipient_name' => $patient->name,
                        'contact_number' => $patient->contact_number,
                        'message' => $message,
                    ],
                    $patient,
                );
            }

            foreach ($bhws as $bhw) {
                $bhw->update(['notified_at' => now()]);

                ActivityLogger::record(
                    $user,
                    self::BHW_ALERT,
                    'Logged BHW alert',
                    "An alert was logged for BHW {$bhw->name} ({$bhw->contact_number}).",
                    [
                        'bhw_id' => $bhw->id,
                        'recipient_name' => $bhw->name,
                        'contact_number' => $bhw->contact_number,
                        'message' => $message,
                    ],
                    $bhw,
                );
            }
        });

        $count = $patients->count() + $bhws->count();

        return back()->with('success', "{$count} alert(s) were logged for the selected recipients.");
    }

    /**
     * Add a BHW contact to the RHU's recipient list.
     */
    public function storeBhw(StoreBhwRequest $request): RedirectResponse
    {
        $user = $request->user();
        $municipality = RhuScope::municipality($user);

        // An account with no catchment has no list to add to.
        abort_if($municipality === null, 403);

        $bhw = Bhw::create([
            ...$request->validated(),
            'added_by' => $user->id,
            'municipality' => $municipality,
        ]);

        ActivityLogger::record(
            $user,
            'sms.bhw_added',
            'Added BHW contact',
            "{$bhw->name} ({$bhw->contact_number}) was added to the BHW contact list.",
            ['bhw_id' => $bhw->id],
            $bhw,
        );

        return back()->with('success', "{$bhw->name} has been added to the BHW contact list.");
    }

    /**
     * The message history: the alert activities logged by the RHU accounts
     * covering this municipality, for patients and BHW contacts alike.
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
            ->whereIn('type', [self::PATIENT_ALERT, self::BHW_ALERT])
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
                'recipient_type' => $activity->type === self::BHW_ALERT ? 'bhw' : 'patient',
                'recipient_name' => $activity->metadata['recipient_name'] ?? null,
                'contact_number' => $activity->metadata['contact_number'] ?? '—',
                'message' => $activity->metadata['message'] ?? $activity->description,
                'sent_at_label' => $activity->created_at->format('Y-m-d h:i A'),
            ])
            ->all();
    }
}
