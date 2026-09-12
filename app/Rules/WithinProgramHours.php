<?php

namespace App\Rules;

use App\Models\Program;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Programs are field activities staffed by RHU and provider teams, so they may
 * only be scheduled inside the working window declared on the Program model.
 *
 * The rule reads a wall-clock `H:i` string rather than a datetime on purpose:
 * `scheduled_at` is stored as the local time the coordinator picked, and
 * re-parsing it as a datetime would drag the application timezone into a
 * comparison that is only ever about the hands on the clock.
 */
class WithinProgramHours implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || preg_match('/^([01]\d|2[0-3]):([0-5]\d)$/', $value, $matches) !== 1) {
            // Shape errors belong to the `date_format` rule alongside this one.
            return;
        }

        $minutes = ((int) $matches[1] * 60) + (int) $matches[2];

        if ($minutes < Program::EARLIEST_MINUTES || $minutes > Program::LATEST_MINUTES) {
            $fail('The program time must be between :earliest and :latest.')->translate([
                'earliest' => Program::earliestTimeLabel(),
                'latest' => Program::latestTimeLabel(),
            ]);
        }
    }
}
