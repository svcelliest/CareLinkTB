<?php

namespace App\Console\Commands;

use App\Models\TreatmentEnrollment;
use App\Models\User;
use App\Notifications\FollowUpExamDue;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class NotifyDueFollowUpExams extends Command
{
    protected $signature = 'follow-up-exams:notify-due';

    protected $description = 'Notify the enrolling RHU staff about follow-up exams entering their reminder window';

    public function handle(): void
    {
        $windowDays = (int) config('services.follow_up_exams.reminder_window_days');
        $today = Carbon::today();
        $notified = 0;

        TreatmentEnrollment::query()
            ->whereNull('outcome')
            ->with(['patient.diagnosticAssessment', 'creator', 'followUpExams'])
            ->chunkById(100, function ($enrollments) use ($today, $windowDays, &$notified): void {
                foreach ($enrollments as $enrollment) {
                    $notified += $this->notifyIfDue($enrollment, $today, $windowDays);
                }
            });

        $this->info("Sent {$notified} follow-up exam reminder(s).");
    }

    private function notifyIfDue(TreatmentEnrollment $enrollment, Carbon $today, int $windowDays): int
    {
        $creator = $enrollment->creator;
        if (! $creator instanceof User) {
            return 0;
        }

        $sent = 0;

        foreach ($enrollment->followUpExamScheduleMonths() as $month) {
            if ($enrollment->followUpExams->contains('month_number', $month)) {
                continue;
            }

            $dueDate = $enrollment->followUpExamDueDate($month);

            // Not yet due, or already overdue without ever entering the
            // window (e.g. the job didn't run for a stretch) — out of
            // scope here, this only flags exams currently inside the
            // reminder window.
            if ($dueDate === null || $dueDate->lt($today) || $today->diffInDays($dueDate) > $windowDays) {
                continue;
            }

            if ($this->alreadyNotified($creator, $enrollment, $month)) {
                continue;
            }

            $creator->notify(new FollowUpExamDue($enrollment, $month, $dueDate));
            $sent++;
        }

        return $sent;
    }

    private function alreadyNotified(User $creator, TreatmentEnrollment $enrollment, int $month): bool
    {
        return $creator->notifications()
            ->where('type', FollowUpExamDue::class)
            ->where('data->enrollment_id', $enrollment->id)
            ->where('data->month_number', $month)
            ->exists();
    }
}
