<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TreatmentEnrollment extends Model
{
    use HasFactory;

    protected $attributes = [
        'outcome' => 'for_validation',
    ];

    protected $fillable = [
        'patient_id',
        'enrolled_by',
        'enrolled_at',
        'case_number',
        'diagnosing_facility',
        'treatment_facility',
        'registration_group',
        'regimen_classification',
        'outcome',
        'outcome_date',
        'outcome_remarks',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'enrolled_at' => 'date',
            'outcome_date' => 'date',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function enroller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'enrolled_by');
    }

    public function visits(): HasMany
    {
        return $this->hasMany(TreatmentVisit::class);
    }

    public function isClosed(): bool
    {
        return $this->outcome !== 'for_validation';
    }
}
