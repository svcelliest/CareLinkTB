<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TreatmentEnrollment extends Model
{
    use HasFactory;

    protected $fillable = [
        'patient_id',
        'case_number',
        'treatment_facility',
        'diagnosing_facility',
        'registration_date',
        'treatment_start_date',
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

    /**
     * Reaching Month 6 does not by itself mark the patient as completed —
     * "on treatment" is just the absence of a finalized outcome.
     */
    public function isOnTreatment(): bool
    {
        return $this->outcome === null;
    }
}
