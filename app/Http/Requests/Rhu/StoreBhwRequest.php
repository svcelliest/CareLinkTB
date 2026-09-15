<?php

namespace App\Http\Requests\Rhu;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * A new BHW contact for the SMS Log's recipient list.
 *
 * The municipality is not accepted from the browser: the contact always
 * belongs to the RHU's own catchment, set server-side from the account.
 */
class StoreBhwRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'rhu';
    }

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
            // Same limits the patient forms apply to a contact number.
            'contact_number' => ['required', 'string', 'max:40'],
            'address' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function attributes(): array
    {
        return [
            'name' => 'full name',
            'contact_number' => 'contact number',
        ];
    }
}
