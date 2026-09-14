<?php

namespace App\Http\Requests;

use App\Models\TreatmentMonitoringRecord;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMedicationDispensingRequest extends FormRequest
{
    public function authorize(): bool
    {
        $rhu = $this->user();
        if (! $rhu instanceof User || $rhu->role !== 'rhu') {
            return false;
        }

        $monitoring = $this->route('treatmentMonitoringRecord');

        return $monitoring instanceof TreatmentMonitoringRecord
            && $monitoring->treatmentEnrollment?->patient?->program?->location_id === $rhu->location_id;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'week_number' => [
                'required',
                'integer',
                'min:1',
                'max:5',
                Rule::unique('medication_dispensing_records', 'week_number')
                    ->where('treatment_monitoring_id', $this->route('treatmentMonitoringRecord')?->id),
            ],
            'dispensing_date' => ['required', 'date', 'before_or_equal:today'],
            'next_dispensing_date' => ['nullable', 'date', 'after:dispensing_date'],
            'remaining_tablets' => ['nullable', 'integer', 'min:0'],
            'doses_taken' => ['nullable', 'integer', 'min:0'],
            'side_effects' => ['nullable', 'array'],
            'side_effects.*' => ['string'],
            'side_effects_other' => ['nullable', 'string', 'max:255'],
        ];
    }
}
