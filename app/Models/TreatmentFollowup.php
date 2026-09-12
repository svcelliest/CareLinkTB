<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A scheduled follow-up sputum examination.
 *
 * Rows are created at enrolment — the schedule exists before any result does,
 * which is what the reference's Follow-up Examination Schedule table lists as
 * "Upcoming". Separate from the weekly medication dispensing, as the screen
 * says in so many words.
 */
class TreatmentFollowup extends Model
{
    use HasFactory;

    /** Smear results the reference offers, in its order. */
    public const SMEAR_RESULTS = ['Negative', 'Scanty (+n)', '1+', '2+', '3+'];

    /**
     * The months examined, by how the case was enrolled. A bacteriologically
     * confirmed case is checked three times; a clinically diagnosed one once.
     */
    public const SCHEDULE = [
        'Bacteriologically Confirmed' => [2, 5, 6],
        'default' => [2],
    ];

    protected $fillable = [
        'treatment_case_id',
        'recorded_by',
        'month',
        'due_date',
        'collected',
        'collection_date',
        'result_date',
        'smear_result',
        'afb_count',
        'remarks',
    ];

    protected function casts(): array
    {
        return [
            'month' => 'integer',
            'due_date' => 'date',
            'collected' => 'boolean',
            'collection_date' => 'date',
            'result_date' => 'date',
        ];
    }

    /**
     * The months to examine for a case enrolled as `$enrolledAs`.
     *
     * @return array<int, int>
     */
    public static function scheduleFor(?string $enrolledAs): array
    {
        return self::SCHEDULE[$enrolledAs] ?? self::SCHEDULE['default'];
    }

    public function treatmentCase(): BelongsTo
    {
        return $this->belongsTo(TreatmentCase::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /** Completed once a result is in; otherwise Due or Upcoming by date. */
    public function status(): string
    {
        if ($this->collected) {
            return 'Completed';
        }

        return $this->due_date->startOfDay()->lessThanOrEqualTo(now()->startOfDay())
            ? 'Due'
            : 'Upcoming';
    }

    /** A result other than Negative is flagged for RHU review. */
    public function isPositive(): bool
    {
        return $this->smear_result !== null && $this->smear_result !== 'Negative';
    }
}
