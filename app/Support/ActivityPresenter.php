<?php

namespace App\Support;

use App\Models\Activity;
use App\Models\User;

class ActivityPresenter
{
    /**
     * @return array<string, mixed>
     */
    public static function make(Activity $activity, User $user): array
    {
        return [
            'id' => $activity->id,
            'type' => $activity->type,
            'category' => self::category($activity->type),
            'title' => $activity->title,
            'description' => $activity->description,
            'created_at' => $activity->created_at?->toIso8601String(),
            'url' => self::url($activity, $user),
        ];
    }

    private static function category(string $type): string
    {
        return match (true) {
            str_starts_with($type, 'account.') => 'accounts',
            str_starts_with($type, 'message.') => 'messages',
            str_starts_with($type, 'security.') => 'security',
            default => 'profile',
        };
    }

    private static function url(Activity $activity, User $user): ?string
    {
        if (str_starts_with($activity->type, 'message.')) {
            $contactId = $activity->metadata['contact_id'] ?? null;

            return $contactId && in_array($user->role, ['icm', 'rhu', 'provider'], true)
                ? route($user->role . '.inbox', ['contact' => $contactId])
                : null;
        }

        if (str_starts_with($activity->type, 'account.')) {
            return $user->role === 'icm' ? route('icm.accounts.index') : null;
        }

        if (
            str_starts_with($activity->type, 'profile.')
            || $activity->type === 'security.password_updated'
        ) {
            return route('profile.edit');
        }

        return null;
    }
}
