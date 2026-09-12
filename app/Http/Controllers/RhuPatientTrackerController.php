<?php

namespace App\Http\Controllers;

use App\Http\Requests\Rhu\UpdateDiagnosticAssessmentRequest;
use App\Models\Patient;
use App\Models\Program;
use App\Support\ActivityLogger;
use App\Support\RhuScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Patient Tracker — the RHU's view of the patients screened into its
 * municipality, in the two tabs the reference shows.
 *
 * Both tabs are the RHU's to record — Sputum Collection and Diagnostic
 * Assessment alike. The ICM program screen shows the same columns and only
 * monitors them. {@see self::EDITABLE} lists the only keys this controller
 * will write; everything else in the document — the coordinator's own remark
 * among them — survives a save untouched.
 *
 * Both tabs read and write the one `patients.responses` document. No patient,
 * program or result row is duplicated for the RHU.
 */
class RhuPatientTrackerController extends Controller
{
    /**
     * The only `responses` keys an RHU may write from this screen.
     *
     * `tb_case_classification` is here because the Final Classification's TB
     * Diagnosis is the conclusion of the diagnostic assessment, and this tab
     * owns that assessment. The ICM program screen can still set it too.
     *
     * `sputum_collected` and `not_collected_reason` are the RHU's too: the
     * Sputum Collection tab is edited here and the ICM program screen only
     * views it. `remarks` stays the coordinator's note on the same record, so
     * RHU commentary goes to `diagnostic_remarks`, which nothing else writes.
     *
     * `enrolled_tb_treatment` is absent too: Treatment Status is derived from
     * the treatment register, never typed — see Patient::treatmentStatus().
     */
    private const EDITABLE = [
        'sputum_collected',
        'not_collected_reason',
        'tested_gene_xpert',
        'tested_dssm',
        'diagnostic_result',
        'positive_classification',
        'tb_case_classification',
        'diagnostic_remarks',
    ];

