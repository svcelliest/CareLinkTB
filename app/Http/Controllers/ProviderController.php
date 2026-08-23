<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use App\Models\Program;
use App\Support\ActivityLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProviderController extends Controller
{
    public function dashboard(Request $request): Response
    {
        $user = $request->user();
        $patients = Patient::all();
        $presumptiveCount = $patients->filter(fn (Patient $patient) => $patient->isPresumptive())->count();

        $ongoing = Program::where('status', 'active')
            ->withCount('patients')
            ->orderByDesc('scheduled_at')
            ->first();

        $upcoming = Program::where('status', 'upcoming')
            ->withCount('patients')
            ->orderBy('scheduled_at')
            ->first();

        $recentPrograms = Program::withCount('patients')
            ->orderByDesc('scheduled_at')
            ->take(5)
            ->get();

        $recentActivities = $user->activities()->latest()->take(5)->get();

        $mapProgramSummary = fn (Program $program) => [
            'id' => $program->id,
            'name' => $program->name,
            'location' => $program->location,
            'status' => $program->status,
            'date_label' => $program->scheduled_at->format('M j, Y'),
            'time_label' => $program->scheduled_at->format('g:i A'),
            'patients_count' => $program->patients_count,
        ];

        return Inertia::render('Provider/Dashboard', [
            'user' => $user,
            'stats' => [
                'total_programs' => Program::count(),
                'active_programs' => Program::where('status', 'active')->count(),
                'registered_patients' => $patients->count(),
                'presumptive_count' => $presumptiveCount,
            ],
            'ongoing' => $ongoing ? $mapProgramSummary($ongoing) : null,
            'upcoming' => $upcoming ? $mapProgramSummary($upcoming) : null,
            'recent_programs' => $recentPrograms->map($mapProgramSummary),
            'recent_activities' => $recentActivities->map(fn ($activity) => [
                'id' => $activity->id,
                'title' => $activity->title,
                'description' => $activity->description,
                'time_label' => $activity->created_at->diffForHumans(),
            ]),
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
            return Inertia::render('Provider/Programs/Screening', [
                'program' => [
                    'id' => $program->id,
                    'name' => $program->name,
                    'location' => $program->location,
                    'status' => $program->status,
                    'date_label' => $program->scheduled_at->format('M j, Y'),
                    'time_label' => $program->scheduled_at->format('g:i A'),
                ],
            ]);
        }

        $patients = $program->patients()->orderBy('created_at')->get();
        $presumptiveCount = $patients->filter(fn (Patient $patient) => $patient->isPresumptive())->count();

        return Inertia::render('Provider/Programs/Completed', [
            'program' => [
                'id' => $program->id,
                'name' => $program->name,
                'location' => $program->location,
                'status' => $program->status,
                'date_label' => $program->scheduled_at->format('M j, Y'),
                'time_label' => $program->scheduled_at->format('g:i A'),
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
}
