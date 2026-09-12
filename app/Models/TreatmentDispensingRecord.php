<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One weekly medication dispensing visit — the reference's "Record Medication
 * Dispensing" form.
 *
 * A visit both closes the previous week (tablets counted back, doses taken,
 * side effects, difficulties) and opens the next (a fresh strip, the dose it is
 * dispensed at, and the date the patient is due back).
 */
class TreatmentDispensingRecord extends Model
{
    use HasFactory;

    /** One weekly blister strip. */
    public const STRIP_TABLETS = 28;

    /** Days between routine dispensing visits. */
    public const PICKUP_CYCLE = 7;

    /** Below this many treatment days left, the tracker warns. */
    public const LOW_SUPPLY_DAYS = 3;

    /** The side effects the reference's checklist offers, in its order. */
    public const SIDE_EFFECTS = [
        'Nausea / vomiting',
        'Loss of appetite',
        'Abdominal pain',
        'Dizziness',
        'Joint pain',
        'Numbness / tingling of feet',
        'Yellowing of eyes / skin',
        'Vision / color-vision changes',
        'Hearing problems',
        'Other',
    ];

    /**
     * The four the reference flags for clinical assessment: they can indicate
     * hepatotoxicity, optic or eighth-nerve toxicity.
     */
    public const SERIOUS_SIDE_EFFECTS = [
        'Yellowing of eyes / skin',
        'Vision / color-vision changes',
        'Hearing problems',
        'Numbness / tingling of feet',
    ];

    /** The treatment difficulties the reference's checklist offers. */
    public const PROBLEMS = [
        'Difficulty taking medication',
        'Remembering medication',
        'Side effects',
        'Transportation',
        'Returning to RHU',
        'Work conflict',
        'School conflict',
        'Family / social',
        'Financial',
        'Other',
    ];

    public const SEVERITIES = ['Mild', 'Moderate', 'Severe'];

    /** Dispensing doses the RHU may prescribe, in tablets per day. */
    public const DOSES = [2, 3, 4, 5];

    protected $fillable = [
        'treatment_case_id',
        'recorded_by',
        'month',
        'week',
        'is_initial',
        'dispensed_on',
        'next_dispensing_on',
        'dose',
        'weekly_supply',
        'remaining_tablets',
        'doses_taken',
        'doses_missed',
        'missed_reason',
        'missed_intervention',
        'side_effects',
        'side_effect_severity',
        'side_effect_action',
        'side_effect_referred',
        'problems',
        'problem_action',
        'problem_followup_on',
        'remarks',
    ];

    protected function casts(): array
    {
        return [
            'month' => 'integer',
            'week' => 'integer',
            'is_initial' => 'boolean',
            'dispensed_on' => 'date',
            'next_dispensing_on' => 'date',
            'dose' => 'integer',
            'weekly_supply' => 'integer',
            'remaining_tablets' => 'integer',
            'doses_taken' => 'integer',
            'doses_missed' => 'integer',
            'side_effects' => 'array',
            'side_effect_referred' => 'boolean',
            'problems' => 'array',
            'problem_followup_on' => 'date',
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

    /** The date the patient is next due, scheduled or assumed. */
    public function nextDispensingDate(): \Illuminate\Support\Carbon
    {
        return $this->next_dispensing_on
            ?? $this->dispensed_on->copy()->addDays(self::PICKUP_CYCLE);
    }

    /**
     * Whether any of the reported side effects is one the reference flags for
     * clinical assessment.
     */
    public function hasSeriousSideEffect(): bool
    {
        return count(array_intersect($this->side_effects ?? [], self::SERIOUS_SIDE_EFFECTS)) > 0;
    }
}
