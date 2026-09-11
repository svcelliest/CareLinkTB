<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use App\Models\Program;
use App\Support\ActivityLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use App\Http\Requests\StoreProviderPatientRequest;
use App\Http\Requests\UpdateProviderPatientRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class ProviderController extends Controller
{
    public function dashboard(Request $request): Response
    {
        $user = $request->user();
        $patients = Patient::all();
        $presumptiveCount = $patients->filter(fn(Patient $patient) => $patient->isPresumptive())->count();

        $ongoing = Program::active()
            ->with('location')
            ->withCount('patients')
            ->orderByDesc('scheduled_at')
            ->first();

        $upcoming = Program::upcoming()
            ->with('location')
            ->withCount('patients')
            ->orderBy('scheduled_at')
            ->first();

        $recentPrograms = Program::with('location')
            ->withCount('patients')
            ->orderByDesc('scheduled_at')
            ->take(5)
            ->get();

        $recentActivities = $user->activities()->latest()->take(5)->get();

        $mapProgramSummary = fn(Program $program) => [
            'id' => $program->id,
            'name' => $program->name,
            'location' => $program->location?->name,
            'status' => $program->status,
            'date_label' => $program->scheduled_at->timezone('Asia/Manila')->format('M j, Y'),
            'time_label' => $program->scheduled_at->timezone('Asia/Manila')->format('g:i A'),
            'patients_count' => $program->patients_count,
        ];

        return Inertia::render('Provider/Dashboard', [
            'user' => $user,
            'stats' => [
                'total_programs' => Program::count(),
                'active_programs' => Program::active()->count(),
                'registered_patients' => $patients->count(),
                'presumptive_count' => $presumptiveCount,
            ],
            'ongoing' => $ongoing ? $mapProgramSummary($ongoing) : null,
            'upcoming' => $upcoming ? $mapProgramSummary($upcoming) : null,
            'recent_programs' => $recentPrograms->map($mapProgramSummary),
            'recent_activities' => $recentActivities->map(fn($activity) => [
                'id' => $activity->id,
                'title' => $activity->title,
                'description' => $activity->description,
                'time_label' => $activity->created_at->diffForHumans(),
            ]),
        ]);
    }

    private function mapProgramSummary(Program $program): array
    {
        return [
            'id' => $program->id,
            'name' => $program->name,
            'location' => $program->location?->name,
            'status' => $program->status,
            'date_label' => $program->scheduled_at->timezone('Asia/Manila')->format('M j, Y'),
            'time_label' => $program->scheduled_at->timezone('Asia/Manila')->format('g:i A'),
        ];
    }
    private function mapPatientForScreening(Patient $patient): array
    {
        return [
            'id' => $patient->id,
            'name' => $patient->name,
            'birthday' => $patient->date_of_birth?->format('Y-m-d'),
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
                'program' => 'This screening session has already been finished.'
            ]);
        }
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
                    'name' => $request->validated('name'),
                    'date_of_birth' => $request->validated('date_of_birth'),
                    'sex' => $request->validated('sex'),
                    'address' => $request->validated('address'),
                    'contact_number' => $request->validated('contact_number'),
                    'created_by' => $request->user()->id,
                    'presumptive' => false,
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
                $wasPresumptive = $patient->presumptive;

                $patient->update([
                    'name' => $request->validated('name'),
                    'date_of_birth' => $request->validated('date_of_birth'),
                    'sex' => $request->validated('sex'),
                    'address' => $request->validated('address'),
                    'contact_number' => $request->validated('contact_number'),
                    'presumptive' => $request->validated('presumptive'),
                ]);

                if ($wasPresumptive !== $patient->presumptive) {
                    ActivityLogger::record(
                        $request->user(),
                        $patient->presumptive ? 'program.patient_flagged' : 'program.patient_cleared',
                        $patient->presumptive ? 'Flagged patient as presumptive TB' : 'Cleared presumptive TB flag',
                        "{$patient->name} was marked as " . ($patient->presumptive ? 'presumptive TB' : 'normal') . " under {$program->name}.",
                        ['program_id' => $program->id, 'patient_id' => $patient->id],
                        $patient,
                    );
                } else {
                    ActivityLogger::record(
                        $request->user(),
                        'program.patient_updated',
                        'Update patient',
                        "{$patient->name} was registered under {$program->name}.",
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

        //try catch here bro
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


    public function programs(): Response
    {
        return Inertia::render('Provider/Programs/Index', [
            'programs' => fn() => Program::query()
                ->with('location')
                ->withCount('patients')
                ->orderBy('scheduled_at')
                ->get()
                ->map(fn(Program $program) => [
                    'id' => $program->id,
                    'name' => $program->name,
                    'location' => $program->location?->name,
                    'status' => $program->status,
                    'date_label' => $program->scheduled_at->timezone('Asia/Manila')->format('M j, Y'),
                    'time_label' => $program->scheduled_at->timezone('Asia/Manila')->format('g:i A'),
                    'patients_count' => $program->patients_count,
                ]),
        ]);
    }

    public function showProgram(Program $program): Response
    {
        if ($program->status === 'active') {
            return Inertia::render('Provider/Programs/Screening', [
                'program' => $this->mapProgramSummary($program),
                'patients' => $program->patients()
                    ->orderBy('created_at')
                    ->get()
                    ->map(fn(Patient $patient) => $this->mapPatientForScreening($patient))

            ]);
        }

        $patients = $program->patients()->orderBy('created_at')->get();
        $presumptiveCount = $patients->filter(fn(Patient $patient) => $patient->isPresumptive())->count();

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
                'patients' => $patients->values()->map(fn(Patient $patient, int $index) => [
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
}
