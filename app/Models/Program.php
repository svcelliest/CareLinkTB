<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Program extends Model
{
    use HasFactory;

    /**
     * Programs are field activities staffed by RHU and provider teams, so
     * they may only be scheduled inside this working window. `scheduled_at`
     * holds the wall-clock time the coordinator picked (see
     * StoreProgramRequest::programAttributes()), so these bounds compare
     * directly against the `H:i` value from the form — see
     * App\Rules\WithinProgramHours.
     */
    public const EARLIEST_MINUTES = 8 * 60;   // 08:00

    public const LATEST_MINUTES = 17 * 60;    // 17:00

    protected $fillable = [
        'created_by',
        'name',
        'location_id',
        'scheduled_at',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }

    /**
     * The stored column only ever holds "upcoming" or "completed" — "active"
     * vs "upcoming" is derived from scheduled_at instead of a stored value.
     */
    protected function status(): Attribute
    {
        return Attribute::get(function (string $value) {
            if ($value === 'completed') {
                return $value;
            }

            return $this->scheduled_at?->isFuture() ? 'upcoming' : 'active';
        });
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', '!=', 'completed')
            ->where('scheduled_at', '<=', now());
    }

    public function scopeUpcoming(Builder $query): Builder
    {
        return $query->where('status', '!=', 'completed')
            ->where('scheduled_at', '>', now());
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function patients(): HasMany
    {
        return $this->hasMany(Patient::class);
    }

    public static function earliestTimeLabel(): string
    {
        return self::minutesToLabel(self::EARLIEST_MINUTES);
    }

    public static function latestTimeLabel(): string
    {
        return self::minutesToLabel(self::LATEST_MINUTES);
    }

    /** The `HH:MM` bounds the browser's time input is clamped to. */
    public static function earliestTimeValue(): string
    {
        return sprintf('%02d:%02d', intdiv(self::EARLIEST_MINUTES, 60), self::EARLIEST_MINUTES % 60);
    }

    public static function latestTimeValue(): string
    {
        return sprintf('%02d:%02d', intdiv(self::LATEST_MINUTES, 60), self::LATEST_MINUTES % 60);
    }

    private static function minutesToLabel(int $minutes): string
    {
        $hour = intdiv($minutes, 60);
        $meridiem = $hour >= 12 ? 'PM' : 'AM';
        $displayHour = $hour % 12 === 0 ? 12 : $hour % 12;

        return sprintf('%d:%02d %s', $displayHour, $minutes % 60, $meridiem);
    }
}
