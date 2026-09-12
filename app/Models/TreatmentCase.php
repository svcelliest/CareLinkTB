<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;

class TreatmentCase extends Model
{
    // A TB register entry is never destroyed. Soft-deleting keeps the row —
    // and with it the case number — permanently taken.
    use HasFactory, SoftDeletes;

    /**
     * The standard drug-susceptible regimen the monitoring timeline is built
     * around: two months intensive, four months continuation.
     */
    public const INTENSIVE_MONTHS = 2;

    public const TOTAL_MONTHS = 6;

    /** The phase abbreviations shown on the timeline. */
    public const REGIMEN_INTENSIVE = 'HRZE';

    public const REGIMEN_CONTINUATION = 'HR';

    /**
     * NTP registration groups. The one list, used by the enrolment form
     * request and by the React select, so the two cannot disagree.
     */
    public const REGISTRATION_GROUPS = [
        'New',
        'Relapse',
        'Treatment After Failure',
        'Treatment After Loss to Follow-up',
        'Transfer-in',
    ];

    public const REGIMENS = [
        'Standard Drug-Susceptible TB Regimen (2 HRZE / 4 HR)',
        'Drug-Resistant TB Regimen',
    ];

    /**
     * The allowed treatment outcomes. Closing a case is the only thing that
     * writes `outcome`, so this list is also the definition of "closed".
     *
     * The RHU records the outcome as a plain pass/fail result for the
     * treatment record — nothing finer. Cases closed under the earlier, longer
     * list keep whatever outcome they were closed with; this only governs
     * what may be chosen from now on.
     */
    public const OUTCOMES = [
        'Treatment Completed',
        'Treatment Failed',
    ];

    /** Weekly dispensing returns that make up one treatment month. */
    public const WEEKS_PER_MONTH = 4;

