<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One month's Monthly Clinical Review.
 *
 * Only what the reference's review form collects lives here — weight, the dose
 * the RHU confirms, clinical status, symptoms and remarks. Adherence and side
 * effects belong to the weekly {@see TreatmentDispensingRecord}, and follow-up
 * examinations to {@see TreatmentFollowup}, because both run on a different
 * cadence from the monthly review.
 */
class TreatmentMonitoringEntry extends Model
{
    use HasFactory;

    /** Clinical status options, in the reference's order. */
    public const CLINICAL_STATUSES = ['Improving', 'Stable', 'Worsening'];

    protected $fillable = [
        'treatment_case_id',
        'recorded_by',
        'reviewed_by_name',
        'month',
        'review_date',
        'weight_kg',
        'confirmed_dose',
        'clinical_status',
        'symptoms',
        'remarks',
        'saved_at',
    ];

    protected function casts(): array
    {
        return [
            'month' => 'integer',
            'review_date' => 'date',
            'weight_kg' => 'float',
            'confirmed_dose' => 'integer',
            'saved_at' => 'datetime',
        ];
    }

    public function treatmentCase(): BelongsTo
    {
        return $this->belongsTo(TreatmentCase::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /**
     * A saved review is locked on screen until "Edit Review" is pressed, which
     * is what stops a confirmed dose being changed by accident.
     */
    public function isSaved(): bool
    {
        return $this->saved_at !== null;
    }

    /**
     * The weight-band advisory: raised only when this month's weight falls in a
     * different band than the dose already in force. Advisory only — the RHU
     * confirms the dose, CareLink never changes it.
     *
     * @return array{band: int, weight: float, selected_dose: int, band_label: string}|null
     */
    public function doseReview(TreatmentCase $case): ?array
    {
        if ($this->weight_kg === null) {
            return null;
        }

        $band = TreatmentCase::bandDose($this->weight_kg);
        $inForce = $this->confirmed_dose ?? $case->doseBefore($this->month);

        return $band !== $inForce ? [
            'band' => $band,
            'weight' => $this->weight_kg,
            'selected_dose' => $inForce ?? $band,
            'band_label' => TreatmentCase::bandLabel($this->weight_kg),
        ] : null;
    }
}
