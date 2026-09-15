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

    /**
     * The enrollment episode currently in force — the still-open one if
     * there is one, otherwise whichever was enrolled most recently. A
     * patient can have more than one over time (e.g. a relapse), so this
     * picks the one everything else (Contact Tracing's defaults, etc.)
     * should read from when it needs "the" enrollment for this patient.
     */
    public function currentTreatmentEnrollment(): ?TreatmentEnrollment
    {
        return $this->treatmentEnrollments()
            ->whereNull('outcome')
            ->latest('treatment_start_date')
            ->first()
            ?? $this->treatmentEnrollments()->latest('treatment_start_date')->first();
    }

    public function sputumCollection(): HasOne
    {
        return $this->hasOne(SputumCollection::class);
    }

    public function diagnosticAssessment(): HasOne
    {
        return $this->hasOne(DiagnosticAssessment::class);
    }

    public function contactTracingRecord(): HasOne
    {
        return $this->hasOne(ContactTracingRecord::class);
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

    /**
     * The ACF Activity fields as the system already knows them, ported from
     * the medjofinal reference's `acfDefaults()` — computed live, never
     * stored on contact_tracing_records, so it can never drift from the
     * patient/program/enrollment rows it's read from.
     *
     * Improvement over the reference: province/municipality prefer the
     * program's actual location relation (a real FK) over re-parsing the
     * free-text address, falling back to the address split only when no
     * program/location is set.
     *
     * @return array<string, string|null>
     */
    public function acfDefaults(): array
    {
        $program = $this->program;
        $address = $this->address ?? '';

        // Stored as "Barangay/Sitio, Municipality, Province"; a shorter
        // address simply leaves the trailing levels blank.
        $parts = array_map('trim', explode(',', $address));

        $location = $program?->location;
        $municipality = $location?->level === 'municipality' ? $location->name : null;
        $province = $location?->level === 'municipality' ? $location->parent?->name : null;

        $enrollment = $this->currentTreatmentEnrollment();

        return [
            'patient_address' => $address ?: null,
            'acf_date' => $program?->scheduled_at?->toDateString(),
            'province' => $province ?? ($parts[2] ?? null),
            'municipality' => $municipality ?? ($parts[1] ?? null),
            'community' => $parts[0] ?? null,
            'registry_no' => $enrollment?->registry_number,
            'phone' => $this->contact_number,
        ];
    }
}
