<?php

namespace App\Support;

use App\Models\MedicationDispensingRecord;
use App\Models\TreatmentEnrollment;
use App\Models\TreatmentMonitoringRecord;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Month/week UI state for the Treatment Monitoring screen — which months
 * are completed/current/locked, within the current month which weeks are
 * Completed/Overdue/Current/Upcoming, the Record/Edit dispensing form's
 * defaults, and the full dispensing history with its computed columns.
 *
 * Ported from the medjofinal reference's `TreatmentRecordPresenter`
 * (`months()`/`weeks()`/`history()`/`fullHistory()`/`review()` and
 * `TreatmentCase`'s `scheduledDosesAt()`/`expectedTabletsAt()`/
 * `currentDose()`/`phaseFor()`).
 */
class TreatmentScheduleState
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public static function months(TreatmentEnrollment $enrollment): array
    {
        $totalMonths = $enrollment->regimenMonthCount();

        if ($totalMonths === null) {
            return [];
        }

        $currentMonth = $enrollment->currentMonth();
        $allRecords = $enrollment->medicationDispensingRecords()->get();
        $last = $allRecords->last();
        $reviews = $enrollment->treatmentMonitoringRecords()->get()->keyBy('month_number');

        // mapWithKeys, not map: the frontend indexes this object by month
        // number (`months[month]`) — map() would keep the 0-based
        // collection keys instead of re-keying to 1..totalMonths, silently
        // shifting every month's data by one.
        return collect(range(1, $totalMonths))
            ->mapWithKeys(function (int $month) use ($enrollment, $currentMonth, $allRecords, $last, $reviews) {
                $monthRecords = $allRecords
                    ->where('month_number', $month)
                    ->where('is_initial', false)
                    ->values();

                return [$month => [
                    'month' => $month,
                    'is_current' => $month === $currentMonth,
                    // Completed once the review is saved and all 4 weeks
                    // are in; current while it's the one being worked;
                    // locked until the month before it is finished.
                    'state' => match (true) {
                        $enrollment->isMonthComplete($month) => 'completed',
                        $month === $currentMonth => 'current',
                        default => 'locked',
                    },
                    'weeks' => self::weeks($enrollment, $month, $monthRecords, $currentMonth, $last),
                    'dispensing_form' => self::dispensingForm($reviews->get($month), $last),
                    'history' => self::history($monthRecords, $allRecords),
                    'review' => self::review($enrollment, $reviews->get($month), $month, $last),
                    'summary' => ['phase' => $enrollment->phaseFor($month)],
                ]];
            })
            ->all();
    }

    /**
     * The Record/Edit Dispensing form's defaults — the dose comes from the
     * month's confirmed review, falling back to the dose last dispensed at,
     * never from the form itself, so a later dose change can't retroactively
     * alter medicine already handed over.
     */
    public static function dispensingForm(?TreatmentMonitoringRecord $review, ?MedicationDispensingRecord $last): array
    {
        $dose = $review?->prescribed_dose ?? $last?->dose ?? MedicationDispensingRecord::DOSES[0];
        $next = $last?->nextDispensingDate();

        return [
            'needs_review' => $review === null || ! $review->isSaved(),
            'dose' => $dose,
            'previous_date' => $last?->dispensing_date?->toDateString(),
            'previous_supply' => $last?->weekly_supply ?? 0,
            'previous_dose' => $last?->dose ?? 0,
            'previous_label' => $last?->dispensing_date?->format('M j, Y'),
            'suggested_date' => ($next ?? Carbon::now())->toDateString(),
        ];
    }

    /**
     * The Monthly Clinical Review form's fields. `shown_dose` is what the
     * dose select opens on: the dose confirmed this month if there is one,
     * otherwise the dose already in force — so a month not yet reviewed
     * still shows the patient's actual prescription, not a blank/lowest
     * default. `reviewed_by_name` has no column on this schema (declared
     * unused/vestigial even in the reference, per Anton's call earlier this
     * session) — always null here, the frontend falls back to the signed-in
     * user's own name.
     */
    public static function review(
        TreatmentEnrollment $enrollment,
        ?TreatmentMonitoringRecord $review,
        int $month,
        ?MedicationDispensingRecord $last,
    ): array {
        $previousReview = $month > 1
            ? $enrollment->treatmentMonitoringRecords()->where('month_number', $month - 1)->first()
            : null;

        return [
            'review_date' => $review?->created_at?->toDateString(),
            'review_date_label' => $review?->created_at?->format('M j, Y'),
            'weight_kg' => $review?->current_weight,
            'confirmed_dose' => $review?->prescribed_dose,
            'shown_dose' => $review?->prescribed_dose ?? $previousReview?->prescribed_dose ?? $last?->dose,
            'clinical_status' => $review?->clinical_status ?? '',
            'remarks' => $review?->remarks ?? '',
            'reviewed_by_name' => null,
            'previous_weight' => $previousReview?->current_weight,
        ];
    }

    /**
     * The permanent Medication Dispensing History — every weekly return
     * across the whole treatment (not scoped to one month), oldest first.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function fullHistory(TreatmentEnrollment $enrollment): array
    {
        $allRecords = $enrollment->medicationDispensingRecords()->get();
        $records = $allRecords->where('is_initial', false)->values();

        return self::history($records, $allRecords);
    }

    /**
     * @param  Collection<int, MedicationDispensingRecord>  $records
     * @param  Collection<int, MedicationDispensingRecord>  $allRecords
     * @return array<int, array<string, mixed>>
     */
    private static function history(Collection $records, Collection $allRecords): array
    {
        return $records->map(function (MedicationDispensingRecord $record) use ($allRecords) {
            $index = $allRecords->search(fn (MedicationDispensingRecord $r) => $r->is($record));
            $previous = $index !== false && $index > 0 ? $allRecords->get($index - 1) : null;

            // Scheduled treatment days between this visit and the one
            // before it — the first visit has no preceding interval.
            $scheduled = $previous !== null
                ? max(0, $previous->dispensing_date->startOfDay()
                    ->diffInDays($record->dispensing_date->startOfDay(), absolute: false))
                : 0;

            // Tablets that should be left from the previous strip when the
            // patient returns: what was dispensed, less doses taken.
            $expected = $previous !== null
                ? max(0, min(
                    max(0, min(MedicationDispensingRecord::STRIP_TABLETS, $previous->weekly_supply ?? 0)),
                    ($previous->weekly_supply ?? 0) - ((int) $record->doses_taken * max(1, $previous->dose ?? 1)),
                ))
                : null;

            return [
                'id' => $record->id,
                'month' => $record->month_number,
                'week' => $record->week_number,
                'date_label' => $record->dispensing_date->format('M j'),
                'date_full_label' => $record->dispensing_date->format('M j, Y'),
                'dose' => $record->dose,
                'weekly_supply' => $record->weekly_supply,
                'expected' => $expected,
                'actual' => $record->remaining_tablets,
                'mismatch' => $expected !== null
                    && $record->remaining_tablets !== null
                    && $record->remaining_tablets !== $expected,
                'next_label' => $record->nextDispensingDate()->format('M j'),
                'adherence' => $scheduled > 0
                    ? round($record->doses_taken / $scheduled * 100, 1)
                    : null,
                'missed' => $record->doses_missed,

                // The editable values, so "Edit" can reopen the form on
                // this record without a second round trip.
                'dispensed_on' => $record->dispensing_date->toDateString(),
                'next_dispensing_on' => $record->next_dispensing_date?->toDateString(),
                'doses_taken' => $record->doses_taken,
                'remaining_tablets' => $record->remaining_tablets,
                'missed_reason' => $record->missed_reason,
                'missed_intervention' => $record->missed_intervention,
                'side_effects' => $record->side_effects ?? [],
                'remarks' => $record->remarks,
                'scheduled' => $scheduled,
                'previous_date' => $previous?->dispensing_date->toDateString(),
                'previous_supply' => $previous?->weekly_supply ?? 0,
                'previous_dose' => $previous?->dose ?? 0,
            ];
        })->values()->all();
    }

    /**
     * A week is Completed once dispensed, Current when it's the visit now
     * due, Overdue when that date has passed, and Upcoming otherwise. Only
     * the next unrecorded week of the CURRENT month offers Record — a past
     * month's missing week can't be back-filled here. A recorded week can
     * only be edited while it's still the latest visit in the whole
     * enrollment; once the next one exists it's finalized (view only),
     * since every later visit's figures are computed against it.
     *
     * @param  Collection<int, MedicationDispensingRecord>  $monthRecords
     * @return array<int, array<string, mixed>>
     */
    private static function weeks(
        TreatmentEnrollment $enrollment,
        int $month,
        Collection $monthRecords,
        ?int $currentMonth,
        ?MedicationDispensingRecord $last,
    ): array {
        $today = Carbon::now()->startOfDay();
        $isClosed = ! $enrollment->isOnTreatment();

        return collect(range(1, 4))->map(function (int $week) use (
            $enrollment,
            $month,
            $monthRecords,
            $currentMonth,
            $last,
            $today,
            $isClosed,
        ) {
            $hit = $monthRecords->firstWhere('week_number', $week);

            if ($hit !== null) {
                $isLatest = $last !== null && $last->is($hit);

                return [
                    'week' => $week,
                    'state' => 'Completed',
                    'tone' => 'completed',
                    'date_label' => $hit->dispensing_date->format('M j'),
                    'record_id' => $hit->id,
                    'can_record' => false,
                    'can_edit' => $isLatest && ! $isClosed,
                    'can_view' => true,
                    'supply' => MedicineSupply::forRecord($enrollment, $hit),
                ];
            }

            $isNextDue = $week === $monthRecords->count() + 1
                && $month === $currentMonth
                && ! $isClosed;

            if ($isNextDue) {
                $next = $last?->nextDispensingDate();
                $days = $next ? $today->diffInDays($next->copy()->startOfDay(), absolute: false) : 0;

                return [
                    'week' => $week,
                    'state' => $week === 1 ? 'Week 1 Return' : ($days < 0 ? 'Overdue' : 'Current'),
                    'tone' => $days < 0 ? 'overdue' : 'current',
                    'date_label' => $next?->format('M j') ?? '—',
                    'record_id' => null,
                    'can_record' => true,
                    'can_edit' => false,
                    'can_view' => false,
                    'supply' => null,
                ];
            }

            return [
                'week' => $week,
                'state' => 'Upcoming',
                'tone' => 'upcoming',
                'date_label' => '—',
                'record_id' => null,
                'can_record' => false,
                'can_edit' => false,
                'can_view' => false,
                'supply' => null,
            ];
        })->all();
    }
}
