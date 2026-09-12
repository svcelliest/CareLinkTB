<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The ACF Contact Tracing report attached to a treatment case.
 *
 * Field names and wording follow the original ACF Contact Tracing Report table,
 * as the screen states — including its question numbering, which is why the
 * labels on the form read "3. How many people live in your household?" rather
 * than something tidier.
 *
 * This is the household questionnaire taken alongside a TB DOTS enrolment. It
 * is distinct from the program-level `contact_tracing` patient form type, which
 * is an ICM intake shape and is not per-treatment-case.
 */
class TreatmentContactTracing extends Model
{
    use HasFactory;

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
        'treatment_case_id',
        'recorded_by',
        'patient_address',
        'acf_date',
        'province',
        'municipality',
        'community',
        'registry_no',
        'phone',
        'visit_date',
        'visit_type',
        'rhu_contacted',
        'started_medication',
        'accompaniment',
        'household_total',
        'household_symptoms',
        'household_tb',
        'household_taking_meds',
        'referral_cards',
        'tpt_total',
        'tpt_0_to_4',
        'tpt_5_to_14',
        'tpt_15_plus',
        'tpt_reason',
        'enumerator',
    ];

    protected function casts(): array
    {
        return [
            'acf_date' => 'date',
            'visit_date' => 'date',
            'household_total' => 'integer',
            'household_symptoms' => 'integer',
            'household_tb' => 'integer',
            'tpt_total' => 'integer',
            'tpt_0_to_4' => 'integer',
            'tpt_5_to_14' => 'integer',
            'tpt_15_plus' => 'integer',
        ];
    }

    public function treatmentCase(): BelongsTo
    {
        return $this->belongsTo(TreatmentCase::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
