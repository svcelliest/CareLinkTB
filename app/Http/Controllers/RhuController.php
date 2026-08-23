<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePatientRecordRequest;
use App\Models\Patient;
use App\Models\Program;
use App\Support\ActivityLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class RhuController extends Controller
{
    public function dashboard(): Response
    {
        return Inertia::render('Rhu/Dashboard', [
            'user' => auth()->user(),
            'stats' => [],
        ]);
    }

    public function programs(): Response
    {
        $programs = Program::query()
            ->withCount([
                'patients as form_entries_count',
                'patients as completed_entries_count' => fn ($query) => $query->where('status', 'completed'),
                'patients as sputum_entries_count' => fn ($query) => $query->where('form_type', 'sputum_collection'),
                'patients as contact_tracing_entries_count' => fn ($query) => $query->where('form_type', 'contact_tracing'),
            ])
            ->orderBy('scheduled_at')
            ->get()
            ->map(fn (Program $program) => [
                'id' => $program->id,
                'name' => $program->name,
                'location' => $program->location,
                'status' => $program->status,
                'date_label' => $program->scheduled_at->format('M j, Y'),
                'time_label' => $program->scheduled_at->format('g:i A'),
                'form_entries_count' => $program->form_entries_count,
                'completed_entries_count' => $program->completed_entries_count,
                'sputum_entries_count' => $program->sputum_entries_count,
                'contact_tracing_entries_count' => $program->contact_tracing_entries_count,
            ]);

        return Inertia::render('Rhu/Programs/Index', [
            'programs' => $programs,
        ]);
    }

    public function showProgram(Program $program): Response
    {
        $entries = $program->patients()
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (Patient $patient) => [
                'id' => $patient->id,
                'form_type' => $patient->form_type,
                'patient_id' => $patient->patient_code,
                'patient_name' => $patient->name,
                'contact_number' => $patient->contact_number,
                'status' => $patient->status,
                'updated_at_label' => $patient->updated_at->diffForHumans(),
            ]);

        return Inertia::render('Rhu/Programs/Show', [
            'program' => [
                'id' => $program->id,
                'name' => $program->name,
                'location' => $program->location,
                'status' => $program->status,
                'date_label' => $program->scheduled_at->format('M j, Y'),
                'time_label' => $program->scheduled_at->format('g:i A'),
                'form_entries' => $entries,
            ],
        ]);
    }

    public function storeForm(StorePatientRecordRequest $request, Program $program): RedirectResponse
    {
        $rhu = $request->user();

        $patient = DB::transaction(function () use ($rhu, $request, $program): Patient {
            $patient = $program->patients()->create([
                'created_by' => $rhu->id,
                'form_type' => $request->validated('form_type'),
                'patient_code' => $request->validated('patient_id'),
                'name' => $request->validated('patient_name'),
                'age' => $request->validated('age'),
                'sex' => $request->validated('sex'),
                'contact_number' => $request->validated('contact_number'),
                'address' => $request->validated('address'),
                'status' => $request->validated('status'),
                'responses' => $request->validated('responses'),
            ]);

            ActivityLogger::record(
                $rhu,
                'program.patient_recorded',
                'Added patient record',
                "{$patient->name} was recorded under {$program->name}.",
                ['program_id' => $program->id, 'patient_id' => $patient->id],
                $patient,
            );

            return $patient;
        });

        return back()->with('success', "Record for {$patient->name} was saved.");
    }
}
