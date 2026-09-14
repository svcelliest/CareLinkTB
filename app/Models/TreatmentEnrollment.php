<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
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
}
