<?php

namespace App\Models;

use Carbon\CarbonImmutable;
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
     * The three states a program can be in. Only `completed` is ever written
     * to the `status` column — the other two are derived from the schedule by
     * the accessor below, so there is nothing to keep in sync.
     */
    public const STATUS_UPCOMING = 'upcoming';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_COMPLETED = 'completed';

    /**
     * The window a program may be scheduled in, as minutes past midnight.
     *
     * `scheduled_at` holds the wall-clock time the coordinator picked — it is
     * never shifted into another timezone on the way in or out — so these
     * bounds compare directly against the `H:i` value from the form.
     */
    public const EARLIEST_MINUTES = 8 * 60;   // 08:00

    public const LATEST_MINUTES = 17 * 60;    // 17:00

    protected $fillable = [
        'created_by',
        'name',
        'location',
        'scheduled_at',
        'status',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }

    /**
     * The one definition of a program's current status, used by every screen.
     *
     * The `status` column records one thing only: whether the provider has
     * ended the session. That stored `completed` is authoritative and can
     * never be undone by a later reschedule. Anything else means "not ended
     * yet", and the live status is then read off the calendar:
     *
     *   scheduled date <= today  → active   (including past dates: a session
     *                                        nobody ended is still open)
     *   scheduled date >  today  → upcoming
     *
     * Deriving it here rather than storing it is what removes the need for a
     * scheduler — `upcoming` becomes `active` the moment the date arrives,
     * on the next request that reads the program.
     *
     * SQL cannot see through an accessor, so queries that filter on status
     * must go through {@see scopeWhereCurrentStatus()}, which applies exactly
     * the same rule in the database.
     */
    protected function status(): Attribute
    {
        return Attribute::get(fn (?string $stored): string => match (true) {
            $stored === self::STATUS_COMPLETED => self::STATUS_COMPLETED,
            $this->hasReachedScheduledDate() => self::STATUS_ACTIVE,
            default => self::STATUS_UPCOMING,
        });
    }

    /**
     * Whether the provider has explicitly ended this program's session. Reads
     * the stored column rather than the accessor above, which is what makes it
     * safe to use as the completion guard.
     */
    public function isCompleted(): bool
    {
        return ($this->attributes['status'] ?? null) === self::STATUS_COMPLETED;
    }

    /**
     * Whether the coordinator has filed this program away. Archiving is not a
     * fourth status: an archived program is a completed one that has been
     * moved off the program list, and restoring it puts it back unchanged.
     */
    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    /** Programs still on the coordinator's list. */
    public function scopeWhereNotArchived(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }

    /** Programs that have been filed away. */
    public function scopeWhereArchived(Builder $query): Builder
    {
        return $query->whereNotNull('archived_at');
    }

    /**
     * The database-side twin of the status accessor. Comparison is on the
     * calendar date, not the time, so a program scheduled for 9:00 AM today is
     * already active at 8:00 AM.
     */
    public function scopeWhereCurrentStatus(Builder $query, string $status): Builder
    {
        $today = self::today()->toDateString();

        return $query->where(fn (Builder $scoped) => match ($status) {
            self::STATUS_COMPLETED => $scoped->where('status', self::STATUS_COMPLETED),
            self::STATUS_ACTIVE => $scoped->where('status', '!=', self::STATUS_COMPLETED)
                ->whereDate('scheduled_at', '<=', $today),
            self::STATUS_UPCOMING => $scoped->where('status', '!=', self::STATUS_COMPLETED)
                ->whereDate('scheduled_at', '>', $today),
            default => $scoped,
        });
    }

    /**
     * Whether the scheduled day has arrived (or has already gone by).
     */
    private function hasReachedScheduledDate(): bool
    {
        $scheduledAt = $this->scheduled_at;

        if (! $scheduledAt instanceof \DateTimeInterface) {
            return false;
        }

        return CarbonImmutable::instance($scheduledAt)
            ->startOfDay()
            ->lessThanOrEqualTo(self::today());
    }

    /**
     * Today in the application's configured timezone. `scheduled_at` is stored
     * and cast in that same zone, so both sides of the comparison agree.
     */
    private static function today(): CarbonImmutable
    {
        return CarbonImmutable::now(config('app.timezone'))->startOfDay();
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

    /**
     * Whether this provider may end the session. Programs have no provider
     * column — the only record of who worked a session is the screening intake
     * each provider registers — so a session belongs to the provider(s) who
     * registered patients into it, and one nobody has registered into yet is
     * unclaimed and open to whoever runs it.
     */
    public function isScreenedBy(User $provider): bool
    {
        $screeners = $this->patients()
            ->where('form_type', Patient::FORM_TYPE_PROVIDER_SCREENING)
            ->whereNotNull('created_by')
            ->distinct()
            ->pluck('created_by');

        return $screeners->isEmpty() || $screeners->contains($provider->id);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function patients(): HasMany
    {
        return $this->hasMany(Patient::class);
    }
}
