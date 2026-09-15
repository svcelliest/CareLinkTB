<?php

namespace App\Http\Requests;

use App\Models\TreatmentEnrollment;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreTreatmentMonitoringRequest extends FormRequest
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
            // No uniqueness rule — a resubmit for the current month is a
            // valid "Edit Review" upsert, not a duplicate. The controller's
            // own locking guards (current-month-only) are the real
            // protection against overwriting a completed month.
            'month_number' => [
                'required',
                'integer',
                'min:1',
                function (string $attribute, mixed $value, Closure $fail): void {
                    /** @var TreatmentEnrollment $enrollment */
                    $enrollment = $this->route('treatmentEnrollment');
                    $monthCount = $enrollment->regimenMonthCount();

                    if ($monthCount === null) {
                        $fail('This regimen has no defined treatment duration yet, so a month cannot be recorded.');

                        return;
                    }

                    if ((int) $value > $monthCount) {
                        $fail("This enrollment's regimen only runs for {$monthCount} months.");
                    }
                },
            ],
            'current_weight' => ['nullable', 'numeric', 'min:0', 'max:999.9'],
            'prescribed_dose' => ['nullable', 'integer', 'min:0', 'max:255'],
            'clinical_status' => ['nullable', 'string', 'max:40'],
            'remarks' => ['nullable', 'string'],
        ];
    }
}
