<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TreatmentMonitoringRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'treatment_enrollment_id',
        'month_number',
        'current_weight',
        'prescribed_dose',
        'clinical_status',
        'remarks',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'month_number' => 'integer',
            'current_weight' => 'decimal:1',
            'prescribed_dose' => 'integer',
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
}
