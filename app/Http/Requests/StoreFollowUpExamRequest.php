<?php

namespace App\Http\Requests;

use App\Models\FollowUpExam;
use App\Models\TreatmentEnrollment;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFollowUpExamRequest extends FormRequest
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
            'month_number' => [
                'required',
                'integer',
                Rule::unique('follow_up_exams', 'month_number')
                    ->where('treatment_enrollment_id', $this->route('treatmentEnrollment')?->id),
                function (string $attribute, mixed $value, Closure $fail): void {
                    /** @var TreatmentEnrollment $enrollment */
                    $enrollment = $this->route('treatmentEnrollment');
                    $dueMonths = $enrollment->followUpExamScheduleMonths();

                    if (! in_array((int) $value, $dueMonths, true)) {
                        $fail('This month is not due for a follow-up exam under the patient\'s current diagnosis.');
                    }
                },
            ],
            'collected' => ['nullable', 'boolean'],
            'collection_date' => ['required', 'date', 'before_or_equal:today'],
            'result_date' => ['required', 'date', 'after_or_equal:collection_date', 'before_or_equal:today'],
            'result' => ['required', Rule::in(FollowUpExam::RESULTS)],
            'afb_count' => ['nullable', 'string', 'max:60'],
            'remarks' => ['nullable', 'string'],
        ];
    }
}
