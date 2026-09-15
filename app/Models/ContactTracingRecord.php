<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContactTracingRecord extends Model
{
    use HasFactory;

    /** Dropdown label lists — ported from the medjofinal reference for its
     * Contact Tracing form. `contact_method`/`tpt_not_enrolled_reason` are
     * this schema's real enums; the Yes/No lists are display labels only —
     * this schema stores those answers as real booleans, not strings. */
    public const VISIT_TYPES = ['Call', 'Home Visit'];

    public const YES_NO = ['Yes', 'No'];

    public const TAKING_MEDS = ['Yes', 'No', 'Not Applicable'];

    public const TPT_REASONS = [
        'Contact of CD patient',
        'RHU not providing TPT',
        'Contact refused TPT',
        'Negative CXR',
        'Other',
    ];

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
            'household_count' => 'integer',
            'household_symptoms_count' => 'integer',
            'household_tb_count' => 'integer',
            'household_taking_medication' => 'boolean',
            'referral_cards_given' => 'boolean',
            'tpt_total' => 'integer',
            'tpt_0_4' => 'integer',
            'tpt_5_14' => 'integer',
            'tpt_15_plus' => 'integer',
            'tb_case_identified' => 'boolean',
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
