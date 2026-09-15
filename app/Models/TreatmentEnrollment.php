<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Support\Carbon;

class TreatmentEnrollment extends Model
{
    use HasFactory;

    /**
     * Total treatment duration in months per DOH NTP regimen category.
     * `drug_resistant` (MDR/RR-TB) has no fixed duration yet — deferred.
     */
    private const REGIMEN_MONTH_COUNTS = [
        'category_1_new' => 6,
        'category_2_retreatment' => 8,
        'category_3_new_ep' => 12,
        'category_4_retreatment_ep' => 12,
    ];

    /**
     * Length of the intensive phase in months — 2 for the categories using
     * 2HRZE (1 and 3), 3 for the categories using 2HRZES/1HRZE (2 and 4,
     * the injection month plus the tablet month). Deliberately NOT a fixed
     * "first 2 months" constant like the medjofinal reference used — that
     * was only ever correct for category_1, and would mislabel a category_2/4
     * patient as "Continuation Phase" while still genuinely intensive.
     */
    private const REGIMEN_INTENSIVE_MONTHS = [
        'category_1_new' => 2,
        'category_2_retreatment' => 3,
        'category_3_new_ep' => 2,
        'category_4_retreatment_ep' => 3,
    ];

    public const REGISTRATION_GROUPS = [
        'new',
        'relapse',
        'treatment_after_failure',
        'treatment_after_loss_to_follow_up',
        'transfer_in',
    ];

    /** The 4 DOH NTP categories (see REGIMEN_MONTH_COUNTS) plus drug_resistant. */
    public const TREATMENT_REGIMENS = [
        'category_1_new',
        'category_2_retreatment',
        'category_3_new_ep',
        'category_4_retreatment_ep',
        'drug_resistant',
    ];

    public const OUTCOMES = [
        'cured',
        'treatment_completed',
        'treatment_failed',
        'died',
        'lost_to_follow_up',
        'not_evaluated',
    ];

    /**
     * A month needs this many non-initial dispensing visits (weeks 1-4;
     * week 0's enrollment-day release doesn't count) before it's complete.
     */
    private const REQUIRED_DISPENSING_VISITS_PER_MONTH = 4;

    /**
     * Follow-up exam schedule by diagnosis classification. Read live off
     * the patient's *current* diagnostic_assessments.tb_diagnosis every
     * time, never cached/stored — a clinically-diagnosed case can later be
     * reclassified as bacteriologically confirmed (WHO case-definition
     * guidance), so this must react to that automatically rather than
     * needing a migration/backfill when it happens.
     */
    private const FOLLOW_UP_EXAM_SCHEDULE = [
        'dstb_cd' => [2],
        'dstb_bc' => [2, 5, 6],
    ];

    /**
     * Days after treatment_start_date each schedule month falls due —
     * user-confirmed offsets, not calendar months (Month 2 = 30 days,
     * Month 5 = 30+90 = 120 days, Month 6 = 120+30 = 150 days).
     */
    private const FOLLOW_UP_EXAM_DUE_OFFSET_DAYS = [
        2 => 30,
        5 => 120,
        6 => 150,
    ];

    protected $fillable = [
        'patient_id',
        'registry_number',
        'treatment_facility',
        'diagnosing_facility',
        'registration_date',
        'treatment_start_date',
        'baseline_weight',
        'registration_group',
        'treatment_regimen',
        'assigned_provider_id',
        'created_by',
        'outcome',
        'outcome_date',
        'recorded_by',
        'outcome_remarks',
    ];

