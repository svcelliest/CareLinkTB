<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_tracing_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->unique()->constrained()->cascadeOnDelete();

            $table->date('visit_date')->nullable();
            $table->enum('contact_method', ['call', 'home_visit'])->nullable();
            $table->boolean('rhu_contacted')->default(false);
            $table->boolean('started_medication')->default(false);
            $table->boolean('has_accompaniment')->default(false);

            $table->unsignedSmallInteger('household_count')->nullable();
            $table->unsignedSmallInteger('household_symptoms_count')->nullable();
            $table->unsignedSmallInteger('household_tb_count')->nullable();
            $table->boolean('household_taking_medication')->default(false);
            $table->boolean('referral_cards_given')->default(false);

            $table->unsignedSmallInteger('tpt_total')->nullable();
            $table->unsignedSmallInteger('tpt_0_4')->nullable();
            $table->unsignedSmallInteger('tpt_5_14')->nullable();
            $table->unsignedSmallInteger('tpt_15_plus')->nullable();
            // Matches the fixed reason dropdown in the RHU Contact Tracing
            // mockup (.claude/rhu_portal.html), not free text.
            $table->enum('tpt_not_enrolled_reason', [
                'contact_of_cd_patient', 'rhu_not_providing_tpt', 'contact_refused_tpt', 'negative_cxr', 'other',
            ])->nullable();
            $table->string('enumerator_name', 150)->nullable();
            $table->boolean('tb_case_identified')->default(false);
            $table->boolean('contact_enrolled_treatment')->default(false);
            $table->unsignedSmallInteger('contacts_enrolled_tpt')->nullable();
            $table->text('remarks')->nullable();

            $table->foreignId('recorded_by')->nullable()->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_tracing_records');
    }
};
