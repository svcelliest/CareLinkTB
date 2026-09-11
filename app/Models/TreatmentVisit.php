<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TreatmentVisit extends Model
{
    use HasFactory;

    protected $fillable = [
        'treatment_enrollment_id',
        'month_number',
        'visit_date',
        'treatment_facility',
        'monitoring_staff_name',
        'recorded_by',
        'weight_kg',
        'clinical_assessment',
        'symptoms',
        'clinical_remarks',
        'doses_expected',
        'doses_taken',
        'missed_doses',
        'adherence_status',
        'missed_dose_reason',
        'adherence_remarks',
        'treatment_interrupted',
        'interruption_date',
        'resumed_date',
        'interruption_reason',
        'interruption_followup',
        'has_adverse_reaction',
        'reaction_type',
        'reaction_severity',
        'reaction_action_taken',
        'reaction_remarks',
        'lab_test_type',
        'lab_test_date',
        'lab_result',
        'lab_remarks',
    ];

    protected function casts(): array
    {
        return [
            'visit_date' => 'date',
            'weight_kg' => 'decimal:1',
            'treatment_interrupted' => 'boolean',
            'interruption_date' => 'date',
            'resumed_date' => 'date',
            'has_adverse_reaction' => 'boolean',
            'lab_test_date' => 'date',
        ];
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(TreatmentEnrollment::class, 'treatment_enrollment_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function adherencePercent(): ?float
    {
        if (! $this->doses_expected) {
            return null;
        }

        return round(($this->doses_taken ?? 0) / $this->doses_expected * 100, 1);
    }
}
