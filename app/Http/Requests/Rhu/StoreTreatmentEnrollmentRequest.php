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
 * birthday, address, facilities, the diagnostic results and the TB case number
 * are all read back from the patient record at save time and are not accepted
 * from the browser — which is why they are absent here rather than validated
 * and then ignored. The same goes for the registration date (today) and the
 * assigned treatment provider (the signed-in RHU account): the controller sets
 * both from the server's own clock and session.
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
            'registration_group' => 'registration group',
            'treatment_start_date' => 'treatment start date',
            'baseline_weight' => 'baseline weight',
        ];
    }

    public function messages(): array
    {
        return [
            'treatment_start_date.after_or_equal' =>
                'Treatment start date cannot be earlier than the registration date (today).',
        ];
    }
}
