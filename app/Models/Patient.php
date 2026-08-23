<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Patient extends Model
{
    use HasFactory;

    protected $fillable = [
        'program_id',
        'created_by',
        'form_type',
        'patient_code',
        'name',
        'age',
        'sex',
        'contact_number',
        'address',
        'status',
        'responses',
    ];

    protected function casts(): array
    {
        return [
            'age' => 'integer',
            'responses' => 'array',
        ];
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Whether this record flags a presumptive TB case, derived from the
     * form-specific responses (sputum diagnostic result vs. contact-tracing
     * case identification) rather than a separately stored status, so it
     * can never drift out of sync with the underlying answers.
     */
    public function isPresumptive(): bool
    {
        if ($this->form_type === 'sputum_collection') {
            return ($this->responses['diagnostic_result'] ?? null) === 'positive';
        }

        return ($this->responses['tb_case_identified'] ?? null) === '1';
    }
}
