<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per treatment month of a case: the monthly clinical review plus the
 * sputum follow-up examination that falls in that month.
 *
 * The follow-up columns live here rather than in a third table because the
 * schedule is monthly on both sides — a follow-up is always "the DSSM taken in
 * month N" — so a separate table would carry the same (case, month) key and
 * force a join on every read of the record.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('treatment_monitoring_entries', function (Blueprint $table) {
            $table->id();

            $table->foreignId('treatment_case_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recorded_by')->constrained('users')->cascadeOnDelete();

            // 1–6 for the standard regimen. Bounded by the form request rather
            // than the column so a longer drug-resistant regimen does not need
            // a schema change.
            $table->unsignedTinyInteger('month');

            // Monthly clinical review.
            $table->date('review_date')->nullable();
            $table->decimal('weight_kg', 5, 1)->nullable();
            $table->string('clinical_status', 40)->nullable();
            $table->text('symptoms')->nullable();

            // Adherence. Doses expected/taken are what "missed" is derived
            // from, so it is not stored separately.
            $table->unsignedSmallInteger('doses_expected')->nullable();
            $table->unsignedSmallInteger('doses_taken')->nullable();
            $table->text('adherence_remarks')->nullable();

            // Adverse drug reactions.
            $table->text('adverse_reactions')->nullable();
            $table->string('adverse_severity', 30)->nullable();
            $table->boolean('adverse_referred')->default(false);

            // Sputum / DSSM follow-up examination due in this month.
            $table->boolean('followup_collected')->default(false);
            $table->date('followup_collection_date')->nullable();
            $table->string('followup_smear_result', 30)->nullable();
            $table->string('followup_afb_grade', 30)->nullable();
            $table->text('followup_remarks')->nullable();

            $table->text('remarks')->nullable();

            $table->timestamps();

            // A month is recorded once and then edited in place.
            $table->unique(['treatment_case_id', 'month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('treatment_monitoring_entries');
    }
};
