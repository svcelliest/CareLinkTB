<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PasswordResetOtp extends Notification
{
    use Queueable;

    public function __construct(
        private readonly string $code,
        private readonly int $expiresInMinutes,
    ) {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject('Your CareLink TB password reset code')
            ->greeting('Password reset requested')
            ->line('Use this one-time code to reset your CareLink TB password:')
            ->line($this->code)
            ->line("The code expires in {$this->expiresInMinutes} minutes and can only be used once.")
            ->line('If you did not request a password reset, you can ignore this message. Your password will not change.');
    }
}
