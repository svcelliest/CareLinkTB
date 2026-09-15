<?php

namespace App\Http\Requests;

use App\Models\MedicationDispensingRecord;
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
            // 0 marks the release made at enrollment; 1-4 are the weekly
            // returns.
            'week_number' => [
                'required',
                'integer',
                'min:0',
                'max:4',
                Rule::unique('medication_dispensing_records', 'week_number')
                    ->where('treatment_monitoring_id', $this->route('treatmentMonitoringRecord')?->id),
            ],
            'is_initial' => ['boolean'],
            'dispensing_date' => ['required', 'date', 'before_or_equal:today'],
            'next_dispensing_date' => ['nullable', 'date', 'after:dispensing_date'],
            'dose' => ['nullable', Rule::in(MedicationDispensingRecord::DOSES)],
            'weekly_supply' => ['nullable', 'integer', 'min:0', 'max:'.MedicationDispensingRecord::STRIP_TABLETS],
            'remaining_tablets' => ['nullable', 'integer', 'min:0'],
            'doses_taken' => ['nullable', 'integer', 'min:0'],
            'doses_missed' => ['nullable', 'integer', 'min:0'],
            'missed_reason' => ['nullable', 'string', 'max:150'],
            'missed_intervention' => ['nullable', 'string', 'max:150'],
            'side_effects' => ['nullable', 'array'],
            'side_effects.*' => [Rule::in(MedicationDispensingRecord::SIDE_EFFECTS)],
            'side_effects_other' => ['nullable', 'string', 'max:255'],
            'side_effect_severity' => ['nullable', Rule::in(MedicationDispensingRecord::SEVERITIES)],
            'side_effect_action' => ['nullable', 'string', 'max:255'],
            'side_effect_referred' => ['boolean'],
            'problems' => ['nullable', 'array'],
            'problems.*' => [Rule::in(MedicationDispensingRecord::PROBLEMS)],
            'problem_action' => ['nullable', 'string', 'max:255'],
            'problem_followup_on' => ['nullable', 'date'],
            'remarks' => ['nullable', 'string'],
        ];
    }
}
