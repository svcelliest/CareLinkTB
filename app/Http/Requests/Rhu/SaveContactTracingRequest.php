<?php

namespace App\Http\Requests\Rhu;

use App\Models\TreatmentContactTracing;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The ACF Contact Tracing report.
 *
 * Field names mirror the original ACF Contact Tracing Report table. The
 * household counts default to zero rather than null because the form ships them
 * as zero — an unanswered count and a genuine zero are not distinguished on the
 * paper form either.
 *
 * The TB patient's own name is absent: the form shows it disabled, and the
 * server reads it from the case.
 */
class SaveContactTracingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'rhu';
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $yesNo = ['nullable', Rule::in(TreatmentContactTracing::YES_NO)];
        $count = ['nullable', 'integer', 'min:0', 'max:60'];

        return [
            // 1. ACF Activity
            'patient_address' => ['nullable', 'string', 'max:255'],
            'acf_date' => ['nullable', 'date'],
            'province' => ['nullable', 'string', 'max:100'],
            'municipality' => ['nullable', 'string', 'max:100'],
            'community' => ['nullable', 'string', 'max:100'],
            'registry_no' => ['nullable', 'string', 'max:60'],
            'phone' => ['nullable', 'string', 'max:40'],

            // 2. Patient Follow-up
            'visit_date' => ['nullable', 'date'],
            'visit_type' => ['nullable', Rule::in(TreatmentContactTracing::VISIT_TYPES)],
            'rhu_contacted' => $yesNo,
            'started_medication' => $yesNo,
            'accompaniment' => $yesNo,

            // 3. Household Assessment
            'household_total' => $count,
            'household_symptoms' => $count,
            'household_tb' => $count,
            'household_taking_meds' => ['nullable', Rule::in(TreatmentContactTracing::TAKING_MEDS)],
            'referral_cards' => $yesNo,
            'tpt_total' => $count,

            // 4. TPT Enrollment
            'tpt_0_to_4' => $count,
            'tpt_5_to_14' => $count,
            'tpt_15_plus' => $count,
            'tpt_reason' => ['nullable', Rule::in(TreatmentContactTracing::TPT_REASONS)],
            'enumerator' => ['nullable', 'string', 'max:150'],
        ];
    }

    public function attributes(): array
    {
        return [
            'patient_address' => "patient's address",
            'acf_date' => 'date of ACF activity',
            'visit_date' => 'date of call or home visit',
            'visit_type' => 'call or home visit',
            'rhu_contacted' => 'RHU/CHO contact',
            'started_medication' => 'started medication',
            'household_total' => 'household size',
            'household_symptoms' => 'household members with symptoms',
            'household_tb' => 'household members with TB',
            'household_taking_meds' => 'household members taking TB medication',
            'referral_cards' => 'referral cards given',
            'tpt_total' => 'household members enrolled in TPT',
            'tpt_0_to_4' => 'TPT enrolled 0 to 4 years old',
            'tpt_5_to_14' => 'TPT enrolled 5 to 14 years old',
            'tpt_15_plus' => 'TPT enrolled 15 years old and above',
            'tpt_reason' => 'reason not enrolled for TPT',
            'enumerator' => 'enumerator name',
        ];
    }
}
