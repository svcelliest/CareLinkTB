<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScdaRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'patient_id',
        'checked_by',
        'collected',
        'not_collected_reason',
        'bhw_visit',
        'needs_transport_subsidy',
        'tested_with_gxpert',
        'tested_with_dssm',
        'result_dssm',
        'result_rr',
        'result_t',
        'result_tt',
        'result_ti',
        'result_negative',
        'registry_number',
        'remarks',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'collected' => 'boolean',
            'bhw_visit' => 'boolean',
            'needs_transport_subsidy' => 'boolean',
            'tested_with_gxpert' => 'boolean',
            'tested_with_dssm' => 'boolean',
            'result_dssm' => 'boolean',
            'result_rr' => 'boolean',
            'result_t' => 'boolean',
            'result_tt' => 'boolean',
            'result_ti' => 'boolean',
            'result_negative' => 'boolean',
        ];
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function checker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function isPositive(): bool
    {
        return $this->result_dssm || $this->result_rr || $this->result_t
            || $this->result_tt || $this->result_ti;
    }
}
