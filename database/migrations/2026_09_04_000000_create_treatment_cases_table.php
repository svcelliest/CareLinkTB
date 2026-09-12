<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The TB treatment case opened when an RHU enrols a diagnosed patient.
 *
 * Nothing in the schema recorded treatment before this: `patients` holds one
 * screening row per program — a point-in-time intake with a `responses`
 * document — while a treatment case is a longitudinal record that outlives the
 * program it was found in and carries its own register number, regimen and
 * outcome. Folding it into `patients.responses` would mean re-writing the
 * ICM-owned document on every RHU monitoring visit, which is exactly the
 * ownership boundary the portal is meant to keep.
 *
 * The patient is referenced, never copied: name, address and diagnostic result
 * are read back through the relation so a case can never drift from the record
 * it was opened from.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('treatment_cases', function (Blueprint $table) {
            $table->id();

            // One open case per patient is enforced in the controller (a closed
            // case may be followed by a re-treatment), so this is a plain index.
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('enrolled_by')->constrained('users')->cascadeOnDelete();

            // The register number. Unique for the life of the table and never
            // reused — see TreatmentCase::allocateCaseNumber().
            $table->string('case_number', 20)->unique();

            // The municipality that owns this case, resolved from the patient's
            // address at enrolment. Stored rather than derived so authorization
            // stays a column comparison and cannot be moved by a later edit to
            // the patient's address.
            $table->string('municipality', 100)->nullable()->index();

            $table->date('registration_date');
            $table->string('registration_group', 60);
            $table->string('regimen', 120);
            $table->date('treatment_start_date');
            $table->string('assigned_provider', 150);

            $table->string('treatment_facility', 150)->nullable();
            $table->string('diagnostic_facility', 150)->nullable();

            // Set only at case closure. Null means the case is still on
            // treatment, which is the one thing the patient list filters on.
            $table->string('outcome', 40)->nullable();
            $table->date('outcome_date')->nullable();
            $table->text('outcome_remarks')->nullable();
            $table->timestamp('closed_at')->nullable();

            $table->timestamps();

            // A TB register entry is never destroyed, and the case number must
            // never be handed out again. Soft-deleting is what makes both true:
            // the row stays, so the number stays taken.
            $table->softDeletes();

            $table->index(['municipality', 'outcome']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('treatment_cases');
    }
};
