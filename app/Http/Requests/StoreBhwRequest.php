<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Override;

class StoreBhwRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'rhu';
    }

    #[Override]
    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => trim((string) $this->input('name')),
            'contact_number' => trim((string) $this->input('contact_number')),
            'address' => trim((string) $this->input('address')),
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'contact_number' => ['required', 'string', 'max:40'],
            'address' => ['nullable', 'string'],
        ];
    }
}
