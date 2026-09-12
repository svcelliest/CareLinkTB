<?php

namespace App\Notifications;

use App\Models\TreatmentCase;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * An alert about a treatment case, raised for the RHU staff who cover it.
 *
 * One class for every kind of treatment alert — a low medicine balance, an
 * approaching follow-up diagnostic test — so they all land in the same
 * database channel, render through the same NotificationPresenter and open
 * the same case page. `kind` and `meta` are what tell them apart, and
 * {@see \App\Support\TreatmentAlerts} uses `meta` to avoid raising the same
 * alert twice.
 */
class TreatmentAlert extends Notification
{
    use Queueable;

    /**
     * @param  array<string, int|string>  $meta
     */
    public function __construct(
        private readonly TreatmentCase $case,
        private readonly string $kind,
        private readonly string $title,
        private readonly string $message,
        private readonly array $meta = [],
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->title,
            'message' => $this->message,
            'kind' => $this->kind,
            'treatment_case_id' => $this->case->id,
            'case_number' => $this->case->case_number,
            ...$this->meta,
            'url' => route('rhu.treatment.show', $this->case, false),
        ];
    }
}
