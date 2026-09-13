<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MedicationDispensingRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'treatment_monitoring_id',
        'month_number',
        'week_number',
        'dispensing_date',
        'next_dispensing_date',
        'remaining_tablets',
        'doses_taken',
        'side_effects',
        'side_effects_other',
    ];

    protected function casts(): array
    {
        return [
            'month_number' => 'integer',
            'week_number' => 'integer',
            'dispensing_date' => 'date',
            'next_dispensing_date' => 'date',
            'remaining_tablets' => 'integer',
            'doses_taken' => 'integer',
            'side_effects' => 'array',
        ];
    }

    public function treatmentMonitoringRecord(): BelongsTo
    {
        return $this->belongsTo(TreatmentMonitoringRecord::class, 'treatment_monitoring_id');
    }
}
