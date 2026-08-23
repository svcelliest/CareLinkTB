<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProgramRequest;
use App\Support\ActivityLogger;
use Illuminate\Http\RedirectResponse;
use App\Models\Patient;
use App\Models\Program;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProgramController extends Controller
{

    public function index(Request $request): Response
    {
        $coordinator = $request->user();

        abort_unless($coordinator instanceof User && $coordinator->role === 'icm', 403);

        $programs = $coordinator->createdPrograms()
            ->orderBy('scheduled_at')
            ->get()
            ->map(fn(Program $program) => [
                'id' => $program->id,
                'name' => $program->name,
                'location' => $program->location,
                'scheduled_at' => $program->scheduled_at->toIso8601String(),
                'status' => $program->status,
                'created_at' => $program->created_at->toIso8601String(),
            ]);

        return Inertia::render('Icm/Programs/Index', [
            'programs' => $programs,
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $coordinator = $request->user();

        abort_unless($coordinator instanceof User && $coordinator->role === 'icm', 403);

        $programs = $coordinator->createdPrograms()
            ->orderBy('scheduled_at')
            ->get();

        return response()->streamDownload(function () use ($programs): void {
            $file = fopen('php://output', 'w');

            fputcsv($file, [
                'Program Name',
                'Location',
                'Scheduled At',
                'Status',
                'Created At',
            ]);

            foreach ($programs as $program) {
                $escapeForSpreadsheet = static fn(string $value): string => preg_match(
                    '/^[=+\-@]/',
                    $value,
                ) ? "'{$value}" : $value;

                fputcsv($file, [
                    $escapeForSpreadsheet($program->name),
                    $escapeForSpreadsheet($program->location),
                    $program->scheduled_at->toIso8601String(),
                    $program->status,
                    $program->created_at->toIso8601String(),
                ]);
            }

            fclose($file);
        }, 'programs.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function show(Request $request, Program $program): Response
    {
        $coordinator = $request->user();

        abort_unless(
            $coordinator instanceof User
                && $coordinator->role === 'icm'
                && $program->created_by === $coordinator->id,
            403,
        );

        $patients = $program->patients()->orderBy('created_at')->get();
        $presumptiveCount = $patients->filter(fn (Patient $patient) => $patient->isPresumptive())->count();

        return Inertia::render('Icm/Programs/Show', [
            'program' => [
                'id' => $program->id,
                'name' => $program->name,
                'location' => $program->location,
                'scheduled_at' => $program->scheduled_at->toIso8601String(),
                'status' => $program->status,
                'created_at' => $program->created_at->toIso8601String(),
                'updated_at' => $program->updated_at->toIso8601String(),
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

    public function store(StoreProgramRequest $request): RedirectResponse
    {
        $coordinator = $request->user();

        abort_unless($coordinator instanceof User && $coordinator->role === 'icm', 403);

        $program = DB::transaction(function () use ($coordinator, $request): Program {
            $program = $coordinator->createdPrograms()->create([
                ...$request->validated(),
                'status' => 'upcoming'
            ]);


            ActivityLogger::record(
                $coordinator,
                'program.created',
                'Created program',
                "{$program->name} was created for {$program->location}.",
                ['program_id' => $program->id],
                $program,
            );
            return $program;
        });

        return back()->with('success', "Program {$program->name} was created successfully.");
    }
}
