<?php

namespace App\Http\Requests;

use App\Models\TreatmentEnrollment;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTreatmentOutcomeRequest extends FormRequest
{
    public function authorize(): bool
    {
        $rhu = $this->user();
        if (! $rhu instanceof User || $rhu->role !== 'rhu') {
            return false;
        }

        $enrollment = $this->route('treatmentEnrollment');

        return $enrollment instanceof TreatmentEnrollment
            && $enrollment->patient?->program?->location_id === $rhu->location_id;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'outcome' => ['required', Rule::in(TreatmentEnrollment::OUTCOMES)],
            'outcome_date' => [
                'required',
                'date',
                'before_or_equal:today',
                function (string $attribute, mixed $value, Closure $fail): void {
                    /** @var TreatmentEnrollment $enrollment */
                    $enrollment = $this->route('treatmentEnrollment');

                    if ($enrollment->treatment_start_date && $value < $enrollment->treatment_start_date->toDateString()) {
                        $fail('The outcome date cannot be before the treatment start date.');
                    }
                },
            ],
            'outcome_remarks' => ['nullable', 'string'],
        ];
    }
}
