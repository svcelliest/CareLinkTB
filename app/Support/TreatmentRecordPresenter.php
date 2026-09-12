<?php

namespace App\Support;

use App\Models\TreatmentCase;
use App\Models\TreatmentDispensingRecord;
use App\Models\TreatmentFollowup;
use App\Models\TreatmentMonitoringEntry;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Shapes a treatment case for the Treatment Monitoring screen.
 *
 * Every derived figure the reference computes in the browser — scheduled doses,
 * expected tablets left, per-visit and per-month adherence, the week cards, the
 * month summary — is computed here instead. They all depend on a record's
 * position in the whole dispensing sequence, so doing it once on the server
 * keeps the four places that display them from disagreeing.
 */
class TreatmentRecordPresenter
{
    /**
     * @return array<string, mixed>
     */
    public static function months(TreatmentCase $case): array
    {
        $entries = $case->monitoringEntries->keyBy('month');
        $currentMonth = $case->currentMonth();
        $records = $case->dispensingRecords->values();

        return collect(range(1, TreatmentCase::TOTAL_MONTHS))
            ->mapWithKeys(function (int $month) use ($case, $entries, $currentMonth, $records) {
                $entry = $entries->get($month);
                $monthRecords = $records
                    ->filter(fn (TreatmentDispensingRecord $r) => $r->month === $month && ! $r->is_initial)
                    ->values();

                // A month is `completed` once its review and all four weekly
                // returns are in, `current` while it is the one being worked,
                // and `locked` until the month before it is completed. The
                // screen edits only the current month; the other two are
                // read-only, and locked months cannot be opened at all.
                $state = match (true) {
                    $case->isMonthComplete($month) => 'completed',
                    $month === $currentMonth => 'current',
                    default => 'locked',
                };

                return [$month => [
                    'month' => $month,
                    'phase' => TreatmentCase::phaseFor($month),
                    'regimen' => TreatmentCase::regimenFor($month),
                    'is_current' => $month === $currentMonth,
                    'state' => $state,
                    'saved' => $entry?->isSaved() ?? false,
                    'review' => self::review($case, $entry, $month),
                    'weeks' => self::weeks($case, $month, $monthRecords, $currentMonth),
                    'history' => self::history($case, $monthRecords),
                    'summary' => self::summary($case, $month, $monthRecords, $entry),
                    'dispensing_form' => self::dispensingForm($case, $month, $entry, $currentMonth),
                ]];
            })
            ->all();
    }

    /**
     * The Monthly Clinical Review's fields and the facts strip above them.
     *
     * `shown_dose` is what the dose select opens on: the dose confirmed this
     * month if there is one, otherwise the dose already in force — so a month
     * not yet reviewed still shows the patient's actual prescription.
     *
     * @return array<string, mixed>
     */
    private static function review(
        TreatmentCase $case,
        ?TreatmentMonitoringEntry $entry,
        int $month,
    ): array {
        $shownDose = $entry?->confirmed_dose ?? $case->doseBefore($month);

        return [
            'review_date' => $entry?->review_date?->toDateString(),
            'review_date_label' => $entry?->review_date?->format('M j, Y'),
            'weight_kg' => $entry?->weight_kg,
            'confirmed_dose' => $entry?->confirmed_dose,
            'shown_dose' => $shownDose,
            'clinical_status' => $entry?->clinical_status ?? '',
            'symptoms' => $entry?->symptoms ?? '',
            'remarks' => $entry?->remarks ?? '',
            'reviewed_by_name' => $entry?->reviewed_by_name ?? '',
            'previous_weight' => $case->weightBefore($month),
            'dose_review' => $entry?->doseReview($case),
        ];
    }

