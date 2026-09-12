<?php

namespace App\Http\Requests\Rhu;

use App\Models\TreatmentCase;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Case closure. Recording an outcome is what closes a treatment case, so the
 * outcome list here is the model's — there is no second list of allowed
 * values anywhere in the app.
 */
class UpdateTreatmentOutcomeRequest extends FormRequest
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
            'outcome' => ['required', Rule::in(TreatmentCase::OUTCOMES)],
            'outcome_date' => ['required', 'date'],
            'outcome_remarks' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function attributes(): array
    {
        return [
            'outcome_date' => 'outcome date',
            'outcome_remarks' => 'remarks',
        ];
    }
}
