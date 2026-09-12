<?php

namespace App\Support;

use App\Models\TreatmentCase;
use App\Models\TreatmentDispensingRecord;
use Illuminate\Support\Carbon;

/**
 * The Medicine Tracker's figures, ported from the RHU reference's `pmSupply`.
 *
 * Coverage is the CURRENT strip only — leftovers from a previous week are never
 * carried into the balance, because the patient is dispensed a fresh strip at
 * each visit and the count that matters is what this one has left.
 *
 * The dose used is the one saved on that dispensing visit, not the case's
 * current dose: a later monthly dose change must not retroactively recalculate
 * medicine that has already been handed over.
 *
 * Nothing here writes. It reports a balance and a risk level so RHU personnel
 * can act — CareLink never changes a quantity or a prescription on its own.
 */
class MedicineSupply
{
    /**
     * @return array<string, mixed>|null  Null when nothing has been dispensed
     *                                    yet, which the screen shows as its
     *                                    "record the first dispensing" state.
     */
    public static function for(TreatmentCase $case): ?array
    {
        $last = $case->lastDispensing();

        return $last === null ? null : self::forRecord($case, $last);
    }

    /**
     * The tracker for one dispensing visit's strip.
     *
     * For the latest visit this is the live balance. For an earlier visit the
     * clock stops at the day the *next* strip was handed over: the balance
     * shown is what that week's strip had left when the patient returned, so
     * a past week keeps its own tracker rather than draining to zero as the
     * calendar moves on.
     *
     *  array<string, mixed>
     */
    public static function forRecord(TreatmentCase $case, TreatmentDispensingRecord $last): array
    {
        $records = $case->dispensingRecords->values();
        $index = $records->search(fn (TreatmentDispensingRecord $r) => $r->is($last));
        $following = $index !== false ? $records->get($index + 1) : null;

        // "Today" for this strip: the real today while it is the current strip,
        // otherwise the day it was superseded.
        $today = ($following?->dispensed_on ?? Carbon::now())->copy()->startOfDay();
        $isCurrent = $following === null;
        $dose = max(1, (int) $last->dose);
        $weeklySupply = max(0, min(
            TreatmentDispensingRecord::STRIP_TABLETS,
            (int) $last->weekly_supply,
        ));

        // Clamped both ways: a legacy or hand-edited record can never display
        // more than a full strip, nor a negative balance.
        $daysSince = max(0, $last->dispensed_on->startOfDay()->diffInDays($today, absolute: false));
        $remaining = max(0, min($weeklySupply, $weeklySupply - ($daysSince * $dose)));
        $daysLeft = intdiv($remaining, $dose);
        $coverage = intdiv($weeklySupply, $dose);
        $runOut = $last->dispensed_on->copy()->addDays($coverage);
        $next = $last->nextDispensingDate();
        $toPickup = $today->diffInDays($next->startOfDay(), absolute: false);
        $percent = $weeklySupply > 0
            ? max(0, min(100, (int) round($remaining / $weeklySupply * 100)))
            : 0;

        // Order matters: an overdue return outranks a low balance, because the
        // patient being absent is the more urgent fact.
        [$key, $label, $tone] = match (true) {
            $toPickup < 0 => ['overdue', 'Scheduled Dispensing Overdue', 'red'],
            $remaining === 0 => ['exhausted', 'Medicine Supply Exhausted', 'red'],
            $runOut->startOfDay()->lessThan($next->startOfDay()) => [
                'runout',
                'Expected to Run Out Before Next Dispensing',
                'red',
            ],
            $daysLeft <= TreatmentDispensingRecord::LOW_SUPPLY_DAYS => [
                'low',
                'Medicine Running Low',
                'yellow',
            ],
            default => ['enough', 'Enough Medicine', 'green'],
        };

        return [
            'last' => $last->dispensed_on->format('M j, Y'),
            'next' => $next->format('M j, Y'),
            'to_pickup' => $toPickup,
            'days_since' => $daysSince,
            'dose' => $dose,
            'weekly_supply' => $weeklySupply,
            'remaining' => $remaining,
            'days_left' => $daysLeft,
            'coverage' => $coverage,
            'run_out' => $runOut->format('M j, Y'),
            'percent' => $percent,
            'key' => $key,
            'label' => $label,
            'tone' => $tone,
            'pickup_cycle' => TreatmentDispensingRecord::PICKUP_CYCLE,
            'is_current' => $isCurrent,
            'as_of' => $today->format('M j, Y'),
            // The count the RHU actually made when the next strip was handed
            // over, if one was recorded — shown beside the estimate for a
            // past week.
            'counted' => $following?->remaining_tablets,
        ];
    }
}
