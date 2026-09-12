<?php

namespace App\Http\Requests\Rhu;

use App\Models\TreatmentFollowup;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A follow-up sputum examination result.
 *
 * The AFB count is only meaningful for a scanty result — the reference reveals
 * that field for "Scanty (+n)" alone — so it is required exactly then and
 * discarded otherwise.
 */
class RecordFollowupResultRequest extends FormRequest
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
        return [
            'collection_date' => ['required', 'date'],
            'result_date' => ['required', 'date', 'after_or_equal:collection_date'],
            'smear_result' => ['required', Rule::in(TreatmentFollowup::SMEAR_RESULTS)],
            'afb_count' => [
                Rule::requiredIf(fn (): bool => $this->input('smear_result') === 'Scanty (+n)'),
                'nullable',
                'string',
                'max:60',
            ],
            'remarks' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function attributes(): array
    {
        return [
            'collection_date' => 'collection date',
            'result_date' => 'result date',
            'smear_result' => 'smear result',
            'afb_count' => 'AFB count',
        ];
    }

    public function messages(): array
    {
        return [
            'result_date.after_or_equal' =>
                'The result date cannot be earlier than the collection date.',
        ];
    }
}
