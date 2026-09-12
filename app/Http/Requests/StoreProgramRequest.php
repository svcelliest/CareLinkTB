<?php

namespace App\Http\Requests;

use App\Rules\WithinProgramHours;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
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

    /**
     * The schedule arrives as the two wall-clock fields the coordinator filled
     * in (`date` + `time`). Composing `scheduled_at` here — rather than in the
     * browser — is what keeps the stored time equal to the picked time: the
     * value never passes through a JavaScript `Date`, so no timezone offset is
     * ever applied to it. Callers that post a single `scheduled_at` are split
     * back into the same two fields so one set of rules covers both shapes and
     * the out-of-hours error lands on the input the user actually touched.
     */
    #[Override]
    protected function prepareForValidation(): void
    {
        $date = trim((string) $this->input('date', ''));
        $time = trim((string) $this->input('time', ''));
        $scheduledAt = trim((string) $this->input('scheduled_at', ''));

        if ($date !== '' || $time !== '') {
            $scheduledAt = trim("{$date} {$time}");
        } elseif ($scheduledAt !== '') {
            $parsed = $this->parseWallClock($scheduledAt);

            if ($parsed !== null) {
                $date = $parsed->format('Y-m-d');
                $time = $parsed->format('H:i');
            }
        }

        $this->merge([
            'name' => trim((string) $this->input('name')),
            'location' => trim((string) $this->input('location')),
            'date' => $date,
            'time' => $time,
            'scheduled_at' => $scheduledAt,
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
            'location' => ['required', 'string', 'max:255'],
            'date' => ['required', 'date_format:Y-m-d'],
            'time' => ['required', 'date_format:H:i', new WithinProgramHours()],
            'scheduled_at' => ['required', 'date'],
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
     * The columns to persist. `date` and `time` are validation-only inputs, so
     * they are deliberately left out of what reaches the model.
     *
     * @return array<string, string>
     */
    public function programAttributes(): array
    {
        return [
            'name' => $this->validated('name'),
            'location' => $this->validated('location'),
            'scheduled_at' => $this->validated('date').' '.$this->validated('time').':00',
        ];
    }

    private function parseWallClock(string $value): ?CarbonImmutable
    {
        try {
            return CarbonImmutable::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }
}
