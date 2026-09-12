<?php

namespace App\Http\Requests\Rhu;

use App\Models\TreatmentDispensingRecord;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * One weekly medication dispensing visit.
 *
 * The dose is not accepted from the browser: it is the dose confirmed on the
 * month's clinical review, read server-side at save time. That is the whole
 * point of requiring the review first — the prescription is a clinical decision
 * recorded once, not something re-typed at every dispensing.
 */
class StoreDispensingRecordRequest extends FormRequest
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
            'dispensed_on' => ['required', 'date'],
            // The return date must be after the visit that schedules it.
            // Accepted but not used: the next dispensing date is always one
            // pickup cycle after the dispensing date and is set server-side.
            'next_dispensing_on' => ['nullable', 'date'],

            // A count of a 28-tablet strip; never more than one strip.
            'remaining_tablets' => [
                'nullable',
                'integer',
                'min:0',
                'max:'.TreatmentDispensingRecord::STRIP_TABLETS,
            ],
            'doses_taken' => ['nullable', 'integer', 'min:0', 'max:400'],

            'missed_reason' => ['nullable', 'string', 'max:150'],
            'missed_intervention' => ['nullable', 'string', 'max:150'],

            // The form now asks Yes / No / Other and, for Other, what the
            // effect was. Stored as before in the `side_effects` array: empty
            // for No, ["Yes"] for Yes, or the text the RHU typed. Older records
            // still carry checklist wording, which stays valid here so a past
            // visit can be reopened and re-saved unchanged.
            'side_effects' => ['nullable', 'array', 'max:10'],
            'side_effects.*' => ['string', 'max:150'],
            'side_effect_severity' => ['nullable', Rule::in(TreatmentDispensingRecord::SEVERITIES)],
            'side_effect_action' => ['nullable', 'string', 'max:255'],
            'side_effect_referred' => ['sometimes', 'boolean'],

            'problems' => ['nullable', 'array'],
            'problems.*' => [Rule::in(TreatmentDispensingRecord::PROBLEMS)],
            'problem_action' => ['nullable', 'string', 'max:255'],
            'problem_followup_on' => ['nullable', 'date'],

            'remarks' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function attributes(): array
    {
        return [
            'dispensed_on' => 'dispensing date',
            'next_dispensing_on' => 'next dispensing date',
            'remaining_tablets' => 'remaining tablets',
            'doses_taken' => 'doses taken',
            'side_effect_severity' => 'severity',
            'side_effect_action' => 'action taken',
            'problem_action' => 'action taken',
            'problem_followup_on' => 'follow-up date',
        ];
    }
}
