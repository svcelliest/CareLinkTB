<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TreatmentMonitoringRecord extends Model
{
    use HasFactory;

    public const CLINICAL_STATUSES = ['Improving', 'Stable', 'Worsening'];

    protected $fillable = [
        'treatment_enrollment_id',
        'month_number',
        'current_weight',
        'prescribed_dose',
        'clinical_status',
        'remarks',
        'recorded_by',
        'saved_at',
    ];

    protected function casts(): array
    {
        return [
            'month_number' => 'integer',
            'current_weight' => 'decimal:1',
            'prescribed_dose' => 'integer',
            'saved_at' => 'datetime',
        ];
    }

    public function treatmentEnrollment(): BelongsTo
    {
        return $this->belongsTo(TreatmentEnrollment::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function medicationDispensingRecords(): HasMany
    {
        return $this->hasMany(MedicationDispensingRecord::class, 'treatment_monitoring_id');
    }

    public function isSaved(): bool
    {
        return $this->saved_at !== null;
    }
}
