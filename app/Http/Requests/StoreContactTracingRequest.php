<?php

namespace App\Http\Requests;

use App\Models\Patient;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreContactTracingRequest extends FormRequest
{
    public function authorize(): bool
    {
        $rhu = $this->user();
        if (! $rhu instanceof User || $rhu->role !== 'rhu') {
            return false;
        }

        $patient = $this->route('patient');

        return $patient instanceof Patient
            && $patient->program?->location_id === $rhu->location_id;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'visit_date' => ['nullable', 'date', 'before_or_equal:today'],
            'contact_method' => ['nullable', Rule::in(['call', 'home_visit'])],
            'rhu_contacted' => ['boolean'],
            'started_medication' => ['boolean'],
            'has_accompaniment' => ['boolean'],
            'household_count' => ['nullable', 'integer', 'min:0'],
            'household_symptoms_count' => ['nullable', 'integer', 'min:0'],
            'household_tb_count' => ['nullable', 'integer', 'min:0'],
            'household_taking_medication' => ['boolean'],
            'referral_cards_given' => ['boolean'],
            'tpt_total' => ['nullable', 'integer', 'min:0'],
            'tpt_0_4' => ['nullable', 'integer', 'min:0'],
            'tpt_5_14' => ['nullable', 'integer', 'min:0'],
            'tpt_15_plus' => ['nullable', 'integer', 'min:0'],
            'tpt_not_enrolled_reason' => [
                'nullable',
                Rule::in([
                    'contact_of_cd_patient',
                    'rhu_not_providing_tpt',
                    'contact_refused_tpt',
                    'negative_cxr',
                    'other',
                ]),
            ],
            'enumerator_name' => ['nullable', 'string', 'max:150'],
            'tb_case_identified' => ['boolean'],
            'remarks' => ['nullable', 'string'],
        ];
    }
}
