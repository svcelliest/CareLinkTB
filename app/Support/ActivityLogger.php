<?php

namespace App\Support;

use App\Models\Activity;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class ActivityLogger
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public static function record(
        User $user,
        string $type,
        string $title,
        ?string $description = null,
        array $metadata = [],
        ?Model $subject = null,
    ): Activity {
        return $user->activities()->create([
            'type' => $type,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'title' => $title,
            'description' => $description,
            'metadata' => $metadata === [] ? null : $metadata,
        ]);
    }
}
