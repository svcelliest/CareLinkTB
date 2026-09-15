<?php

namespace App\Http\Requests;

use App\Models\Patient;
use App\Models\TreatmentEnrollment;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTreatmentEnrollmentRequest extends FormRequest
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
            'registry_number' => ['required', 'string', 'max:30', Rule::unique('treatment_enrollments', 'registry_number')],
            'treatment_facility' => ['required', 'string', 'max:150'],
            'diagnosing_facility' => ['nullable', 'string', 'max:150'],
            'registration_date' => ['required', 'date', 'before_or_equal:today'],
            'treatment_start_date' => ['required', 'date', 'after_or_equal:registration_date'],
            'baseline_weight' => ['nullable', 'numeric', 'min:0', 'max:999.9'],
            'registration_group' => ['required', Rule::in(TreatmentEnrollment::REGISTRATION_GROUPS)],
            'treatment_regimen' => ['required', Rule::in(TreatmentEnrollment::TREATMENT_REGIMENS)],
        ];
    }
}
