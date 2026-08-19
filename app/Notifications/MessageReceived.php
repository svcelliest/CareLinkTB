<?php

namespace App\Notifications;

use App\Models\Message;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class MessageReceived extends Notification
{
    use Queueable;

    public function __construct(
        private readonly User $sender,
        private readonly Message $message,
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
        return [
            'title' => 'New message',
            'message' => $this->sender->name.': '.Str::limit($this->message->body, 110),
            'kind' => 'message',
            'sender_id' => $this->sender->id,
            'sender_name' => $this->sender->name,
            'message_id' => $this->message->id,
            'url' => route(
                $notifiable->role.'.inbox',
                ['contact' => $this->sender->id],
                false,
            ),
        ];
    }
}
