<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Patient extends Model
{
    use HasFactory;

    /** Intake recorded by a provider on the screening screen. */
    public const FORM_TYPE_PROVIDER_SCREENING = 'provider_screening';

    /**
     * `responses.tb_case_classification` values that mean a confirmed TB case.
     * Same list TbAnalytics uses, so the RHU's enrolment gate and the ICM's
     * analytics agree on what "diagnosed" means.
     */
    public const CONFIRMED_DIAGNOSES = ['bc_ds_tb', 'cd_ds_tb', 'rr_tb'];

    /** Labels for the stored TB diagnosis codes, as the ICM table shows them. */
    public const DIAGNOSIS_LABELS = [
        'bc_ds_tb' => 'DSTB BC',
        'cd_ds_tb' => 'DSTB CD',
        'rr_tb' => 'RRTB BC',
        'none' => 'No TB',
    ];

    /**
     * The GXpert/DSSM positive sub-classification codes, in the column order
     * the sputum register prints them: DSSM (4), RR (5), T (6), TT (7), TI (8).
     */
    public const POSITIVE_CLASSIFICATIONS = ['dssm', 'rr', 't', 'tt', 'ti'];

    /**
     * The two tests a diagnostic assessment requires — columns 3a and 3b of
     * the register. These are the `responses` keys the RHU's Diagnostic
     * Assessment tab ticks; no separate status field exists or is needed.
     */
    public const DIAGNOSTIC_TESTS = ['tested_gene_xpert', 'tested_dssm'];

    protected $fillable = [
        'program_id',
        'created_by',
        'form_type',
        'patient_code',
        'name',
        'age',
        'sex',
        'contact_number',
        'address',
        'status',
        'notified_at',
        'responses',
    ];

    protected function casts(): array
    {
        return [
            'age' => 'integer',
            'notified_at' => 'datetime',
            'responses' => 'array',
        ];
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Whether this record flags a presumptive TB case, derived from the
     * form-specific responses (sputum diagnostic result vs. contact-tracing
     * case identification) rather than a separately stored status, so it
     * can never drift out of sync with the underlying answers.
     */
    public function isPresumptive(): bool
    {
        if ($this->form_type === 'sputum_collection') {
            return ($this->responses['diagnostic_result'] ?? null) === 'positive';
        }

        // Provider screening has no clinical questionnaire behind it — the
        // provider flags the case directly from the screening table.
        if ($this->form_type === self::FORM_TYPE_PROVIDER_SCREENING) {
            return (bool) ($this->responses['presumptive'] ?? false);
        }

        return ($this->responses['tb_case_identified'] ?? null) === '1';
    }

    /** One value out of the `responses` document, always as a string. */
    public function response(string $key): string
    {
        return (string) ($this->responses[$key] ?? '');
    }

    /**
     * Whether sputum was collected during the ICM program. This is ICM-owned
     * data — the RHU portal reads it and never writes it.
     */
    public function sputumCollected(): bool
    {
        return $this->response('sputum_collected') === '1';
    }

    /**
     * Whether the RHU has recorded a diagnostic result for this patient yet.
     * Used to tell a presumptive case still awaiting confirmation from one
     * that has been resolved — not for tracker progress, which counts the
     * tests themselves; see {@see self::diagnosticTestsCompleted()}.
     */
    public function hasDiagnosticAssessment(): bool
    {
        return in_array($this->response('diagnostic_result'), ['positive', 'negative'], true);
    }

    /**
     * How many of the required diagnostic tests this patient has had: 0, 1 or
     * 2. Read straight off the GXpert (3a) and DSSM (3b) columns the RHU
     * records, so it can never drift from what the register shows.
     */
    public function diagnosticTestsCompleted(): int
    {
        return count(array_filter(
            self::DIAGNOSTIC_TESTS,
            fn (string $key): bool => $this->response($key) === '1',
        ));
    }

    /**
     * This patient's diagnostic assessment progress: 0%, 50% or 100% for
     * neither, one, or both tests completed.
     */
    public function diagnosticProgressPercent(): int
    {
        return (int) round(
            $this->diagnosticTestsCompleted() / count(self::DIAGNOSTIC_TESTS) * 100,
        );
    }

    /**
     * Whether this patient may be enrolled in TB treatment: either the RHU
     * recorded a positive GXpert/DSSM result, or the coordinator confirmed a
     * TB diagnosis on the program's Final Classification column.
     */
    public function isDiagnosedWithTb(): bool
    {
        return $this->response('diagnostic_result') === 'positive'
            || in_array($this->response('tb_case_classification'), self::CONFIRMED_DIAGNOSES, true);
    }

    /**
     * How the case is enrolled, in the NTP's wording. A bacteriologically
     * confirmed case is one the laboratory proved; a clinically diagnosed one
     * was decided on clinical grounds. The two get different follow-up
     * examination schedules, which is what this drives.
     */
    public function enrolledAsLabel(): string
    {
        $classification = $this->response('tb_case_classification');

        if ($classification === 'cd_ds_tb') {
            return 'Clinically Diagnosed';
        }

        if (in_array($classification, ['bc_ds_tb', 'rr_tb'], true)
            || $this->response('diagnostic_result') === 'positive') {
            return 'Bacteriologically Confirmed';
        }

        return 'Clinically Diagnosed';
    }

    /**
     * Treatment cases opened from this screening record. Normally none or one;
     * a second only exists if a closed case was followed by a re-treatment.
     */
    public function treatmentCases(): HasMany
    {
        return $this->hasMany(TreatmentCase::class);
    }

    /**
     * The case that decides this patient's treatment status: the open one if
     * there is one, otherwise the most recent closed one.
     */
    public function currentTreatmentCase(): ?TreatmentCase
    {
        return $this->treatmentCases->firstWhere('outcome', null)
            ?? $this->treatmentCases->sortByDesc('created_at')->first();
    }

    /**
     * The register's Treatment Status column.
     *
     * Derived from the treatment register rather than typed: a patient is "On
     * Treatment" exactly when an open TreatmentCase exists for them, which is
     * created by RHU enrolment in Patient Monitoring. Nobody sets this by
     * hand, so the column cannot disagree with the case it describes.
     *
     * A closed case reports its outcome instead — a cured patient is neither
     * awaiting enrolment nor still on treatment.
     *
     * @return array{label: string, tone: 'enrolled'|'not_enrolled'|'closed'}
     */
    public function treatmentStatus(): array
    {
        $case = $this->currentTreatmentCase();

        if ($case === null) {
            return ['label' => 'Not yet Enrolled', 'tone' => 'not_enrolled'];
        }

        return $case->isClosed()
            ? ['label' => $case->outcome, 'tone' => 'closed']
            : ['label' => 'On Treatment', 'tone' => 'enrolled'];
    }

    /**
     * The TB diagnosis to print on a treatment case. Prefers the coordinator's
     * confirmed classification and falls back to the positive sub-class the
     * RHU recorded, so a case opened before the ICM confirms still reads
     * sensibly.
     */
    public function tbDiagnosisLabel(): string
    {
        $classification = $this->response('tb_case_classification');

        if (isset(self::DIAGNOSIS_LABELS[$classification])) {
            return self::DIAGNOSIS_LABELS[$classification];
        }

        if ($this->response('diagnostic_result') === 'positive') {
            $positive = $this->response('positive_classification');

            return $positive === ''
                ? 'Positive'
                : 'Positive — '.strtoupper($positive);
        }

        return '—';
    }
}