    public function index(Request $request): Response
    {
        $user = $request->user();

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'program' => ['nullable', 'integer'],
            'tab' => ['nullable', Rule::in(['sputum', 'diagnostic'])],
        ]);

        $search = trim($filters['search'] ?? '');
        $programId = $filters['program'] ?? null;

        // The program filter is itself authorized: an id outside the RHU's
        // catchment is dropped rather than applied, so it cannot be used to
        // pull another municipality's roster.
        $programs = RhuScope::programs($user)
            ->orderByDesc('scheduled_at')
            ->get(['id', 'name', 'scheduled_at']);

        if ($programId !== null && ! $programs->contains('id', $programId)) {
            $programId = null;
        }

        $patients = RhuScope::patientRecords($user, function (Builder $query) use ($search, $programId): void {
            // `treatmentCases` backs the derived Treatment Status column.
            $query->with(['program', 'treatmentCases'])->orderBy('name');

            if ($programId !== null) {
                $query->where('program_id', $programId);
            }

            if ($search !== '') {
                $escaped = addcslashes($search, '%_\\');
                $query->where(fn (Builder $scoped) => $scoped
                    ->where('name', 'like', '%'.$escaped.'%')
                    ->orWhere('patient_code', 'like', '%'.$escaped.'%')
                    ->orWhere('contact_number', 'like', '%'.$escaped.'%'));
            }
        });

        // Progress is counted over the whole catchment, not the filtered view,
        // so searching does not make the module look finished.
        $all = RhuScope::patientRecords($user);

        return Inertia::render('Rhu/PatientTracker/Index', [
            'patients' => $patients->values()->map(
                fn (Patient $patient, int $index) => $this->mapPatient($patient, $index + 1),
            ),
            'programs' => $programs->map(fn (Program $program) => [
                'id' => $program->id,
                'name' => $program->name,
                'date_label' => $program->scheduled_at->format('M j, Y'),
            ]),
            'filters' => [
                'search' => $search,
                'program' => $programId,
                'tab' => $filters['tab'] ?? 'sputum',
            ],
            // Sputum collection is counted per patient — a specimen is either
            // taken or not. Diagnostic assessment is counted per *test*, since
            // each patient needs both GXpert and DSSM: a patient with one of
            // the two is half done, which a per-patient count cannot express.
            'progress' => [
                'total' => $all->count(),
                'collected' => $all->filter(fn (Patient $p) => $p->sputumCollected())->count(),
                'tests_completed' => $all->sum(fn (Patient $p) => $p->diagnosticTestsCompleted()),
                'tests_total' => $all->count() * count(Patient::DIAGNOSTIC_TESTS),
            ],
            'municipality' => RhuScope::municipality($user),
        ]);
    }

    /**
     * Save the Diagnostic Assessment tab.
     *
     * The whole edited tab arrives in one request for the same reason the ICM
     * program screen submits one: Inertia cancels an in-flight visit when the
     * next starts, so a per-row endpoint would silently drop saves.
     *
     * Three things are enforced here rather than in React:
     *   · every id must be a patient inside this RHU's catchment;
     *   · only {@see self::EDITABLE} keys are merged, so ICM-owned sputum
     *     answers survive untouched even if they are posted;
     *   · the rest of the `responses` document is preserved by merging, never
     *     replacing.
     */
    public function updateDiagnostic(UpdateDiagnosticAssessmentRequest $request): RedirectResponse
    {
        $user = $request->user();
        $updates = collect($request->validated('patients'))->keyBy('id');

        $patients = Patient::query()
            ->whereIn('id', $updates->keys())
            ->get()
            ->filter(fn (Patient $patient) => RhuScope::coversPatient($user, $patient));

        // A submitted id that this RHU does not cover is a scope violation,
        // not a partial save: the whole request is refused.
        abort_unless($patients->count() === $updates->count(), 404);

        if ($patients->isEmpty()) {
            return back();
        }

        DB::transaction(function () use ($patients, $updates, $user): void {
            foreach ($patients as $patient) {
                $changes = Arr::only($updates->get($patient->id), self::EDITABLE);

                // A negative result has no positive sub-classification; clearing
                // it here stops a stale DSSM/RR/T/TT/TI tick surviving a change
                // of result and being read later as a positive case.
                if (($changes['diagnostic_result'] ?? null) !== 'positive') {
                    $changes['positive_classification'] = '';
                }

                $patient->update([
                    'responses' => [
                        ...($patient->responses ?? []),
                        ...$changes,
                    ],
                ]);
            }

            ActivityLogger::record(
                $user,
                'diagnostic.assessment_updated',
                'Updated diagnostic assessment',
                $patients->count().' patient record(s) were assessed in the Patient Tracker.',
                ['patient_ids' => $patients->pluck('id')->all()],
            );
        });

        return back()->with('success', 'The diagnostic assessment has been saved and updated.');
    }

    /**
     * @return array<string, mixed>
     */
    private function mapPatient(Patient $patient, int $number): array
    {
        return [
            'id' => $patient->id,
            'number' => $number,
            'name' => $patient->name,
            'patient_code' => $patient->patient_code,
            'age' => $patient->age,
            'sex' => $patient->sex,
            'contact_number' => $patient->contact_number,
            'address' => $patient->address,
            'program' => $patient->program?->name,
            'presumptive' => $patient->isPresumptive(),

            // Sputum collection — the RHU's to record; the ICM coordinator's
            // own remark beside it stays read-only.
            'sputum_collected' => $patient->response('sputum_collected'),
            'not_collected_reason' => $patient->response('not_collected_reason'),
            'icm_remarks' => $patient->response('remarks'),

            // RHU-owned — editable.
            'tested_gene_xpert' => $patient->response('tested_gene_xpert'),
            'tested_dssm' => $patient->response('tested_dssm'),
            'diagnostic_result' => $patient->response('diagnostic_result'),
            'positive_classification' => $patient->response('positive_classification'),
            'diagnostic_remarks' => $patient->response('diagnostic_remarks'),
            'tb_case_classification' => $patient->response('tb_case_classification'),

            // Final Classification → Treatment Status. Derived, never posted
            // back: it follows the treatment register.
            'treatment_status' => $patient->treatmentStatus(),

            // 0 / 50 / 100 for neither, one, or both required tests.
            'diagnostic_progress' => $patient->diagnosticProgressPercent(),
            'tb_diagnosis' => $patient->tbDiagnosisLabel(),
        ];
    }
}
