<?php

namespace App\Http\Requests;

use App\Models\Patient;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDiagnosticAssessmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $rhu = $this->user();
        if (! $rhu instanceof User || $rhu->role !== 'rhu') {
            return false;
        }

        $patient = $this->route('patient');

        return $patient instanceof Patient
            && $patient->program?->location_id === $rhu->location_id;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'tested_with_gxpert' => ['boolean'],
            'tested_with_dssm' => ['boolean'],
            'result_dssm' => ['boolean'],
            'result_rr' => ['boolean'],
            'result_t' => ['boolean'],
            'result_tt' => ['boolean'],
            'result_ti' => ['boolean'],
            'result_negative' => ['boolean'],
            'tb_diagnosis' => ['nullable', Rule::in(['dstb_cd', 'dstb_bc', 'rrtb_bc'])],
            'remarks' => ['nullable', 'string'],
        ];
    }
}
