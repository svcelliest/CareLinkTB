<?php

namespace App\Http\Requests;

/**
 * Editing a program is the same shape as creating one, including the 8:00 AM
 * to 5:00 PM window, so the rules are inherited rather than restated.
 */
class UpdateProgramRequest extends StoreProgramRequest
{
}
