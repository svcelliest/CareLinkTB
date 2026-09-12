<?php

namespace App\Support;

use App\Models\TreatmentCase;
use App\Models\TreatmentDispensingRecord;
use App\Models\TreatmentFollowup;
use App\Models\User;
use App\Notifications\TreatmentAlert;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Raises the RHU's treatment alerts from the record as it stands.
 *
 * Two alerts, both for the RHU staff who cover the case's municipality:
 *
 *  - Low medication supply — the balance the Medicine Tracker already
 *    computes has fallen to {@see self::LOW_TABLETS} or fewer. Raised once
 *    per dispensed strip, so a patient who runs low is told about once, not
 *    on every page load until the next visit.
 *  - Follow-up diagnostic test approaching — a scheduled, still-uncollected
 *    test is due within {@see self::FOLLOWUP_WINDOW_DAYS}. Raised once per
 *    scheduled test.
 *
 * Neither sends anything to the patient. They tell the RHU, which then uses
 * the SMS log as it already does. The app has no scheduler, so the sweep runs
 * as the RHU opens the pages that show these cases; the once-per-event guard
 * is what keeps that from producing duplicates.
 */
class TreatmentAlerts
{
    public const LOW_TABLETS = 3;

    public const FOLLOWUP_WINDOW_DAYS = 7;

    /** Sweep every open case the RHU covers. */
    public static function sweepFor(User $user): void
    {
        if ($user->role !== 'rhu' || RhuScope::municipality($user) === null) {
            return;
        }

        RhuScope::treatmentCases($user)
            ->whereOpen()
            ->with(['patient', 'dispensingRecords', 'followups'])
            ->get()
            ->each(fn (TreatmentCase $case) => self::forCase($case));
    }

    /** Raise whichever alerts one case has earned. */
    public static function forCase(TreatmentCase $case): void
    {
        if ($case->isClosed()) {
            return;
        }

        $case->loadMissing(['patient', 'dispensingRecords', 'followups']);

        $recipients = self::recipients($case);

        if ($recipients->isEmpty()) {
            return;
        }

        self::lowSupply($case, $recipients);
        self::followupApproaching($case, $recipients);
    }

    /**
     * @param  Collection<int, User>  $recipients
     */
    private static function lowSupply(TreatmentCase $case, Collection $recipients): void
    {
        $supply = MedicineSupply::for($case);
        $last = $case->lastDispensing();

        if ($supply === null || $last === null || $supply['remaining'] > self::LOW_TABLETS) {
            return;
        }

        $remaining = $supply['remaining'];
        $patient = $case->patient?->name ?? $case->case_number;

        self::raise(
            $recipients,
            $case,
            'low_supply',
            ['dispensing_record_id' => $last->id],
            'Low Medication Supply',
            sprintf(
                '%s has %d tablet%s remaining. Arrange the next dispensing.',
                $patient,
                $remaining,
                $remaining === 1 ? '' : 's',
            ),
        );
    }

    /**
     * @param  Collection<int, User>  $recipients
     */
    private static function followupApproaching(TreatmentCase $case, Collection $recipients): void
    {
        $today = Carbon::now()->startOfDay();
        $patient = $case->patient?->name ?? $case->case_number;

        $case->followups
            ->filter(fn (TreatmentFollowup $followup) => ! $followup->collected)
            ->filter(function (TreatmentFollowup $followup) use ($today) {
                $days = $today->diffInDays($followup->due_date->startOfDay(), absolute: false);

                return $days >= 0 && $days <= self::FOLLOWUP_WINDOW_DAYS;
            })
            ->each(fn (TreatmentFollowup $followup) => self::raise(
                $recipients,
                $case,
                'followup_due',
                ['followup_id' => $followup->id],
                'Follow-up Diagnostic Test Approaching',
                sprintf(
                    '%s has a scheduled follow-up diagnostic test on %s (Month %d).',
                    $patient,
                    $followup->due_date->format('M j, Y'),
                    $followup->month,
                ),
            ));
    }

    /**
     * Notify each recipient once per event. The event is identified by the
     * meta key — the strip or the scheduled test — so the same fact never
     * produces a second notification for the same person.
     *
     * @param  Collection<int, User>  $recipients
     * @param  array<string, int>  $meta
     */
    private static function raise(
        Collection $recipients,
        TreatmentCase $case,
        string $kind,
        array $meta,
        string $title,
        string $message,
    ): void {
        [$metaKey, $metaValue] = [array_key_first($meta), reset($meta)];

        foreach ($recipients as $user) {
            $alreadyRaised = DatabaseNotification::query()
                ->where('notifiable_type', $user->getMorphClass())
                ->where('notifiable_id', $user->getKey())
                ->where('data->kind', $kind)
                ->where("data->{$metaKey}", $metaValue)
                ->exists();

            if ($alreadyRaised) {
                continue;
            }

            $user->notify(new TreatmentAlert($case, $kind, $title, $message, $meta));
        }
    }

    /**
     * The active RHU accounts covering this case's municipality.
     *
     * @return Collection<int, User>
     */
    private static function recipients(TreatmentCase $case): Collection
    {
        if ($case->municipality === null) {
            return collect();
        }

        return User::query()
            ->where('role', 'rhu')
            ->whereNull('disabled_at')
            ->where('municipality', $case->municipality)
            ->get();
    }
}
