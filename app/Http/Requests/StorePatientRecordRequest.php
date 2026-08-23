<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Override;

class StorePatientRecordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'rhu';
    }

    #[Override]
    protected function prepareForValidation()
    {
        $this->merge([
            'patient_name' => trim((string) $this->input('patient_name')),
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'form_type' => ['required', 'in:sputum_collection,contact_tracing'],
            'patient_id' => ['nullable', 'string', 'max:80'],
            'patient_name' => ['required', 'string', 'max:150'],
            'age' => ['nullable', 'integer', 'min:0', 'max:120'],
            'sex' => ['nullable', 'in:male,female'],
            'contact_number' => ['nullable', 'string', 'max:40'],
            'address' => ['nullable', 'string'],
            'status' => ['required', 'in:draft,completed'],
            'responses' => ['required', 'array'],
        ];
    }
}
