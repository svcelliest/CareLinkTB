<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProgramRequest;
use App\Models\DiagnosticAssessment;
use App\Support\ActivityLogger;
use Illuminate\Http\RedirectResponse;
use App\Models\Location;
use App\Models\Patient;
use App\Models\Program;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProgramController extends Controller
{
    /** GXpert owns the semi-quantitative/resistance flags; DSSM owns its own smear flag. */
    private const GXPERT_RESULT_FLAGS = ['result_rr', 'result_t', 'result_tt', 'result_ti'];

    private const DSSM_RESULT_FLAGS = ['result_dssm'];

    private const RESULT_FLAG_LABELS = [
        'result_dssm' => 'DSSM+',
        'result_rr' => 'RR+',
        'result_t' => 'T+',
        'result_tt' => 'TT+',
        'result_ti' => 'TI+',
    ];

    private const SPUTUM_REASON_LABELS = [
        'no_rhu_staff_or_bhw' => 'No RHU staff/BHW available',
        'patient_refused' => 'Patient refused',
        'patient_absent' => 'Patient absent',
        'no_supplies' => 'No supplies',
        'other' => 'Other',
    ];

    public function index(Request $request): Response
    {
        $coordinator = $request->user();

        abort_unless($coordinator instanceof User && $coordinator->role === 'icm', 403);

        $programs = $coordinator->createdPrograms()
            ->with('location')
            ->whereNull('archived_at')
            ->orderBy('scheduled_at')
            ->get()
            ->map(fn (Program $program) => [
                'id' => $program->id,
                'name' => $program->name,
                'location' => $program->location?->name,
                ...$this->scheduleLabels($program),
                'status' => $program->status,
            ]);

        return Inertia::render('Icm/Programs/Index', [
            'programs' => $programs,
            // The full province/municipality tree — Create Program's cascade
            // filters it client-side by `parent_id`. Only the municipality is
            // ever submitted as `location_id`.
            'locations' => Location::whereIn('level', ['province', 'municipality'])
                ->orderBy('name')
                ->get(['id', 'name', 'level', 'parent_id']),
            'scheduleWindow' => $this->scheduleWindow(),
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $coordinator = $request->user();

        abort_unless($coordinator instanceof User && $coordinator->role === 'icm', 403);

        $programs = $coordinator->createdPrograms()
            ->with('location')
            ->whereNull('archived_at')
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
                    $escapeForSpreadsheet($program->location?->name ?? ''),
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

        $patients = $program->patients()
            ->with(['sputumCollection', 'diagnosticAssessment', 'treatmentEnrollments'])
            ->orderBy('created_at')
            ->get();
        $presumptiveCount = $patients->filter(fn (Patient $patient) => $patient->isPresumptive())->count();

        return Inertia::render('Icm/Programs/Show', [
            'program' => [
                'id' => $program->id,
                'name' => $program->name,
                'location' => $program->location?->name,
                ...$this->scheduleLabels($program),
                'status' => $program->status,
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

                    'sputum_collected' => match ($patient->sputumCollection?->collected) {
                        true => '1',
                        false => '0',
                        default => '',
                    },
                    'not_collected_reason' => self::SPUTUM_REASON_LABELS[$patient->sputumCollection?->not_collected_reason ?? ''] ?? null,
                    'remarks' => $patient->sputumCollection?->remarks,

                    'gxpert_tested' => (bool) $patient->diagnosticAssessment?->tested_with_gxpert,
                    'gxpert_result' => $this->testResultLabel($patient->diagnosticAssessment, (bool) $patient->diagnosticAssessment?->tested_with_gxpert, self::GXPERT_RESULT_FLAGS),
                    'dssm_tested' => (bool) $patient->diagnosticAssessment?->tested_with_dssm,
                    'dssm_result' => $this->testResultLabel($patient->diagnosticAssessment, (bool) $patient->diagnosticAssessment?->tested_with_dssm, self::DSSM_RESULT_FLAGS),
                    'tb_diagnosis_label' => $patient->diagnosticAssessment?->diagnosisLabel(),
                    'diagnostic_remarks' => $patient->diagnosticAssessment?->remarks,
                    'treatment_status' => $this->treatmentStatusFor($patient),
                ]),
            ],
        ]);
    }

    /**
     * `scheduled_at` is stored as a correct UTC instant, but `config('app.timezone')`
     * is still UTC (a separate, already-flagged, not-yet-fixed issue — see
     * [[carelink_tb_rhu_rebuild_planned]]), so formatting it with the app's
     * default timezone would display the wrong wall-clock time to a PH-based
     * coordinator. Converting to Asia/Manila here only, rather than flipping
     * the global config, keeps this fix scoped to what this controller shows.
     */
    private function scheduleLabels(Program $program): array
    {
        $local = $program->scheduled_at->clone()->setTimezone('Asia/Manila');

        return [
            'date_label' => $local->format('M j, Y'),
            'time_label' => $local->format('g:i A'),
        ];
    }

    /**
     * @return array<string, string>
     */
    private function scheduleWindow(): array
    {
        return [
            'min' => Program::earliestTimeValue(),
            'max' => Program::latestTimeValue(),
            'label' => Program::earliestTimeLabel().' – '.Program::latestTimeLabel(),
        ];
    }

    /**
     * "RR+, T+" style — a test can flag more than one classification at once
     * (see the `diagnostic_assessments` migration), so this joins every flag
     * that's true rather than picking one.
     */
    private function testResultLabel(?DiagnosticAssessment $diagnostic, bool $tested, array $flags): string
    {
        if (! $tested || $diagnostic === null) {
            return '';
        }

        $positive = array_filter($flags, fn (string $flag) => (bool) $diagnostic->$flag);

        if ($positive !== []) {
            return implode(', ', array_map(fn (string $flag) => self::RESULT_FLAG_LABELS[$flag], $positive));
        }

        if ($diagnostic->result_negative) {
            return 'Negative';
        }

        return 'Tested — no result yet';
    }

    private function treatmentStatusFor(Patient $patient): array
    {
        $enrollment = $patient->currentTreatmentEnrollment();

        if ($enrollment === null) {
            return ['tone' => 'not_enrolled', 'label' => 'Not yet Enrolled'];
        }

        if ($enrollment->isOnTreatment()) {
            return ['tone' => 'enrolled', 'label' => 'On Treatment'];
        }

        return ['tone' => 'closed', 'label' => ucwords(str_replace('_', ' ', $enrollment->outcome))];
    }

    public function store(StoreProgramRequest $request): RedirectResponse
    {
        $coordinator = $request->user();

        abort_unless($coordinator instanceof User && $coordinator->role === 'icm', 403);

        try {
            $program = DB::transaction(function () use ($coordinator, $request): Program {
                $program = $coordinator->createdPrograms()->create([
                    ...$request->programAttributes(),
                    'status' => 'upcoming'
                ]);

                ActivityLogger::record(
                    $coordinator,
                    'program.created',
                    'Created program',
                    "{$program->name} was created for {$program->location?->name}.",
                    ['program_id' => $program->id],
                    $program,
                );
                return $program;
            });
        } catch (\Throwable $exception) {
            Log::error('Store program failed', [
                'created_by' => $coordinator->id,
                'payload' => $request->validated(),
                'exception' => $exception->getMessage(),
            ]);
            throw $exception;
        }

        return back()->with('success', "Program {$program->name} was created successfully.");
    }

    public function archive(Request $request, Program $program): RedirectResponse
    {
        $coordinator = $request->user();

        abort_unless(
            $coordinator instanceof User
                && $coordinator->role === 'icm'
                && $program->created_by === $coordinator->id,
            403,
        );
        abort_unless($program->status === 'completed' && $program->archived_at === null, 422);

        try {
            DB::transaction(function () use ($program, $coordinator): void {
                $program->forceFill(['archived_at' => now()])->save();

                ActivityLogger::record(
                    $coordinator,
                    'program.archived',
                    'Archived program',
                    "{$program->name} was archived.",
                    ['program_id' => $program->id],
                    $program,
                );
            });
        } catch (\Throwable $exception) {
            Log::error('Program archive failed', [
                'coordinator_id' => $coordinator->id,
                'program_id' => $program->id,
                'exception' => $exception->getMessage(),
            ]);
            throw $exception;
        }

        return back()->with('success', "{$program->name} was archived.");
    }
}
