<?php

namespace App\Http\Requests;

use App\Models\Patient;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSmsLogRequest extends FormRequest
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
            // Exactly one of patient_id / bhw_id must be present — the
            // recipient is either a registered patient or a BHW contact,
            // never both (see sms_logs migration).
            'patient_id' => ['nullable', 'required_without:bhw_id', 'prohibits:bhw_id', 'integer'],
            'bhw_id' => [
                'nullable',
                'required_without:patient_id',
                'integer',
                Rule::exists('bhws', 'id')->where('location_id', $this->user()?->location_id),
            ],
            'message' => ['required', 'string', 'max:670'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $patientId = $this->input('patient_id');
            if (! $patientId) {
                return;
            }

            $patient = Patient::with('program')->find($patientId);

            if (! $patient || $patient->program?->location_id !== $this->user()?->location_id) {
                $validator->errors()->add('patient_id', 'This patient is not in your municipality.');

                return;
            }

            if (! $patient->treatmentEnrollments()->exists()) {
                $validator->errors()->add(
                    'patient_id',
                    'This patient is not enrolled in treatment monitoring.',
                );
            }
        });
    }
}
