<?php

namespace App\Http\Requests\Rhu;

use App\Models\TreatmentCase;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Treatment Enrollment.
 *
 * Only the editable half of the reference form is declared. Patient name,
 * birthday, address, facilities and the diagnostic results are all read back
 * from the patient record at save time and are not accepted from the browser
 * — which is why they are absent here rather than validated and then ignored.
 * The same goes for the registration date (today) and the assigned treatment
 * provider (the signed-in RHU account): the controller sets both from the
 * server's own clock and session.
 *
 * The TB registry number is the one identifier the RHU types: it comes from
 * the paper register, so it is entered rather than generated, and only its
 * uniqueness is checked here.
 */
class StoreTreatmentEnrollmentRequest extends FormRequest
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
            'patient_id' => ['required', 'integer', Rule::exists('patients', 'id')],
            // Unique for the life of the table: the rule sees soft-deleted rows
            // too, so a number once issued can never be typed again.
            'case_number' => [
                'required',
                'string',
                'max:20',
                Rule::unique('treatment_cases', 'case_number'),
            ],
            'registration_group' => ['required', Rule::in(TreatmentCase::REGISTRATION_GROUPS)],
            'regimen' => ['required', Rule::in(TreatmentCase::REGIMENS)],

            // The clinical rule from the reference form: treatment cannot be
            // recorded as starting before the patient was registered — and
            // registration is dated today.
            'treatment_start_date' => ['required', 'date', 'after_or_equal:today'],

            // Bounded to a plausible human weight, the same bounds the monthly
            // review applies, so a slipped decimal cannot become a dose band.
            'baseline_weight' => ['required', 'numeric', 'min:1', 'max:400'],
        ];
    }

    public function attributes(): array
    {
        return [
            'patient_id' => 'patient',
            'case_number' => 'TB registry number',
            'registration_group' => 'registration group',
            'treatment_start_date' => 'treatment start date',
            'baseline_weight' => 'baseline weight',
        ];
    }

    /** Trim the typed registry number so " TB-001" and "TB-001" are one number. */
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('case_number'))) {
            $this->merge(['case_number' => trim($this->input('case_number'))]);
        }
    }

    public function messages(): array
    {
        return [
            'case_number.unique' => 'This TB registry number is already assigned to another treatment case.',
            'treatment_start_date.after_or_equal' =>
                'Treatment start date cannot be earlier than the registration date (today).',
        ];
    }
}
