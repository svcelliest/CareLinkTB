<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class MedicationDispensingRecord extends Model
{
    use HasFactory;

    /** One weekly blister strip. Ported from the medjofinal reference. */
    public const STRIP_TABLETS = 28;

    /** Days between routine dispensing visits. */
    public const PICKUP_CYCLE = 7;

    /** Below this many treatment days left, the supply tracker warns. */
    public const LOW_SUPPLY_DAYS = 3;

    /** Dispensing doses the RHU may prescribe, in tablets per day. */
    public const DOSES = [2, 3, 4, 5];

    /** The side-effect checklist options, in the reference's order. */
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
     * The four side effects flagged for clinical assessment: they can
     * indicate hepatotoxicity, optic or eighth-nerve toxicity.
     */
    public const SERIOUS_SIDE_EFFECTS = [
        'Yellowing of eyes / skin',
        'Vision / color-vision changes',
        'Hearing problems',
        'Numbness / tingling of feet',
    ];

    /** The treatment-difficulty checklist options. */
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

    protected $fillable = [
        'treatment_monitoring_id',
        'month_number',
        'week_number',
        'is_initial',
        'dispensing_date',
        'next_dispensing_date',
        'dose',
        'weekly_supply',
        'remaining_tablets',
        'doses_taken',
        'doses_missed',
        'missed_reason',
        'missed_intervention',
        'side_effects',
        'side_effects_other',
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
            'month_number' => 'integer',
            'week_number' => 'integer',
            'is_initial' => 'boolean',
            'dispensing_date' => 'date',
            'next_dispensing_date' => 'date',
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

    public function treatmentMonitoringRecord(): BelongsTo
    {
        return $this->belongsTo(TreatmentMonitoringRecord::class, 'treatment_monitoring_id');
    }

    /**
     * The date the patient is next due, scheduled or assumed.
     */
    public function nextDispensingDate(): Carbon
    {
        return $this->next_dispensing_date
            ?? $this->dispensing_date->copy()->addDays(self::PICKUP_CYCLE);
    }

    /**
     * Whether any reported side effect is one flagged for clinical
     * assessment.
     */
    public function hasSeriousSideEffect(): bool
    {
        return count(array_intersect($this->side_effects ?? [], self::SERIOUS_SIDE_EFFECTS)) > 0;
    }
}
