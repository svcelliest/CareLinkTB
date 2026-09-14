<?php

namespace App\Http\Requests;

use App\Models\Patient;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSputumCollectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $coordinator = $this->user();
        if (! $coordinator instanceof User || $coordinator->role !== 'icm') {
            return false;
        }

        $patient = $this->route('patient');

        return $patient instanceof Patient
            && $patient->program?->created_by === $coordinator->id;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'collected' => ['nullable', 'boolean'],
            'not_collected_reason' => [
                'nullable',
                Rule::in([
                    'no_rhu_staff_or_bhw',
                    'patient_refused',
                    'patient_absent',
                    'no_supplies',
                    'other',
                ]),
            ],
            'remarks' => ['nullable', 'string'],
        ];
    }
}
