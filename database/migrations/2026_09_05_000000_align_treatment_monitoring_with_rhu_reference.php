<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Brings the treatment schema up to what the RHU reference's Treatment
 * Monitoring actually records.
 *
 * The first pass modelled a treatment month as one row: a monthly review with
 * adherence and a follow-up examination folded into it. The reference works at
 * three different cadences, so those cannot share a row:
 *
 *   · the CLINICAL REVIEW is monthly — weight, prescribed dose, status;
 *   · MEDICATION DISPENSING is weekly — four visits inside each month, each
 *     with its own tablet count, adherence, side effects and difficulties;
 *   · FOLLOW-UP EXAMINATIONS are scheduled at fixed months (2/5/6 for a
 *     bacteriologically confirmed case, month 2 otherwise) and exist as a
 *     schedule from enrolment, before any result is recorded.
 *
 * So dispensing and follow-ups move to their own tables, and the columns that
 * modelled them on the monthly row are dropped — after their data is copied
 * across, so nothing recorded so far is lost.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('treatment_cases', function (Blueprint $table) {
            // The weight the dose band is first derived from, captured at the
            // first monthly review and then held for the life of the case.
            $table->decimal('baseline_weight', 5, 1)->nullable()->after('assigned_provider');

            // "Bacteriologically Confirmed" / "Clinically Diagnosed" — decides
            // the follow-up examination schedule, so it is stored on the case
            // rather than re-derived from the patient's register row, which the
            // ICM can still edit afterwards.
            $table->string('enrolled_as', 60)->nullable()->after('baseline_weight');
        });

        Schema::create('treatment_followups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('treatment_case_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();

            $table->unsignedTinyInteger('month');
            $table->date('due_date');

            $table->boolean('collected')->default(false);
            $table->date('collection_date')->nullable();
            $table->date('result_date')->nullable();
            $table->string('smear_result', 30)->nullable();
            $table->string('afb_count', 60)->nullable();
            $table->text('remarks')->nullable();

            $table->timestamps();

            $table->unique(['treatment_case_id', 'month']);
        });

        Schema::create('treatment_dispensing_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('treatment_case_id')->constrained()->cascadeOnDelete();
            $table->foreignId('recorded_by')->constrained('users')->cascadeOnDelete();

            $table->unsignedTinyInteger('month');
            // 0 marks the release made at enrolment; 1–4 are the weekly returns.
            $table->unsignedTinyInteger('week')->default(0);
            $table->boolean('is_initial')->default(false);

            $table->date('dispensed_on');
            $table->date('next_dispensing_on')->nullable();

            $table->unsignedTinyInteger('dose');
            $table->unsignedSmallInteger('weekly_supply');
            // Tablets counted back at the return visit; null when not counted.
            $table->unsignedSmallInteger('remaining_tablets')->nullable();

            $table->unsignedSmallInteger('doses_taken')->default(0);
            $table->unsignedSmallInteger('doses_missed')->default(0);
            $table->string('missed_reason', 150)->nullable();
            $table->string('missed_intervention', 150)->nullable();

            $table->json('side_effects')->nullable();
            $table->string('side_effect_severity', 30)->nullable();
            $table->string('side_effect_action', 255)->nullable();
            $table->boolean('side_effect_referred')->default(false);

            $table->json('problems')->nullable();
            $table->string('problem_action', 255)->nullable();
            $table->date('problem_followup_on')->nullable();

            $table->text('remarks')->nullable();

            $table->timestamps();

            $table->index(['treatment_case_id', 'month', 'week']);
        });

        Schema::create('treatment_contact_tracings', function (Blueprint $table) {
            $table->id();
            // One ACF report per case; the form is saved then edited in place.
            $table->foreignId('treatment_case_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('recorded_by')->constrained('users')->cascadeOnDelete();

            // 1. ACF Activity
            $table->string('patient_address', 255)->nullable();
            $table->date('acf_date')->nullable();
            $table->string('province', 100)->nullable();
            $table->string('municipality', 100)->nullable();
            $table->string('community', 100)->nullable();
            $table->string('registry_no', 60)->nullable();
            $table->string('phone', 40)->nullable();

            // 2. Patient Follow-up
            $table->date('visit_date')->nullable();
            $table->string('visit_type', 20)->nullable();
            $table->string('rhu_contacted', 10)->nullable();
            $table->string('started_medication', 10)->nullable();
            $table->string('accompaniment', 10)->nullable();

            // 3. Household Assessment
            $table->unsignedSmallInteger('household_total')->default(0);
            $table->unsignedSmallInteger('household_symptoms')->default(0);
            $table->unsignedSmallInteger('household_tb')->default(0);
            $table->string('household_taking_meds', 20)->nullable();
            $table->string('referral_cards', 10)->nullable();
            $table->unsignedSmallInteger('tpt_total')->default(0);

            // 4. TPT Enrollment
            $table->unsignedSmallInteger('tpt_0_to_4')->default(0);
            $table->unsignedSmallInteger('tpt_5_to_14')->default(0);
            $table->unsignedSmallInteger('tpt_15_plus')->default(0);
            $table->string('tpt_reason', 60)->nullable();
            $table->string('enumerator', 150)->nullable();

            $table->timestamps();
        });

        // Carry any follow-up already recorded on a monthly row into its own
        // row before the columns go, so no result is lost to the restructure.
        if (Schema::hasColumn('treatment_monitoring_entries', 'followup_collected')) {
            DB::table('treatment_monitoring_entries')
                ->where('followup_collected', true)
                ->orderBy('id')
                ->each(function ($entry): void {
                    DB::table('treatment_followups')->insert([
                        'treatment_case_id' => $entry->treatment_case_id,
                        'recorded_by' => $entry->recorded_by,
                        'month' => $entry->month,
                        'due_date' => $entry->followup_collection_date
                            ?? $entry->review_date
                            ?? now()->toDateString(),
                        'collected' => true,
                        'collection_date' => $entry->followup_collection_date,
                        'result_date' => $entry->followup_collection_date,
                        'smear_result' => $entry->followup_smear_result,
                        'afb_count' => $entry->followup_afb_grade,
                        'remarks' => $entry->followup_remarks,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                });
        }

        Schema::table('treatment_monitoring_entries', function (Blueprint $table) {
            // The reference's Monthly Clinical Review: who reviewed, the dose
            // they confirmed, and whether the review has been saved (a saved
            // review locks until "Edit Review" is pressed).
            $table->string('reviewed_by_name', 150)->nullable()->after('recorded_by');
            $table->unsignedTinyInteger('confirmed_dose')->nullable()->after('weight_kg');
            $table->timestamp('saved_at')->nullable()->after('remarks');

            // Adherence and side effects are per dispensing visit, and
            // follow-ups have their own schedule — both now live in the tables
            // created above.
            $table->dropColumn([
                'doses_expected',
                'doses_taken',
                'adherence_remarks',
                'adverse_reactions',
                'adverse_severity',
                'adverse_referred',
                'followup_collected',
                'followup_collection_date',
                'followup_smear_result',
                'followup_afb_grade',
                'followup_remarks',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('treatment_monitoring_entries', function (Blueprint $table) {
            $table->dropColumn(['reviewed_by_name', 'confirmed_dose', 'saved_at']);

            $table->unsignedSmallInteger('doses_expected')->nullable();
            $table->unsignedSmallInteger('doses_taken')->nullable();
            $table->text('adherence_remarks')->nullable();
            $table->text('adverse_reactions')->nullable();
            $table->string('adverse_severity', 30)->nullable();
            $table->boolean('adverse_referred')->default(false);
            $table->boolean('followup_collected')->default(false);
            $table->date('followup_collection_date')->nullable();
            $table->string('followup_smear_result', 30)->nullable();
            $table->string('followup_afb_grade', 30)->nullable();
            $table->text('followup_remarks')->nullable();
        });

        Schema::dropIfExists('treatment_contact_tracings');
        Schema::dropIfExists('treatment_dispensing_records');
        Schema::dropIfExists('treatment_followups');

        Schema::table('treatment_cases', function (Blueprint $table) {
            $table->dropColumn(['baseline_weight', 'enrolled_as']);
        });
    }
};
