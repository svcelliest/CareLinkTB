<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Override;

class StoreProviderPatientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'provider';
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
            'age' => ['required', 'integer', 'min:0', 'max:120'],
            'sex' => ['required', 'in:male,female'],
            'address' => ['required', 'string'],
            'contact_number' => ['required', 'string'],
            'presumptive' => ['nullable', 'boolean'],
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