    protected function casts(): array
    {
        return [
            'registration_date' => 'date',
            'treatment_start_date' => 'date',
            'baseline_weight' => 'decimal:1',
            'outcome_date' => 'date',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function assignedProvider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_provider_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function treatmentMonitoringRecords(): HasMany
    {
        return $this->hasMany(TreatmentMonitoringRecord::class);
    }

    public function followUpExams(): HasMany
    {
        return $this->hasMany(FollowUpExam::class);
    }

    /**
     * Every dispensing visit across every month, in chronological order —
     * needed for the medicine supply tracker, which looks at the visit
     * immediately following a given one regardless of which month either
     * falls in.
     */
    public function medicationDispensingRecords(): HasManyThrough
    {
        return $this->hasManyThrough(
            MedicationDispensingRecord::class,
            TreatmentMonitoringRecord::class,
            'treatment_enrollment_id',
            'treatment_monitoring_id',
        )->orderBy('medication_dispensing_records.month_number')
            ->orderBy('medication_dispensing_records.week_number');
    }

    /**
     * @return int[]
     */
    public function followUpExamScheduleMonths(): array
    {
        $diagnosis = $this->patient?->diagnosticAssessment?->tb_diagnosis;

        if ($diagnosis === null) {
            return [];
        }

        return self::FOLLOW_UP_EXAM_SCHEDULE[$diagnosis] ?? [];
    }

    public function followUpExamDueDate(int $monthNumber): ?Carbon
    {
        $offset = self::FOLLOW_UP_EXAM_DUE_OFFSET_DAYS[$monthNumber] ?? null;

        if ($offset === null || $this->treatment_start_date === null) {
            return null;
        }

        return $this->treatment_start_date->copy()->addDays($offset);
    }

    /**
     * Reaching Month 6 does not by itself mark the patient as completed —
     * "on treatment" is just the absence of a finalized outcome.
     */
    public function isOnTreatment(): bool
    {
        return $this->outcome === null;
    }

    public function regimenMonthCount(): ?int
    {
        if ($this->treatment_regimen === null) {
            return null;
        }

        return self::REGIMEN_MONTH_COUNTS[$this->treatment_regimen] ?? null;
    }

    /**
     * "Intensive Phase" or "Continuation Phase" for a given month of this
     * enrollment's own regimen — see REGIMEN_INTENSIVE_MONTHS for why this
     * isn't a fixed month-2 cutoff.
     */
    public function phaseFor(int $month): string
    {
        return $month <= $this->intensivePhaseMonths() ? 'Intensive Phase' : 'Continuation Phase';
    }

    public function intensivePhaseMonths(): int
    {
        return self::REGIMEN_INTENSIVE_MONTHS[$this->treatment_regimen] ?? 2;
    }

    /**
     * (total doses actually taken) / (total doses expected so far) × 100.
     * "Expected" is weighted per month by that month's own prescribed_dose
     * and only counts weeks that actually have a dispensing row — a week
     * with no row yet doesn't count against the patient, it just isn't
     * part of the denominator yet.
     */
    public function overallAdherencePercentage(): float
    {
        $monitoringRecords = $this->treatmentMonitoringRecords()
            ->with('medicationDispensingRecords')
            ->get();

        $dosesTaken = 0;
        $dosesExpected = 0;

        foreach ($monitoringRecords as $record) {
            if ($record->prescribed_dose === null) {
                continue;
            }

            $weeksRecorded = $record->medicationDispensingRecords->count();
            $dosesExpected += $record->prescribed_dose * 7 * $weeksRecorded;
            $dosesTaken += (int) $record->medicationDispensingRecords->sum('doses_taken');
        }

        if ($dosesExpected === 0) {
            return 0.0;
        }

        return round(($dosesTaken / $dosesExpected) * 100, 1);
    }

    /**
     * A month is complete once its clinical review is saved AND all 4
     * weekly dispensing returns are recorded — not the calendar. A month
     * the RHU hasn't finished stays current however long it takes.
     */
    public function isMonthComplete(int $month): bool
    {
        $review = $this->treatmentMonitoringRecords()
            ->where('month_number', $month)
            ->first();

        if ($review === null || ! $review->isSaved()) {
            return false;
        }

        return $review->medicationDispensingRecords()
            ->where('is_initial', false)
            ->count() >= self::REQUIRED_DISPENSING_VISITS_PER_MONTH;
    }

    /**
     * The month this enrollment is currently in: the first one that isn't
     * yet complete, clamped to the regimen length. Null when the regimen
     * has no defined length yet (`drug_resistant`, still deferred).
     */
    public function currentMonth(): ?int
    {
        $totalMonths = $this->regimenMonthCount();

        if ($totalMonths === null) {
            return null;
        }

        for ($month = 1; $month <= $totalMonths; $month++) {
            if (! $this->isMonthComplete($month)) {
                return $month;
            }
        }

        return $totalMonths;
    }

    public function allMonthsComplete(): bool
    {
        $totalMonths = $this->regimenMonthCount();

        return $totalMonths !== null && $this->isMonthComplete($totalMonths);
    }

    /**
     * "TB-2026-001" style, ported from the medjofinal reference's
     * `allocateCaseNumber()` — used only by the Patient Monitoring list's
     * quick-enroll modal, which (unlike the main enrollment page) doesn't
     * collect `registry_number` from the RHU at all.
     */
    public static function allocateRegistryNumber(?int $year = null, bool $lock = false): string
    {
        $year ??= (int) now()->format('Y');
        $prefix = "TB-{$year}-";

        $highest = static::query()
            ->where('registry_number', 'like', $prefix.'%')
            ->when($lock, fn ($query) => $query->lockForUpdate())
            ->pluck('registry_number')
            ->map(static fn (string $number): int => (int) substr($number, strlen($prefix)))
            ->max() ?? 0;

        return $prefix.str_pad((string) ($highest + 1), 3, '0', STR_PAD_LEFT);
    }
}
