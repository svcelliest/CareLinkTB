<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Patient extends Model
{
    use HasFactory;

    protected $fillable = [
        'program_id',
        'created_by',
        'patient_code',
        'name',
        'date_of_birth',
        'sex',
        'contact_number',
        'address',
        'presumptive',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'presumptive' => 'boolean',
        ];
    }

    protected function age(): Attribute
    {
        return Attribute::get(fn() => $this->date_of_birth?->age);
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scdaRecord(): HasOne
    {
        return $this->hasOne(ScdaRecord::class);
    }

    public function contactTracingRecord(): HasOne
    {
        return $this->hasOne(ContactTracingRecord::class);
    }

    public function treatmentEnrollment(): HasOne
    {
        return $this->hasOne(TreatmentEnrollment::class);
    }
    public function isPresumptive(): bool
    {
        return (bool) $this->presumptive;
    }
}
