<?php

namespace App\Notifications;

use App\Models\TreatmentEnrollment;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

class FollowUpExamDue extends Notification
{
    use Queueable;

    public function __construct(
        private readonly TreatmentEnrollment $enrollment,
        private readonly int $monthNumber,
        private readonly Carbon $dueDate,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, int|string>
     */
    public function toArray(object $notifiable): array
    {
        $patientName = $this->enrollment->patient?->name ?? 'A patient';

        return [
            'title' => 'Follow-up exam due soon',
            'message' => "{$patientName}'s Month {$this->monthNumber} follow-up exam is due {$this->dueDate->format('M j, Y')}.",
            'kind' => 'follow_up_exam',
            'patient_id' => $this->enrollment->patient_id,
            'enrollment_id' => $this->enrollment->id,
            'month_number' => $this->monthNumber,
            'due_date' => $this->dueDate->toDateString(),
            'url' => route(
                $notifiable->role.'.programs.show',
                $this->enrollment->patient?->program_id,
                false,
            ),
        ];
    }
}
