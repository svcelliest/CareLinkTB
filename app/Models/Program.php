<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Casts\Attribute;

class Program extends Model
{
    use HasFactory;

    protected $fillable = [
        'created_by',
        'name',
        'location_id',
        'scheduled_at',
        'status',
    ];
    protected function status(): Attribute
    {
        return Attribute::get(function (string $value) {
            if ($value === 'completed') {
                return $value;
            }
            return $this->scheduled_at?->isFuture() ? 'upcoming' : 'active';
        });
    }

    /**
     * "active"/"upcoming" only ever exist as the computed status() above —
     * the stored column is just "upcoming" or "completed" — so filtering
     * has to mirror that logic against scheduled_at instead of matching
     * the raw column against a value it never actually holds.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', '!=', 'completed')
            ->where('scheduled_at', '<=', now());
    }

    public function scopeUpcoming(Builder $query): Builder
    {
        return $query->where('status', '!=', 'completed')
            ->where('scheduled_at', '>', now());
    }

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function patients(): HasMany
    {
        return $this->hasMany(Patient::class);
    }
}
