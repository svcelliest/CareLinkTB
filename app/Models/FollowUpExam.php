<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FollowUpExam extends Model
{
    use HasFactory;

    protected $fillable = [
        'treatment_enrollment_id',
        'month_number',
        'collection_date',
        'result_date',
        'result',
        'remarks',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'month_number' => 'integer',
            'collection_date' => 'date',
            'result_date' => 'date',
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
}
