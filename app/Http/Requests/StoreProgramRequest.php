<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Override;
use Illuminate\Validation\Rule;

class StoreProgramRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->role === 'icm';
    }

    #[Override]
    protected function prepareForValidation()
    {
        $this->merge([
            'name' => trim((string)$this->input('name')),
        ]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'location_id' => [
                'required',
                Rule::exists('locations', 'id')->where('level', 'municipality')
            ],
            'scheduled_at' => ['required', 'date'],
        ];
    }
}
