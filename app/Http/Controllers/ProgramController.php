<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProgramRequest;
use App\Http\Requests\UpdateProgramRequest;
use App\Models\Patient;
use App\Models\Program;
use App\Models\User;
use App\Support\ActivityLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProgramController extends Controller
{
    /**
     * Stored values behind the Final Classification "TB Diagnosis" column. The
     * labels live in the React table; the keys are the values the RHU forms
     * have always written into `responses.tb_case_classification`, so the two
     * screens stay in agreement.
     */
    private const TB_DIAGNOSES = ['bc_ds_tb', 'cd_ds_tb', 'rr_tb', 'none'];

    public function index(Request $request): Response
    {
        $coordinator = $request->user();

        abort_unless($coordinator instanceof User && $coordinator->role === 'icm', 403);

        $programs = $coordinator->createdPrograms()
            ->whereNotArchived()
            ->withCount('patients')
            ->orderBy('scheduled_at')
            ->get()
            ->map(fn (Program $program) => $this->mapProgram($program));

        return Inertia::render('Icm/Programs/Index', [
            'programs' => $programs,
            'scheduleWindow' => $this->scheduleWindow(),
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
                $escapeForSpreadsheet = static fn (string $value): string => preg_match(
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
        $this->authorizeProgram($request, $program);

        // `treatmentCases` backs the derived Treatment Status column, so it is
        // eager-loaded rather than queried once per row.
        $patients = $program->patients()->with('treatmentCases')->orderBy('created_at')->get();
        $presumptiveCount = $patients->filter(fn (Patient $patient) => $patient->isPresumptive())->count();

        return Inertia::render('Icm/Programs/Show', [
            'program' => [
                ...$this->mapProgram($program),
                'patient_counts' => [
                    'total' => $patients->count(),
                    'normal' => $patients->count() - $presumptiveCount,
                    'presumptive' => $presumptiveCount,
                ],
                'patients' => $patients->values()->map(
                    fn (Patient $patient, int $index) => $this->mapPatient($patient, $index + 1),
                ),
            ],
            // The program list only creates; editing an existing program is
            // done from here, so this page needs the same schedule window.
            'scheduleWindow' => $this->scheduleWindow(),
        ]);
    }

    public function store(StoreProgramRequest $request): RedirectResponse
    {
        $coordinator = $request->user();

        abort_unless($coordinator instanceof User && $coordinator->role === 'icm', 403);

        $program = DB::transaction(function () use ($coordinator, $request): Program {
            $program = $coordinator->createdPrograms()->create([
                ...$request->programAttributes(),
                'status' => 'upcoming',
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

    public function update(UpdateProgramRequest $request, Program $program): RedirectResponse
    {
        $this->authorizeProgram($request, $program);

        DB::transaction(function () use ($request, $program): void {
            $program->update($request->programAttributes());

            ActivityLogger::record(
                $request->user(),
                'program.updated',
                'Updated program',
                "{$program->name} is now scheduled for {$program->scheduled_at->format('M j, Y g:i A')}.",
                ['program_id' => $program->id],
                $program,
            );
        });

        return back()->with('success', "Program {$program->name} was updated successfully.");
    }

    /**
     * The coordinator's archived programs. Archiving files a completed program
     * away instead of deleting it, so this reads the same `programs` table the
     * program list does — the two differ only by `archived_at`.
     */
    public function archives(Request $request): Response
    {
        $coordinator = $request->user();

        abort_unless($coordinator instanceof User && $coordinator->role === 'icm', 403);

        $archives = $coordinator->createdPrograms()
            ->whereArchived()
            ->orderByDesc('archived_at')
            ->get()
            ->map(fn (Program $program) => [
                'id' => $program->id,
                'name' => $program->name,
                'date' => $program->scheduled_at->format('M j, Y'),
                'location' => $program->location,
                'archived_label' => $program->archived_at->format('M j, Y'),
            ]);

        return Inertia::render('Icm/Archives/Index', [
            'archives' => $archives,
        ]);
    }

    /**
     * File a completed program away. Only a completed program can be archived,
     * which is the one state the list offers the button in, and archiving
     * leaves `status` alone — a restore puts the program back as it was.
     */
    public function archive(Request $request, Program $program): RedirectResponse
    {
        $this->authorizeProgram($request, $program);

        abort_unless($program->isCompleted(), 403);

        $archived = $this->setArchivedAt($request, $program, now());

        return back()->with('success', $archived
            ? "Program {$program->name} was archived."
            : "Program {$program->name} was already archived.");
    }

    /**
     * Put an archived program back on the program list.
     */
    public function restore(Request $request, Program $program): RedirectResponse
    {
        $this->authorizeProgram($request, $program);

        $restored = $this->setArchivedAt($request, $program, null);

        return back()->with('success', $restored
            ? "Program {$program->name} was restored."
            : "Program {$program->name} is already on your program list.");
    }

    /**
     * Moves a program in or out of the archive, once. The state is re-read
     * inside the transaction so a double submit finds the move already made
     * and neither repeats it nor logs a second activity.
     */
    private function setArchivedAt(Request $request, Program $program, ?\DateTimeInterface $archivedAt): bool
    {
        return DB::transaction(function () use ($request, $program, $archivedAt): bool {
            $locked = Program::query()->lockForUpdate()->find($program->getKey());

            if ($locked === null || $locked->isArchived() === ($archivedAt !== null)) {
                return false;
            }

            $locked->update(['archived_at' => $archivedAt]);

            ActivityLogger::record(
                $request->user(),
                $archivedAt !== null ? 'program.archived' : 'program.restored',
                $archivedAt !== null ? 'Archived program' : 'Restored program',
                $archivedAt !== null
                    ? "{$locked->name} was moved to archives."
                    : "{$locked->name} was restored from archives.",
                ['program_id' => $locked->id],
                $locked,
            );

            return true;
        });
    }

    /**
     * Saves the Sputum Collection and Diagnostic Assessment columns of the
     * program monitor. Both tabs write into the same `patients.responses`
     * document the RHU forms already use, so a patient is never duplicated
     * across the three tabs — only different columns of the one record change.
     *
     * The whole edited tab arrives in one request: a per-row endpoint would
     * mean one Inertia visit per changed row, and Inertia cancels an in-flight
     * visit when the next one starts, which would silently drop saves.
     */
    public function updateRecords(Request $request, Program $program): RedirectResponse
    {
        $this->authorizeProgram($request, $program);

        $validated = $request->validate([
            'patients' => ['required', 'array', 'max:500'],
            'patients.*.id' => [
                'required',
                Rule::exists('patients', 'id')->where('program_id', $program->id),
            ],
            'patients.*.sputum_collected' => ['nullable', Rule::in(['', '0', '1'])],
            'patients.*.not_collected_reason' => ['nullable', 'string', 'max:255'],
            'patients.*.tb_case_classification' => ['nullable', Rule::in(['', ...self::TB_DIAGNOSES])],
            // `enrolled_tb_treatment` is deliberately absent: Treatment Status
            // is now derived from the treatment register (see
            // Patient::treatmentStatus()) instead of being typed here, so it is
            // neither validated nor written by this endpoint.
            'patients.*.remarks' => ['nullable', 'string', 'max:1000'],
        ]);

        $updates = collect($validated['patients'])->keyBy('id');

        $patients = $program->patients()
            ->whereIn('id', $updates->keys())
            ->get();

        DB::transaction(function () use ($patients, $updates): void {
            foreach ($patients as $patient) {
                $changes = Arr::except($updates->get($patient->id), 'id');

                $patient->update([
                    'responses' => [
                        ...($patient->responses ?? []),
                        ...$changes,
                    ],
                ]);
            }
        });

        ActivityLogger::record(
            $request->user(),
            'program.records_updated',
            'Updated program records',
            $patients->count().' patient record(s) were updated under '.$program->name.'.',
            ['program_id' => $program->id],
            $program,
        );

        return back()->with('success', 'Program records were updated.');
    }

    private function authorizeProgram(Request $request, Program $program): void
    {
        $coordinator = $request->user();

        abort_unless(
            $coordinator instanceof User
                && $coordinator->role === 'icm'
                && $program->created_by === $coordinator->id,
            403,
        );
    }

    /**
     * `scheduled_at` holds the wall clock the coordinator picked. Everything
     * the page displays, or re-loads into the edit form, is formatted here in
     * that same wall clock, so the browser never re-interprets an instant
     * against its own timezone and shifts the time out from under the user.
     *
     * @return array<string, mixed>
     */
    private function mapProgram(Program $program): array
    {
        return [
            'id' => $program->id,
            'name' => $program->name,
            'location' => $program->location,
            'status' => $program->status,
            'scheduled_at' => $program->scheduled_at->toIso8601String(),
            'scheduled_date' => $program->scheduled_at->format('Y-m-d'),
            'scheduled_time' => $program->scheduled_at->format('H:i'),
            'date_label' => $program->scheduled_at->format('M j, Y'),
            'time_label' => $program->scheduled_at->format('g:i A'),
            'patients_count' => $program->patients_count ?? $program->patients()->count(),
            'created_at' => $program->created_at->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function mapPatient(Patient $patient, int $number): array
    {
        $responses = $patient->responses ?? [];

        return [
            'id' => $patient->id,
            'number' => $number,
            'name' => $patient->name,
            'age' => $patient->age,
            'sex' => $patient->sex,
            'address' => $patient->address,
            'contact' => $patient->contact_number,
            'status' => $patient->isPresumptive() ? 'Presumptive' : 'Normal',

            // Sputum Collection tab.
            'sputum_collected' => (string) ($responses['sputum_collected'] ?? ''),
            'not_collected_reason' => (string) ($responses['not_collected_reason'] ?? ''),

            // Diagnostic Assessment tab. The test columns stay read-only here —
            // they are recorded by the RHU on the sputum-collection form.
            'tested_gene_xpert' => (string) ($responses['tested_gene_xpert'] ?? ''),
            'tested_dssm' => (string) ($responses['tested_dssm'] ?? ''),
            'positive_classification' => (string) ($responses['positive_classification'] ?? ''),
            'diagnostic_result' => (string) ($responses['diagnostic_result'] ?? ''),

            // Final Classification. Treatment Status is read from the
            // treatment register — it moves to "On Treatment" when the RHU
            // enrols the patient in Patient Monitoring — so it is sent as a
            // derived label and tone rather than an editable value.
            'tb_case_classification' => (string) ($responses['tb_case_classification'] ?? ''),
            'treatment_status' => $patient->treatmentStatus(),
            'remarks' => (string) ($responses['remarks'] ?? ''),
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
}