    /**
     * The four week cards. A week is Completed once dispensed, Current when it
     * is the visit now due, Overdue when that date has passed, and Upcoming
     * otherwise. Only the next unrecorded week of the current month offers the
     * Record button — a past month's missing week cannot be back-filled here.
     *
     * A recorded week can be corrected only while it is still the latest
     * visit. Once the following week is recorded it is finalized: the figures
     * of every later visit are computed against it, so it is shown through
     * View rather than reopened. `can_view` is offered for every recorded week
     * so a finalized one is never hidden, only closed to edits.
     *
     * @param  Collection<int, TreatmentDispensingRecord>  $monthRecords
     * @return array<int, array<string, mixed>>
     */
    private static function weeks(
        TreatmentCase $case,
        int $month,
        Collection $monthRecords,
        int $currentMonth,
    ): array {
        $last = $case->lastDispensing();
        $today = Carbon::now()->startOfDay();

        return collect(range(1, 4))->map(function (int $week) use (
            $case,
            $month,
            $monthRecords,
            $currentMonth,
            $last,
            $today,
        ) {
            $hit = $monthRecords->firstWhere('week', $week);

            if ($hit !== null) {
                $isLatest = $last !== null && $last->is($hit);

                // Recorded is Completed, full stop — green the moment it is
                // saved. "Current" (red) is reserved for the week now due, so
                // a done week never looks like the one still to be recorded.
                // Whether it may still be corrected is `can_edit`, not its tone.
                return [
                    'week' => $week,
                    'state' => 'Completed',
                    'tone' => 'completed',
                    'date_label' => $hit->dispensed_on->format('M j'),
                    'record_id' => $hit->id,
                    'can_record' => false,
                    'can_edit' => $isLatest && ! $case->isClosed(),
                    'can_view' => true,
                    // This week's own Medicine Tracker: live while it is the
                    // latest strip, frozen at the next visit otherwise.
                    'supply' => MedicineSupply::forRecord($case, $hit),
                ];
            }

            $isNextDue = $week === $monthRecords->count() + 1
                && $month === $currentMonth
                && ! $case->isClosed();

            if ($isNextDue) {
                $next = $last?->nextDispensingDate();
                $days = $next ? $today->diffInDays($next->startOfDay(), absolute: false) : 0;

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

    /**
     * The complete Medication Dispensing History — every weekly return across
     * every month, oldest first. A permanent record of the whole treatment,
     * so it is deliberately not scoped to the month or week on screen.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function fullHistory(TreatmentCase $case): array
    {
        return self::history(
            $case,
            $case->dispensingRecords
                ->filter(fn (TreatmentDispensingRecord $r) => ! $r->is_initial)
                ->values(),
        );
    }

    /**
     * Medication Dispensing History rows.
     *
     * @param  Collection<int, TreatmentDispensingRecord>  $monthRecords
     * @return array<int, array<string, mixed>>
     */
    private static function history(TreatmentCase $case, Collection $monthRecords): array
    {
        $all = $case->dispensingRecords->values();

        return $monthRecords->map(function (TreatmentDispensingRecord $record) use ($case, $all) {
            $index = $all->search(fn (TreatmentDispensingRecord $r) => $r->is($record));
            $expected = $case->expectedTabletsAt($index);
            $scheduled = $case->scheduledDosesAt($index);

            return [
                'id' => $record->id,
                'month' => $record->month,
                'date_label' => $record->dispensed_on->format('M j'),
                'date_full_label' => $record->dispensed_on->format('M j, Y'),
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

                // The editable values, so "Edit" can reopen the form on this
                // record without a second round trip.
                'week' => $record->week,
                'dispensed_on' => $record->dispensed_on->toDateString(),
                'next_dispensing_on' => $record->next_dispensing_on?->toDateString(),
                'doses_taken' => $record->doses_taken,
                'remaining_tablets' => $record->remaining_tablets,
                'missed_reason' => $record->missed_reason,
                'missed_intervention' => $record->missed_intervention,
                'side_effects' => $record->side_effects ?? [],
                'side_effect_severity' => $record->side_effect_severity,
                'side_effect_action' => $record->side_effect_action,
                'side_effect_referred' => $record->side_effect_referred,
                'problems' => $record->problems ?? [],
                'problem_action' => $record->problem_action,
                'problem_followup_on' => $record->problem_followup_on?->toDateString(),
                'remarks' => $record->remarks,
                'scheduled' => $scheduled,
                'previous_date' => $index > 0
                    ? $all[$index - 1]->dispensed_on->toDateString()
                    : null,
                'previous_supply' => $index > 0 ? $all[$index - 1]->weekly_supply : 0,
                'previous_dose' => $index > 0 ? $all[$index - 1]->dose : 0,
            ];
        })->all();
    }

    /**
     * The Month N Summary grid.
     *
     * @param  Collection<int, TreatmentDispensingRecord>  $monthRecords
     * @return array<string, mixed>
     */
    private static function summary(
        TreatmentCase $case,
        int $month,
        Collection $monthRecords,
        ?TreatmentMonitoringEntry $entry,
    ): array {
        $all = $case->dispensingRecords->values();

        $scheduled = $monthRecords->sum(fn (TreatmentDispensingRecord $r) => $case->scheduledDosesAt(
            $all->search(fn (TreatmentDispensingRecord $x) => $x->is($r)),
        ));
        $taken = $monthRecords->sum('doses_taken');
        $missed = $monthRecords->sum('doses_missed');

        $sideEffects = $monthRecords
            ->flatMap(fn (TreatmentDispensingRecord $r) => $r->side_effects ?? [])
            ->unique()
            ->values();
        $problems = $monthRecords
            ->flatMap(fn (TreatmentDispensingRecord $r) => $r->problems ?? [])
            ->unique()
            ->values();

        return [
            'phase' => TreatmentCase::phaseFor($month),
            'weight' => $entry?->weight_kg,
            'confirmed_dose' => $entry?->confirmed_dose,
            'records' => $monthRecords->count(),
            'scheduled_doses' => $scheduled,
            'doses_taken' => $taken,
            'missed_doses' => $missed,
            'adherence' => $scheduled > 0 ? round($taken / $scheduled * 100, 1) : 0,
            'side_effects' => $sideEffects->isEmpty() ? 'None' : $sideEffects->implode(', '),
            'problems' => $problems->isEmpty() ? 'None' : $problems->implode(', '),
            // The follow-up diagnostic test is not part of the week or month
            // summary; it has its own section and schedule.
        ];
    }

    /**
     * What the Record Medication Dispensing form opens with.
     *
     * The dispensing date is carried forward from the previous visit's "next
     * dispensing" so the RHU is not retyping a date it already scheduled, and
     * the previous strip's size and dose are sent so the browser can preview
     * the expected tablet count as the form is filled in. The figures are all
     * recomputed on save — this is a preview, not the record.
     *
     * @return array<string, mixed>
     */
    private static function dispensingForm(
        TreatmentCase $case,
        int $month,
        ?TreatmentMonitoringEntry $entry,
        int $currentMonth,
    ): array {
        $previous = $case->lastDispensing();
        $today = Carbon::now()->startOfDay();

        return [
            'can_record' => $month === $currentMonth
                && ! $case->isClosed()
                && ($entry?->isSaved() ?? false),
            'needs_review' => ! ($entry?->isSaved() ?? false),
            'previous_label' => $previous?->dispensed_on->format('M j, Y') ?? '—',
            'previous_date' => $previous?->dispensed_on->toDateString(),
            'previous_supply' => $previous?->weekly_supply ?? 0,
            'previous_dose' => $previous?->dose ?? 0,
            'suggested_date' => ($previous?->next_dispensing_on ?? $today)->toDateString(),
            'dose' => $entry?->confirmed_dose ?? $case->currentDose(),
            'strip_tablets' => TreatmentDispensingRecord::STRIP_TABLETS,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function followups(TreatmentCase $case): array
    {
        return $case->followups->map(fn (TreatmentFollowup $followup) => [
            'id' => $followup->id,
            'month' => $followup->month,
            'due_date_label' => $followup->due_date->format('M j, Y'),
            'status' => $followup->status(),
            'collected' => $followup->collected,
            'collection_date' => $followup->collection_date?->toDateString(),
            'result_date' => $followup->result_date?->toDateString(),
            'smear_result' => $followup->smear_result,
            'afb_count' => $followup->afb_count,
            'remarks' => $followup->remarks,
            'is_positive' => $followup->isPositive(),
        ])->all();
    }
}
