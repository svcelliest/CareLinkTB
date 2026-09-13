<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SputumCollection extends Model
{
    use HasFactory;

    protected $fillable = [
        'patient_id',
        'collected',
        'not_collected_reason',
        'remarks',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'collected' => 'boolean',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
