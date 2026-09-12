<?php

namespace App\Http\Requests\Rhu;

use App\Models\Patient;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The Diagnostic Assessment tab of the Patient Tracker.
 *
 * Only the RHU-owned diagnostic columns are declared. The ICM's sputum answers
 * are not validated here because they are not accepted here at all — the
 * controller merges an explicit allow-list, so an unexpected key never reaches
 * the record even if it passes validation.
 */
class UpdateDiagnosticAssessmentRequest extends FormRequest
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
            'patients' => ['required', 'array', 'max:500'],

            // Existence only — whether this RHU may touch the row is decided
            // by RhuScope in the controller, not by a rule the payload could
            // satisfy on its own.
            'patients.*.id' => ['required', 'integer', Rule::exists('patients', 'id')],

            'patients.*.sputum_collected' => ['nullable', Rule::in(['', '0', '1'])],
            'patients.*.not_collected_reason' => ['nullable', 'string', 'max:255'],
            'patients.*.tested_gene_xpert' => ['nullable', Rule::in(['', '0', '1'])],
            'patients.*.tested_dssm' => ['nullable', Rule::in(['', '0', '1'])],
            'patients.*.diagnostic_result' => ['nullable', Rule::in(['', 'positive', 'negative'])],
            'patients.*.positive_classification' => [
                'nullable',
                Rule::in(['', ...Patient::POSITIVE_CLASSIFICATIONS]),
            ],
            'patients.*.tb_case_classification' => [
                'nullable',
                Rule::in(['', ...Patient::CONFIRMED_DIAGNOSES, 'none']),
            ],
            'patients.*.diagnostic_remarks' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function attributes(): array
    {
        return [
            'patients.*.sputum_collected' => 'sputum collected',
            'patients.*.not_collected_reason' => 'reason not collected',
            'patients.*.tested_gene_xpert' => 'GXpert test',
            'patients.*.tested_dssm' => 'DSSM test',
            'patients.*.diagnostic_result' => 'diagnostic result',
            'patients.*.positive_classification' => 'positive classification',
            'patients.*.tb_case_classification' => 'TB diagnosis',
            'patients.*.diagnostic_remarks' => 'remarks',
        ];
    }
}
