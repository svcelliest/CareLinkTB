<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContactTracingRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'patient_id',
        'visit_date',
        'contact_method',
        'rhu_contacted',
        'started_medication',
        'has_accompaniment',
        'household_count',
        'household_symptoms_count',
        'household_tb_count',
        'household_taking_medication',
        'referral_cards_given',
        'tpt_total',
        'tpt_0_4',
        'tpt_5_14',
        'tpt_15_plus',
        'tpt_not_enrolled_reason',
        'enumerator_name',
        'tb_case_identified',
        'contact_enrolled_treatment',
        'contacts_enrolled_tpt',
        'remarks',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'visit_date' => 'date',
            'rhu_contacted' => 'boolean',
            'started_medication' => 'boolean',
            'has_accompaniment' => 'boolean',
            'household_taking_medication' => 'boolean',
            'referral_cards_given' => 'boolean',
            'tb_case_identified' => 'boolean',
            'contact_enrolled_treatment' => 'boolean',
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