    protected $fillable = [
        'patient_id',
        'enrolled_by',
        'case_number',
        'municipality',
        'registration_date',
        'registration_group',
        'regimen',
        'treatment_start_date',
        'assigned_provider',
        'treatment_facility',
        'diagnostic_facility',
        'baseline_weight',
        'enrolled_as',
        'outcome',
        'outcome_date',
        'outcome_remarks',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'registration_date' => 'date',
            'treatment_start_date' => 'date',
            'baseline_weight' => 'float',
            'outcome_date' => 'date',
            'closed_at' => 'datetime',
        ];
    }

    /**
     * CareLink weight bands → indicated tablets/day. Advisory only: the band is
     * a guide and the RHU confirms the dose actually prescribed.
     */
    public static function bandDose(?float $weight): ?int
    {
        return match (true) {
            $weight === null => null,
            $weight <= 37 => 2,
            $weight <= 54 => 3,
            $weight <= 70 => 4,
            default => 5,
        };
    }

    public static function bandLabel(?float $weight): string
    {
        return match (true) {
            $weight === null => '—',
            $weight <= 37 => '25–37 kg',
            $weight <= 54 => '38–54 kg',
            $weight <= 70 => '55–70 kg',
            default => 'over 70 kg',
        };
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function enroller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'enrolled_by');
    }

    public function monitoringEntries(): HasMany
    {
        return $this->hasMany(TreatmentMonitoringEntry::class)->orderBy('month');
    }

    /** Every dispensing visit, oldest first — the order the maths assumes. */
    public function dispensingRecords(): HasMany
    {
        return $this->hasMany(TreatmentDispensingRecord::class)
            ->orderBy('dispensed_on')
            ->orderBy('id');
    }

    public function followups(): HasMany
    {
        return $this->hasMany(TreatmentFollowup::class)->orderBy('month');
    }

    public function contactTracing(): HasOne
    {
        return $this->hasOne(TreatmentContactTracing::class);
    }

    /** The weekly returns for one month; the enrolment release is excluded. */
    public function monthDispensing(int $month): Collection
    {
        return $this->dispensingRecords
            ->where('month', $month)
            ->where('is_initial', false)
            ->values();
    }

    public function lastDispensing(): ?TreatmentDispensingRecord
    {
        return $this->dispensingRecords->last();
    }

    /**
     * The dose currently in force: the one confirmed on the most recent saved
     * monthly review, falling back to the dose last dispensed at.
     */
    public function currentDose(): ?int
    {
        $confirmed = $this->monitoringEntries
            ->where('month', '<=', $this->currentMonth())
            ->whereNotNull('confirmed_dose')
            ->sortByDesc('month')
            ->first();

        return $confirmed?->confirmed_dose ?? $this->lastDispensing()?->dose;
    }

    /** The dose in force before `$month`, else the baseline weight's band. */
    public function doseBefore(int $month): ?int
    {
        $previous = $this->monitoringEntries
            ->where('month', '<', $month)
            ->whereNotNull('confirmed_dose')
            ->sortByDesc('month')
            ->first();

        return $previous?->confirmed_dose ?? self::bandDose($this->baseline_weight);
    }

    public function weightBefore(int $month): ?float
    {
        return $month <= 1
            ? null
            : $this->monitoringEntries->firstWhere('month', $month - 1)?->weight_kg;
    }

    /**
     * Scheduled treatment days between one visit and the one before it. The
     * first visit has no preceding interval, so it counts nothing.
     */
    public function scheduledDosesAt(int $index): int
    {
        $records = $this->dispensingRecords->values();

        if ($index <= 0 || ! $records->has($index)) {
            return 0;
        }

        return max(0, $records[$index - 1]->dispensed_on
            ->startOfDay()
            ->diffInDays($records[$index]->dispensed_on->startOfDay(), absolute: false));
    }

    /**
     * Tablets that should be left from the previous strip when the patient
     * returns: what was dispensed, less the doses they report taking.
     */
    public function expectedTabletsAt(int $index): ?int
    {
        $records = $this->dispensingRecords->values();

        if ($index <= 0 || ! $records->has($index)) {
            return null;
        }

        $previous = $records[$index - 1];
        $supply = max(0, min(TreatmentDispensingRecord::STRIP_TABLETS, $previous->weekly_supply));

        return max(0, min($supply, $supply - ($records[$index]->doses_taken * max(1, $previous->dose))));
    }

    /** Adherence across the whole case, as a percentage to one decimal. */
    public function adherencePercent(): float
    {
        $scheduled = 0;
        $taken = 0;

        foreach ($this->dispensingRecords->values() as $index => $record) {
            $due = $this->scheduledDosesAt($index);
            $scheduled += $due;
            $taken += min(max(0, $record->doses_taken), $due);
        }

        return $scheduled > 0 ? round($taken / $scheduled * 100, 1) : 0.0;
    }

    /** A case is closed once an outcome has been recorded against it. */
    public function isClosed(): bool
    {
        return $this->outcome !== null;
    }

    /**
     * Whether one treatment month has been fully worked: its Monthly Clinical
     * Review is saved and all four weekly dispensing returns are recorded.
     *
     * This — not the calendar — is what moves a case forward. A month the
     * RHU has not finished stays current however long it takes, and the next
     * one stays locked until it is finished; the treatment cannot be advanced
     * simply because 28 days have passed.
     */
    public function isMonthComplete(int $month): bool
    {
        $review = $this->monitoringEntries->firstWhere('month', $month);

        return ($review?->isSaved() ?? false)
            && $this->monthDispensing($month)->count() >= self::WEEKS_PER_MONTH;
    }

    /**
     * The treatment month the case is currently in: the first one that is not
     * yet complete, clamped to the regimen length. Derived from the record,
     * not the start date, so it advances only when the RHU completes a month.
     */
    public function currentMonth(): int
    {
        foreach (range(1, self::TOTAL_MONTHS) as $month) {
            if (! $this->isMonthComplete($month)) {
                return $month;
            }
        }

        return self::TOTAL_MONTHS;
    }

    /**
     * Whether every month of the regimen is complete — the point at which the
     * RHU may record the final outcome.
     */
    public function allMonthsComplete(): bool
    {
        return $this->isMonthComplete(self::TOTAL_MONTHS);
    }

    public static function phaseFor(int $month): string
    {
        return $month <= self::INTENSIVE_MONTHS ? 'Intensive Phase' : 'Continuation Phase';
    }

    public static function regimenFor(int $month): string
    {
        return $month <= self::INTENSIVE_MONTHS
            ? self::REGIMEN_INTENSIVE
            : self::REGIMEN_CONTINUATION;
    }

    /** Cases still on treatment. */
    public function scopeWhereOpen(Builder $query): Builder
    {
        return $query->whereNull('outcome');
    }

    /** Cases an RHU covering `$municipality` is allowed to see. */
    public function scopeWhereMunicipality(Builder $query, ?string $municipality): Builder
    {
        // A null municipality matches nothing rather than everything: an RHU
        // account with no municipality assigned has no catchment, so it must
        // not fall through to the whole province.
        return $municipality === null
            ? $query->whereRaw('1 = 0')
            : $query->where('municipality', $municipality);
    }

    /**
     * The next register number, in the `TB-YYYY-NNN` convention the TB
     * register already uses.
     *
     * Called inside the enrolment transaction with `$lock` set, so two
     * simultaneous enrolments cannot be handed the same number; the unique
     * index on `case_number` is the backstop.
     *
     * The scan runs over trashed rows too and takes the highest ever issued
     * rather than a count, so neither deleting a case nor closing one can
     * cause a number to be handed out a second time.
     *
     * `$lock` is false for the preview the enrolment form shows before submit:
     * that read happens outside a transaction, where `SELECT … FOR UPDATE`
     * would take a MySQL row lock for no benefit. The preview is advisory —
     * the number actually stored is taken again, locked, at save time.
     */
    public static function allocateCaseNumber(?int $year = null, bool $lock = false): string
    {
        $year ??= (int) now()->format('Y');
        $prefix = "TB-{$year}-";

        $highest = static::withTrashed()
            ->where('case_number', 'like', $prefix.'%')
            ->when($lock, fn ($query) => $query->lockForUpdate())
            ->pluck('case_number')
            ->map(static fn (string $number): int => (int) substr($number, strlen($prefix)))
            ->max() ?? 0;

        return $prefix.str_pad((string) ($highest + 1), 3, '0', STR_PAD_LEFT);
    }

}
