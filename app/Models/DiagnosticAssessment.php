<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DiagnosticAssessment extends Model
{
    use HasFactory;

    protected $fillable = [
        'patient_id',
        'tested_with_gxpert',
        'tested_with_dssm',
        'result_dssm',
        'result_rr',
        'result_t',
        'result_tt',
        'result_ti',
        'result_negative',
        'tb_diagnosis',
        'remarks',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
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

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /**
     * Display label for the mockup's "Enrolled / Screened As" field.
     */
    public function diagnosisLabel(): ?string
    {
        return match ($this->tb_diagnosis) {
            'dstb_cd' => 'Clinically Diagnosed',
            'dstb_bc' => 'Bacteriologically Confirmed',
            'rrtb_bc' => 'Rifampicin-Resistant, Bacteriologically Confirmed',
            default => null,
        };
    }
}
