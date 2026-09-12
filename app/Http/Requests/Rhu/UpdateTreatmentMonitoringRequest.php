<?php

namespace App\Http\Requests\Rhu;

use App\Models\TreatmentCase;
use App\Models\TreatmentDispensingRecord;
use App\Models\TreatmentMonitoringEntry;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The Monthly Clinical Review.
 *
 * Weight and the prescribed dose are the two the rest of the month hangs off —
 * the dose is what medication is dispensed at, and the weight is what the
 * weight-band advisory compares against — so both are required to save.
 */
class UpdateTreatmentMonitoringRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'rhu';
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'month' => ['required', 'integer', 'min:1', 'max:'.TreatmentCase::TOTAL_MONTHS],
            'review_date' => ['required', 'date'],

            // Bounded to a plausible human weight so a slipped decimal point
            // cannot be saved as a dose-band change.
            'weight_kg' => ['required', 'numeric', 'min:1', 'max:400'],
            'confirmed_dose' => ['required', 'integer', Rule::in(TreatmentDispensingRecord::DOSES)],
            'reviewed_by_name' => ['required', 'string', 'max:150'],
            'clinical_status' => ['nullable', Rule::in(TreatmentMonitoringEntry::CLINICAL_STATUSES)],
            'symptoms' => ['nullable', 'string', 'max:1000'],
            'remarks' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function attributes(): array
    {
        return [
            'weight_kg' => 'current weight',
            'confirmed_dose' => 'prescribed dose',
            'reviewed_by_name' => 'RHU personnel',
            'clinical_status' => 'clinical status',
            'symptoms' => 'symptoms / complaints',
        ];
    }
}
