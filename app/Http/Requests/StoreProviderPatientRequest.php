<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Override;

/**
 * Provider screening intake — the one way a patient enters the `patients`
 * table. The screen collects a birthday rather than an age and has no clinical
 * questionnaire, so age is derived server-side.
 */
class StoreProviderPatientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'provider';
    }

    #[Override]
    protected function prepareForValidation()
    {
        $this->merge([
            'name' => trim((string) $this->input('name')),
            'address' => trim((string) $this->input('address')),
            'contact_number' => trim((string) $this->input('contact_number')),
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'birthday' => ['required', 'date', 'before_or_equal:today'],
            'sex' => ['required', 'in:male,female'],
            'address' => ['required', 'string', 'max:255'],
            'contact_number' => ['required', 'string', 'max:40'],
            'presumptive' => ['sometimes', 'boolean'],
        ];
    }

    public function attributes(): array
    {
        return [
            'contact_number' => 'contact number',
        ];
    }
}
