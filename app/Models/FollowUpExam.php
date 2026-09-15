<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FollowUpExam extends Model
{
    use HasFactory;

    /** WHO/IUATLD AFB smear grading scale. */
    public const RESULTS = ['negative', 'scanty', '1+', '2+', '3+'];

    protected $fillable = [
        'treatment_enrollment_id',
        'month_number',
        'collected',
        'collection_date',
        'result_date',
        'result',
        'afb_count',
        'remarks',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'month_number' => 'integer',
            'collected' => 'boolean',
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
