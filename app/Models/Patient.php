<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Patient extends Model
{
    use HasFactory;

    protected $fillable = [
        'program_id',
        'created_by',
        'form_type',
        'patient_code',
        'name',
        'date_of_birth',
        'sex',
        'contact_number',
        'address',
        'status',
        'responses',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'responses' => 'array',
        ];
    }

    /**
     * Age is never stored — it's derived from date_of_birth on every read
     * so it can't go stale between registration and whenever it's viewed.
     */
    protected function age(): Attribute
    {
        return Attribute::get(function () {
            if (! $this->date_of_birth) {
                return null;
            }

            return $this->date_of_birth->age;
        });
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function treatmentEnrollments(): HasMany
    {
        return $this->hasMany(TreatmentEnrollment::class);
    }

    public function sputumCollection(): HasOne
    {
        return $this->hasOne(SputumCollection::class);
    }

    public function diagnosticAssessment(): HasOne
    {
        return $this->hasOne(DiagnosticAssessment::class);
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

        if ($this->form_type === 'provider_screening') {
            return (bool) ($this->responses['presumptive'] ?? false);
        }

        return ($this->responses['tb_case_identified'] ?? null) === '1';
    }
}
