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
            'stats' => [
                'suspicious_patients' => \App\Models\Patient::where('presumptive', true)->count(),
                'active_cases' => \App\Models\TreatmentEnrollment::where('outcome', "for_validation")->count(),
            ],
        ]);
    }

    public function programs(): Response
    {
        $patients = Patient::query()
            ->whereHas('program', fn ($query) => $query->where('location_id', auth()->user()->location_id))
            ->with('program')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (Patient $patient) => [
                'id' => $patient->id,
                'name' => $patient->name,
                'age' => $patient->age,
                'sex' => $patient->sex,
                'contact_number' => $patient->contact_number,
                'address' => $patient->address,
                'program_name' => $patient->program->name,
                'status' => $patient->isPresumptive() ? 'Presumptive' : 'Normal',
            ]);

        return Inertia::render('Rhu/Programs/Index', [
            'patients' => $patients,
        ]);
    }

    public function showProgram(Program $program): Response
    {
        abort_unless($program->location_id === auth()->user()->location_id, 403);

        $patients = $program->patients()
            ->with(['scdaRecord', 'contactTracingRecord'])
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn(Patient $patient) => [
                'id' => $patient->id,
                'name' => $patient->name,
                'date_of_birth' => $patient->date_of_birth?->format('M j, Y'),
                'age' => $patient->age,
                'sex' => $patient->sex,
                'contact_number' => $patient->contact_number,
                'address' => $patient->address,
                'presumptive' => $patient->presumptive,
                'scda_status' => $patient->scdaRecord ? 'Recorded' : 'Not yet recorded',
                'contact_tracing_status' => $patient->contactTracingRecord ? 'Recorded' : 'Not yet recorded',
                'updated_at_label' => $patient->updated_at->diffForHumans(),
            ]);

        return Inertia::render('Rhu/Programs/Show', [
            'program' => [
                'id' => $program->id,
                'name' => $program->name,
                'location' => $program->location?->name,
                'status' => $program->status,
                'date_label' => $program->scheduled_at->format('M j, Y'),
                'time_label' => $program->scheduled_at->format('g:i A'),
            ],
            'patients' => $patients,
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
