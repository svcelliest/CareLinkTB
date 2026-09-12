<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProviderPatientRequest;
use App\Models\Patient;
use App\Models\Program;
use App\Support\ActivityLogger;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class ProviderController extends Controller
{
    public function dashboard(Request $request): Response
    {
        $user = $request->user();

        // Every block below is deferred and runs its own query, so nothing is
        // fetched up here.
        $mapProgramSummary = fn (Program $program) => [
            'id' => $program->id,
            'name' => $program->name,
            'location' => $program->location,
            'status' => $program->status,
            'date_label' => $program->scheduled_at->format('M j, Y'),
            'iso_date_label' => $program->scheduled_at->format('Y-m-d'),
            'time_label' => $program->scheduled_at->format('g:i A'),
            'patients_count' => $program->patients_count,
        ];

        // Every content block is deferred so the shell paints immediately and
        // each one shows its own skeleton until its data lands. The queries
        // themselves are unchanged.
        return Inertia::render('Provider/Dashboard', [
            'user' => $user,
            'ongoing' => Inertia::defer(function () use ($mapProgramSummary) {
                $ongoing = Program::query()
                    ->whereCurrentStatus(Program::STATUS_ACTIVE)
                    ->withCount('patients')
                    ->orderByDesc('scheduled_at')
                    ->first();

                return $ongoing ? $mapProgramSummary($ongoing) : null;
            }),
            'upcoming' => Inertia::defer(function () use ($mapProgramSummary) {
                $upcoming = Program::query()
                    ->whereCurrentStatus(Program::STATUS_UPCOMING)
                    ->withCount('patients')
                    ->orderBy('scheduled_at')
                    ->first();

                return $upcoming ? $mapProgramSummary($upcoming) : null;
            }),
            'stats' => Inertia::defer(function () {
                $patients = Patient::all();

                return [
                    'total_programs' => Program::count(),
                    'active_programs' => Program::query()
                        ->whereCurrentStatus(Program::STATUS_ACTIVE)
                        ->count(),
                    'registered_patients' => $patients->count(),
                    'presumptive_count' => $patients
                        ->filter(fn (Patient $patient) => $patient->isPresumptive())
                        ->count(),
                ];
            }),
            'recent_programs' => Inertia::defer(fn () => Program::withCount('patients')
                ->orderByDesc('scheduled_at')
                ->take(2)
                ->get()
                ->map($mapProgramSummary)),
            'recent_activities' => Inertia::defer(fn () => $user->activities()
                ->latest()
                ->take(5)
                ->get()
                ->map(fn ($activity) => [
                    'id' => $activity->id,
                    'title' => $activity->title,
                    'description' => $activity->description,
                    'time_label' => $activity->created_at->diffForHumans(),
                    // The reference dashboard labels each row with a short tag
                    // and an absolute timestamp; both are presentation only,
                    // derived from the activity type the logger already records.
                    'tag' => self::activityTag($activity->type),
                    'datetime_label' => $activity->created_at->format('M j, Y – h:i A'),
                ])),
        ]);
    }

    public function programs(): Response
    {
        $programs = Program::query()
            ->withCount('patients')
            ->orderBy('scheduled_at')
            ->get()
            ->map(fn (Program $program) => [
                'id' => $program->id,
                'name' => $program->name,
                'location' => $program->location,
                'status' => $program->status,
                'date_label' => $program->scheduled_at->format('M j, Y'),
                'iso_date_label' => $program->scheduled_at->format('Y-m-d'),
                'time_label' => $program->scheduled_at->format('g:i A'),
                'patients_count' => $program->patients_count,
            ]);

        return Inertia::render('Provider/Programs/Index', [
            'programs' => $programs,
        ]);
    }

    public function showProgram(Program $program): Response
    {
        if ($program->status === 'active') {
            $screened = $program->patients()->orderBy('created_at')->get();

            return Inertia::render('Provider/Programs/Screening', [
                'program' => [
                    'id' => $program->id,
                    'name' => $program->name,
                    'location' => $program->location,
                    'status' => $program->status,
                    'date_label' => $program->scheduled_at->format('M j, Y'),
                    'iso_date_label' => $program->scheduled_at->format('Y-m-d'),
                    'time_label' => $program->scheduled_at->format('g:i A'),
                ],
                'patients' => $screened->values()->map($this->mapScreeningPatient(...)),
            ]);
        }

        // `patient_counts` and `patients` are siblings of `program`, not keys
        // inside it. The page waits on them by name through `<Deferred>`, so
        // nesting them left both waiting on props that never arrived and the
        // roster stuck on its skeleton.
        $roster = fn (): \Illuminate\Support\Collection => $program->patients()
            ->orderBy('created_at')
            ->get();

        return Inertia::render('Provider/Programs/Completed', [
            'program' => [
                'id' => $program->id,
                'name' => $program->name,
                'location' => $program->location,
                'status' => $program->status,
                'date_label' => $program->scheduled_at->format('M j, Y'),
                'iso_date_label' => $program->scheduled_at->format('Y-m-d'),
                'time_label' => $program->scheduled_at->format('g:i A'),
                'time24_label' => $program->scheduled_at->format('H:i'),
            ],
            'patient_counts' => Inertia::defer(function () use ($roster): array {
                $patients = $roster();
                $presumptiveCount = $patients
                    ->filter(fn (Patient $patient) => $patient->isPresumptive())
                    ->count();

                return [
                    'total' => $patients->count(),
                    'normal' => $patients->count() - $presumptiveCount,
                    'presumptive' => $presumptiveCount,
                ];
            }),
            'patients' => Inertia::defer(fn () => $roster()
                ->values()
                ->map(fn (Patient $patient, int $index) => [
                    'id' => $patient->id,
                    'number' => $index + 1,
                    'name' => $patient->name,
                    'age' => $patient->age,
                    'sex' => $patient->sex,
                    'address' => $patient->address,
                    'contact' => $patient->contact_number,
                    'status' => $patient->isPresumptive() ? 'Presumptive' : 'Normal',
                ])),
        ]);
    }

    /**
     * Short uppercase label shown beside a dashboard activity row. Display
     * only — it does not affect how activities are stored, queried, ordered,
     * or categorised anywhere else.
     */
    private static function activityTag(string $type): string
    {
        return match (true) {
            $type === 'program.patient_registered',
            $type === 'program.patient_removed' => 'REGISTRATION',
            $type === 'program.patient_status_updated' => 'STATUS UPDATE',
            $type === 'program.patient_notified' => 'SMS',
            str_starts_with($type, 'program.') => 'PROGRAM',
            str_starts_with($type, 'message.') => 'MESSAGE',
            str_starts_with($type, 'account.') => 'ACCOUNT',
            str_starts_with($type, 'security.') => 'SECURITY',
            str_starts_with($type, 'profile.') => 'PROFILE',
            default => 'ACTIVITY',
        };
    }

    /**
     * Shape one screening row for the provider table. `number` is the running
     * position in the program rather than the primary key, matching the
     * reference UI's zero-padded sequence.
     */
    private function mapScreeningPatient(Patient $patient, int $index): array
    {
        return [
            'id' => $patient->id,
            'number' => str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT),
            'name' => $patient->name,
            // The screening form edits a patient in place, so it needs the
            // birthday that age was derived from; it lives in `responses`.
            'birthday' => $patient->responses['birthday'] ?? null,
            'age' => $patient->age,
            'sex' => $patient->sex === 'female' ? 'F' : 'M',
            'address' => $patient->address,
            'contact_number' => $patient->contact_number,
            'status' => $patient->isPresumptive() ? 'Presumptive TB' : 'Normal',
            'notified' => $patient->notified_at !== null,
        ];
    }

    public function storePatient(StoreProviderPatientRequest $request, Program $program): RedirectResponse
    {
        $provider = $request->user();
        $birthday = CarbonImmutable::parse($request->validated('birthday'));

        $patient = DB::transaction(function () use ($provider, $request, $program, $birthday): Patient {
            $patient = $program->patients()->create([
                'created_by' => $provider->id,
                'form_type' => Patient::FORM_TYPE_PROVIDER_SCREENING,
                'name' => $request->validated('name'),
                'age' => $birthday->diffInYears(CarbonImmutable::now()),
                'sex' => $request->validated('sex'),
                'contact_number' => $request->validated('contact_number'),
                'address' => $request->validated('address'),
                'status' => 'completed',
                'responses' => [
                    'birthday' => $birthday->toDateString(),
                    'presumptive' => $request->boolean('presumptive'),
                ],
            ]);

            ActivityLogger::record(
                $provider,
                'program.patient_registered',
                'Registered patient',
                "{$patient->name} was registered under {$program->name}.",
                ['program_id' => $program->id, 'patient_id' => $patient->id],
                $patient,
            );

            return $patient;
        });

        return back()->with('success', "{$patient->name} was registered.");
    }

    /**
     * Edit a screening registration in place.
     *
     * Same intake rules as {@see self::storePatient()} — the screening form is
     * the one that wrote this row, so it validates through the same request.
     * `presumptive` is deliberately left alone: it is owned by
     * {@see self::togglePatientPresumptive()}, and re-writing `responses`
     * wholesale here would silently clear a flag the provider had set.
     */
    public function updatePatient(StoreProviderPatientRequest $request, Program $program, Patient $patient): RedirectResponse
    {
        abort_unless($patient->program_id === $program->id, 404);

        $birthday = CarbonImmutable::parse($request->validated('birthday'));

        $patient->update([
            'name' => $request->validated('name'),
            'age' => $birthday->diffInYears(CarbonImmutable::now()),
            'sex' => $request->validated('sex'),
            'contact_number' => $request->validated('contact_number'),
            'address' => $request->validated('address'),
            'responses' => [...$patient->responses, 'birthday' => $birthday->toDateString()],
        ]);

        ActivityLogger::record(
            $request->user(),
            'program.patient_updated',
            'Updated patient',
            "{$patient->name}'s registration under {$program->name} was updated.",
            ['program_id' => $program->id, 'patient_id' => $patient->id],
            $patient,
        );

        return back()->with('success', "{$patient->name} was updated.");
    }

    /**
     * Flip the presumptive flag from the screening table. The value lives in
     * `responses` so Patient::isPresumptive() stays the single source of truth.
     */
    public function togglePatientPresumptive(Request $request, Program $program, Patient $patient): RedirectResponse
    {
        abort_unless($patient->program_id === $program->id, 404);

        $presumptive = ! $patient->isPresumptive();

        $patient->update([
            'responses' => [...$patient->responses, 'presumptive' => $presumptive],
        ]);

        ActivityLogger::record(
            $request->user(),
            'program.patient_status_updated',
            $presumptive ? 'Marked patient presumptive' : 'Cleared presumptive flag',
            $presumptive
                ? "{$patient->name} was marked Presumptive TB."
                : "{$patient->name} was returned to Normal.",
            ['program_id' => $program->id, 'patient_id' => $patient->id],
            $patient,
        );

        return back();
    }

    /**
     * Record that the provider sent the patient a follow-up text. No SMS
     * gateway is configured, so this stores the fact and logs it rather than
     * pretending a message was delivered.
     */
    public function notifyPatient(Request $request, Program $program, Patient $patient): RedirectResponse
    {
        abort_unless($patient->program_id === $program->id, 404);

        if ($patient->notified_at === null) {
            $patient->update(['notified_at' => now()]);

            ActivityLogger::record(
                $request->user(),
                'program.patient_notified',
                'Notified patient',
                "A follow-up notice was logged for {$patient->name}.",
                ['program_id' => $program->id, 'patient_id' => $patient->id],
                $patient,
            );
        }

        return back();
    }

    public function destroyPatient(Request $request, Program $program, Patient $patient): RedirectResponse
    {
        abort_unless($patient->program_id === $program->id, 404);

        $name = $patient->name;
        $patient->delete();

        ActivityLogger::record(
            $request->user(),
            'program.patient_removed',
            'Removed patient',
            "{$name} was removed from {$program->name}.",
            ['program_id' => $program->id],
        );

        return back()->with('success', "{$name} was removed.");
    }

    /**
     * End a screening session.
     *
     * Whoever registered the session's screenings owns it, so no other
     * provider can close it out from under them. A session nobody has screened
     * into yet belongs to no one, and any provider may end it.
     */
    public function finishProgram(Request $request, Program $program): RedirectResponse
    {
        $screeningProviderId = $program->patients()
            ->where('form_type', Patient::FORM_TYPE_PROVIDER_SCREENING)
            ->value('created_by');

        abort_if(
            $screeningProviderId !== null && $screeningProviderId !== $request->user()->id,
            403,
        );

        $message = "Program {$program->name} was marked completed.";

        // Ending an already-ended session is a no-op rather than a second
        // entry in the activity log, so a double submit — or a reload of the
        // redirect — reads exactly like a single one.
        if ($program->isCompleted()) {
            return redirect()
                ->route('provider.programs.index')
                ->with('success', $message);
        }

        DB::transaction(function () use ($request, $program): void {
            $program->update(['status' => 'completed']);

            ActivityLogger::record(
                $request->user(),
                'program.finished',
                'Finished program',
                "{$program->name} was marked completed.",
                ['program_id' => $program->id],
                $program,
            );
        });

        return redirect()
            ->route('provider.programs.index')
            ->with('success', $message);
    }
}
