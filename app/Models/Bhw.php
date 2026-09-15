<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A Barangay Health Worker contact kept by an RHU for the SMS Log.
 *
 * Scoped by `municipality`, never by who added it: every RHU account covering
 * the same municipality shares the same contact list, exactly as they share
 * the same patients.
 */
class Bhw extends Model
{
    protected $fillable = [
        'added_by',
        'municipality',
        'name',
        'contact_number',
        'address',
        'notified_at',
    ];

    protected function casts(): array
    {
        return [
            'notified_at' => 'datetime',
        ];
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }
}
