<?php

namespace App\Http\Requests;

use App\Rules\WithinProgramHours;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Override;

class StoreProgramRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->role === 'icm';
    }

    #[Override]
    protected function prepareForValidation()
    {
        $this->merge([
            'name' => trim((string)$this->input('name')),
        ]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150'],
            'location_id' => [
                'required',
                Rule::exists('locations', 'id')->where('level', 'municipality')
            ],
            'date' => ['required', 'date_format:Y-m-d'],
            'time' => ['required', 'date_format:H:i', new WithinProgramHours()],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'date' => 'program date',
            'time' => 'program time',
        ];
    }

    /**
     * The columns to persist. `date` and `time` are the wall-clock values the
     * coordinator picked, in Asia/Manila — explicitly interpreted as such
     * here (rather than composing a JS `Date`, which drags in whichever
     * timezone the browser happens to be running in) and converted to UTC for
     * storage, so a program created at 9:00 AM always displays back as
     * 9:00 AM (see ProgramController::scheduleLabels(), which converts the
     * other way for display).
     *
     * @return array<string, mixed>
     */
    public function programAttributes(): array
    {
        return [
            'name' => $this->validated('name'),
            'location_id' => $this->validated('location_id'),
            'scheduled_at' => Carbon::createFromFormat(
                'Y-m-d H:i',
                $this->validated('date').' '.$this->validated('time'),
                'Asia/Manila',
            )->utc(),
        ];
    }
}
