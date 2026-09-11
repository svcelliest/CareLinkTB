<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('patients');
        Schema::dropIfExists('program_form_entries');

        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('program_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('patient_code', 80)->nullable();
            $table->string('name', 150);
            $table->date('date_of_birth')->nullable();
            $table->enum('sex', ['male', 'female'])->nullable();
            $table->string('contact_number', 40)->nullable();
            $table->text('address')->nullable();
            $table->boolean('presumptive')->default(false);
            $table->timestamps();

            $table->index('program_id');
        });

        // One record per patient covering both halves of the DOH SCDA form. The
        // form's own caption authorizes RHU personnel to edit both the collection
        // and diagnostic columns; ICM only has a read-only monitoring view. The
        // five result_* flags mirror the form's own result codes (DSSM/4, RR/5,
        // T/6, TT/7, TI/8) rather than a single enum, since a GeneXpert/DSSM read
        // can flag more than one at once and RR specifically routes to a
        // drug-resistant treatment pathway downstream.
        Schema::create('scda_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('checked_by')->nullable()->constrained('users');
            $table->boolean('collected')->nullable();
            $table->enum('not_collected_reason', [
                'no_rhu_staff_or_bhw', 'patient_refused', 'patient_absent', 'no_supplies', 'other',
            ])->nullable();
            $table->boolean('bhw_visit')->default(false);
            $table->boolean('needs_transport_subsidy')->default(false);
            $table->boolean('tested_with_gxpert')->default(false);
            $table->boolean('tested_with_dssm')->default(false);
            $table->boolean('result_dssm')->default(false);
            $table->boolean('result_rr')->default(false);
            $table->boolean('result_t')->default(false);
            $table->boolean('result_tt')->default(false);
            $table->boolean('result_ti')->default(false);
            $table->boolean('result_negative')->default(false);
            $table->string('registry_number', 40)->nullable();
            $table->text('remarks')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users');
            $table->timestamps();
        });

        // Only created for patients whose scda_records shows a positive result.
        // Outcome is one field, not a status + reason pair: it starts
        // 'for_validation' and stays there through the whole 6-month course; RHU
        // sets the real value either early (Mark Treatment Stopped) or after
        // Month 6 (Final Treatment Outcome) — it is never set automatically.
        Schema::create('treatment_enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('enrolled_by')->constrained('users');
            $table->date('enrolled_at');
            $table->string('case_number', 20)->nullable()->unique();
            $table->string('diagnosing_facility', 150)->nullable();
            $table->string('treatment_facility', 150)->nullable();
            $table->enum('registration_group', [
                'new', 'relapse', 'treatment_after_failure', 'treatment_after_loss_to_follow_up', 'other',
            ])->nullable();
            $table->enum('regimen_classification', ['dstb', 'drtb', 'presumptive'])->nullable();
            $table->enum('outcome', [
                'for_validation', 'completed', 'transferred', 'lost_to_follow_up', 'deceased', 'other',
            ])->default('for_validation');
            $table->date('outcome_date')->nullable();
            $table->text('outcome_remarks')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // One row per monthly monitoring visit (a standard course is 6). Columns
        // are grouped to match the real Monthly Monitoring form: who/when, clinical
        // vitals, dosing/adherence (+ optional interruption), adverse reaction
        // (+ detail), and lab/diagnostic monitoring (+ detail) — each "detail"
        // group is only meaningful when its own toggle is set.
        Schema::create('treatment_visits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('treatment_enrollment_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('month_number');
            $table->date('visit_date');
            $table->string('treatment_facility', 150)->nullable();
            $table->string('monitoring_staff_name', 150)->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users');

            $table->decimal('weight_kg', 5, 1)->nullable();
            $table->enum('clinical_assessment', ['stable', 'improving', 'worsening'])->nullable();
            $table->string('symptoms', 255)->nullable();
            $table->text('clinical_remarks')->nullable();

            $table->unsignedSmallInteger('doses_expected')->nullable();
            $table->unsignedSmallInteger('doses_taken')->nullable();
            $table->unsignedSmallInteger('missed_doses')->nullable();
            $table->enum('adherence_status', ['good', 'needs_follow_up'])->nullable();
            $table->string('missed_dose_reason', 255)->nullable();
            $table->text('adherence_remarks')->nullable();
            $table->boolean('treatment_interrupted')->default(false);
            $table->date('interruption_date')->nullable();
            $table->date('resumed_date')->nullable();
            $table->text('interruption_reason')->nullable();
            $table->text('interruption_followup')->nullable();

            $table->boolean('has_adverse_reaction')->default(false);
            $table->enum('reaction_type', [
                'nausea_vomiting', 'abdominal_discomfort', 'skin_reaction', 'visual_symptoms', 'hearing_symptoms', 'other',
            ])->nullable();
            $table->enum('reaction_severity', ['mild', 'moderate', 'severe'])->nullable();
            $table->string('reaction_action_taken', 255)->nullable();
            $table->text('reaction_remarks')->nullable();

            $table->enum('lab_test_type', [
                'xpert_mtb_rif', 'sputum_examination', 'culture', 'chest_xray', 'other',
            ])->nullable();
            $table->date('lab_test_date')->nullable();
            $table->enum('lab_result', ['negative', 'positive', 'pending'])->nullable();
            $table->text('lab_remarks')->nullable();

            $table->timestamps();

            $table->unique(['treatment_enrollment_id', 'month_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('treatment_visits');
        Schema::dropIfExists('treatment_enrollments');
        Schema::dropIfExists('scda_records');
        Schema::dropIfExists('patients');
    }
};
