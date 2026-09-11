<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Override;

class StoreProviderPatientRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->role === 'provider';
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    #[Override]
    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => Str::title(trim((string) $this->input('name'))),
            'address' => trim((string)$this->input('address')),
            'contact_number' => trim((string) $this->input('contact_number')),
            'sex' => strtolower(trim((string)$this->input('sex'))),
        ]);
    }
    public function rules(): array
    {
        return [
            'name' => ['required', 'string'],
            'date_of_birth' => ['required', 'date', 'before_or_equal:today'],
            'sex' => ['required', 'in:male,female'],
            'address' => ['required', 'string'],
            'contact_number' => ['required', 'string'],
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
