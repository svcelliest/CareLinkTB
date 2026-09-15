<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProviderPatientRequest;
use App\Http\Requests\UpdateProviderPatientRequest;
use App\Models\Patient;
use App\Models\Program;
use App\Support\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ProviderController extends Controller
{
    /**
     * Ported UI ([[carelink_tb_provider_dashboard_pull]]) renders every
     * section behind its own `<Deferred>`, each with a shape-preserving
     * skeleton — so none of these queries need to run before the first
     * paint. All 5 share the default defer group, batched into one
     * follow-up request once the shell has rendered.
     */
    public function dashboard(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Provider/Dashboard', [
            'user' => $user,
            'stats' => Inertia::defer(function () {
                $patients = Patient::all();
                $presumptiveCount = $patients->filter(fn (Patient $patient) => $patient->isPresumptive())->count();

                return [
                    'total_programs' => Program::count(),
                    'active_programs' => Program::active()->count(),
                    'registered_patients' => $patients->count(),
                    'presumptive_count' => $presumptiveCount,
                ];
            }),
            'ongoing' => Inertia::defer(function () {
                $ongoing = Program::active()
                    ->with('location')
                    ->withCount('patients')
                    ->orderByDesc('scheduled_at')
                    ->first();

                return $ongoing ? $this->mapProgramSummary($ongoing) : null;
            }),
            'upcoming' => Inertia::defer(function () {
                $upcoming = Program::upcoming()
                    ->with('location')
                    ->withCount('patients')
                    ->orderBy('scheduled_at')
                    ->first();

                return $upcoming ? $this->mapProgramSummary($upcoming) : null;
            }),
            'recent_programs' => Inertia::defer(fn () => Program::with('location')
                ->withCount('patients')
                ->orderByDesc('scheduled_at')
                ->take(5)
                ->get()
                ->map(fn (Program $program) => $this->mapProgramSummary($program))),
            'recent_activities' => Inertia::defer(fn () => $user->activities()
                ->latest()
                ->take(5)
                ->get()
                ->map(fn ($activity) => [
                    'id' => $activity->id,
                    'title' => $activity->title,
                    'description' => $activity->description,
                    'tag' => $this->activityTag($activity->type),
                    'datetime_label' => $activity->created_at->timezone('Asia/Manila')->format('M j, Y – g:i A'),
                ])),
        ]);
    }

    /**
     * The short uppercase category shown next to each activity row —
     * derived from the logged `type` string, matching the mockup's
     * REGISTRATION / STATUS UPDATE labels for the two types it has a
     * real opinion about; anything else falls back to a generic label
     * built from the type itself rather than inventing a new category.
     */
    private function activityTag(string $type): string
    {
        return match ($type) {
            'program.patient_registered' => 'REGISTRATION',
            'program.patient_flagged', 'program.patient_cleared' => 'STATUS UPDATE',
            default => strtoupper(str_replace(['program.patient_', 'program.', '_'], ['', '', ' '], $type)),
        };
    }

    public function programs(): Response
    {
        $programs = Program::query()
            ->with('location')
            ->withCount('patients')
            ->orderBy('scheduled_at')
            ->get()
            ->map(fn (Program $program) => $this->mapProgramSummary($program));

        return Inertia::render('Provider/Programs/Index', [
            'programs' => $programs,
        ]);
    }

    public function showProgram(Program $program): Response
    {
        $program->loadMissing('location');

        if ($program->status === 'active') {
            return Inertia::render('Provider/Programs/Screening', [
                'program' => $this->mapProgramSummary($program),
                'patients' => $program->patients()
                    ->orderBy('created_at')
                    ->get()
                    ->map(fn (Patient $patient) => $this->mapPatientForScreening($patient)),
            ]);
        }

        $patients = $program->patients()->orderBy('created_at')->get();
        $presumptiveCount = $patients->filter(fn (Patient $patient) => $patient->isPresumptive())->count();

        return Inertia::render('Provider/Programs/Completed', [
            'program' => [
                'id' => $program->id,
                'name' => $program->name,
                'location' => $program->location?->name,
                'status' => $program->status,
                'date_label' => $program->scheduled_at->timezone('Asia/Manila')->format('M j, Y'),
                'time_label' => $program->scheduled_at->timezone('Asia/Manila')->format('g:i A'),
                'patient_counts' => [
                    'total' => $patients->count(),
                    'normal' => $patients->count() - $presumptiveCount,
                    'presumptive' => $presumptiveCount,
                ],
                'patients' => $patients->values()->map(fn (Patient $patient, int $index) => [
                    'id' => $patient->id,
                    'number' => $index + 1,
                    'name' => $patient->name,
                    'age' => $patient->age,
                    'sex' => $patient->sex,
                    'address' => $patient->address,
                    'contact' => $patient->contact_number,
                    'status' => $patient->isPresumptive() ? 'Presumptive' : 'Normal',
                ]),
            ],
        ]);
    }

    public function finishProgram(Request $request, Program $program): RedirectResponse
    {
        $program->update(['status' => 'completed']);

        ActivityLogger::record(
            $request->user(),
            'program.finished',
            'Finished program',
            "{$program->name} was marked completed.",
            ['program_id' => $program->id],
            $program,
        );

        return redirect()
            ->route('provider.programs.index')
            ->with('success', "Program {$program->name} was marked completed.");
    }

    public function storePatient(StoreProviderPatientRequest $request, Program $program): JsonResponse
    {
        $existing = $program->patients()
            ->where('name', $request->validated('name'))
            ->whereDate('date_of_birth', $request->validated('date_of_birth'))
            ->where('contact_number', $request->validated('contact_number'))
            ->first();

        if ($existing) {
            return response()->json([
                'program' => $this->mapProgramSummary($program),
                'saved_patient' => $this->mapPatientForScreening($existing),
            ]);
        }

        try {
            $patient = DB::transaction(function () use ($request, $program): Patient {
                $patient = $program->patients()->create([
                    'form_type' => 'provider_screening',
                    'name' => $request->validated('name'),
                    'date_of_birth' => $request->validated('date_of_birth'),
                    'sex' => $request->validated('sex'),
                    'address' => $request->validated('address'),
                    'contact_number' => $request->validated('contact_number'),
                    'created_by' => $request->user()->id,
                    'status' => 'completed',
                    'responses' => [
                        'presumptive' => $request->boolean('presumptive'),
                    ],
                ]);

                ActivityLogger::record(
                    $request->user(),
                    'program.patient_registered',
                    'Registered patient',
                    "{$patient->name} was registered under {$program->name}.",
                    ['program_id' => $program->id, 'patient_id' => $patient->id],
                    $patient,
                );

                return $patient;
            });
        } catch (\Throwable $exception) {
            Log::error('Patient failed to save', [
                'created_by' => $request->user()->id,
                'program_id' => $program->id,
                'exception' => $exception->getMessage(),
            ]);
            throw $exception;
        }

        return response()->json([
            'saved_patient' => $this->mapPatientForScreening($patient->fresh()),
        ]);
    }

    public function updatePatient(UpdateProviderPatientRequest $request, Program $program, Patient $patient): JsonResponse
    {
        try {
            DB::transaction(function () use ($request, $patient, $program): void {
                $wasPresumptive = $patient->isPresumptive();

                $patient->update([
                    'name' => $request->validated('name'),
                    'date_of_birth' => $request->validated('date_of_birth'),
                    'sex' => $request->validated('sex'),
                    'address' => $request->validated('address'),
                    'contact_number' => $request->validated('contact_number'),
                    'responses' => [
                        'presumptive' => $request->boolean('presumptive'),
                    ],
                ]);

                $isPresumptive = $patient->isPresumptive();

                if ($wasPresumptive !== $isPresumptive) {
                    ActivityLogger::record(
                        $request->user(),
                        $isPresumptive ? 'program.patient_flagged' : 'program.patient_cleared',
                        $isPresumptive ? 'Flagged patient as presumptive TB' : 'Cleared presumptive TB flag',
                        "{$patient->name} was marked as " . ($isPresumptive ? 'presumptive TB' : 'normal') . " under {$program->name}.",
                        ['program_id' => $program->id, 'patient_id' => $patient->id],
                        $patient,
                    );
                } else {
                    ActivityLogger::record(
                        $request->user(),
                        'program.patient_updated',
                        'Update patient',
                        "{$patient->name} was updated under {$program->name}.",
                        ['program_id' => $program->id, 'patient_id' => $patient->id],
                        $patient,
                    );
                }
            });
        } catch (\Throwable $exception) {
            Log::error('Update patient failed', [
                'updated_by' => $request->user()->id,
                'patient_id' => $patient->id,
                'program_id' => $program->id,
                'exception' => $exception->getMessage(),
            ]);
            throw $exception;
        }

        return response()->json([
            'saved_patient' => $this->mapPatientForScreening($patient->fresh()),
        ]);
    }

    public function destroyPatient(Request $request, Program $program, Patient $patient): JsonResponse
    {
        abort_unless($patient->program_id === $program->id, 404);
        $this->assertProgramActive($program);

        try {
            DB::transaction(function () use ($request, $patient, $program): void {
                ActivityLogger::record(
                    $request->user(),
                    'program.patient_removed',
                    'Removed patient',
                    "{$patient->name} was removed under {$program->name}.",
                    ['program_id' => $program->id, 'patient_id' => $patient->id],
                    $patient,
                );
                $patient->delete();
            });
        } catch (\Throwable $exception) {
            Log::error('Delete patient error', [
                'deleted_by' => $request->user()->id,
                'program_id' => $program->id,
                'patient_id' => $patient->id,
                'exception' => $exception->getMessage(),
            ]);
            throw $exception;
        }

        return response()->json(['deleted' => true]);
    }

    private function mapProgramSummary(Program $program): array
    {
        return [
            'id' => $program->id,
            'name' => $program->name,
            'location' => $program->location?->name,
            'status' => $program->status,
            'date_label' => $program->scheduled_at->timezone('Asia/Manila')->format('M j, Y'),
            'iso_date_label' => $program->scheduled_at->timezone('Asia/Manila')->format('Y-m-d'),
            'time_label' => $program->scheduled_at->timezone('Asia/Manila')->format('g:i A'),
            'patients_count' => $program->patients_count ?? null,
        ];
    }

    private function mapPatientForScreening(Patient $patient): array
    {
        return [
            'id' => $patient->id,
            'name' => $patient->name,
            'date_of_birth' => $patient->date_of_birth?->format('Y-m-d'),
            'age' => $patient->age,
            'sex' => $patient->sex === 'male' ? 'Male' : 'Female',
            'address' => $patient->address,
            'contact_number' => $patient->contact_number,
            'presumptive' => $patient->isPresumptive(),
            'status' => $patient->isPresumptive() ? 'Presumptive TB' : 'Normal',
        ];
    }

    private function assertProgramActive(Program $program): void
    {
        if ($program->status !== 'active') {
            throw ValidationException::withMessages([
                'program' => 'This screening session has already been finished.',
            ]);
        }
    }
}
