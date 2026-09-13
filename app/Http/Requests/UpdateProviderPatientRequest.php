<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Override;

class UpdateProviderPatientRequest extends FormRequest
{
    public function authorize(): bool
    {
        if ($this->user()?->role !== 'provider') {
            return false;
        }

        return $this->route('patient')->program_id === $this->route('program')->id;
    }

    #[Override]
    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => Str::title(trim((string) $this->input('name'))),
            'address' => trim((string) $this->input('address')),
            'contact_number' => trim((string) $this->input('contact_number')),
            'sex' => strtolower(trim((string) $this->input('sex'))),
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string'],
            'date_of_birth' => ['required', 'date', 'before_or_equal:today'],
            'address' => ['required', 'string'],
            'contact_number' => ['required', 'string'],
            'presumptive' => ['required', 'boolean'],
            'sex' => ['required', 'in:male,female'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            if ($this->route('program')->status !== 'active') {
                $validator->errors()->add('program', 'This screening session has already been finished.');
            }
        });
    }
}
