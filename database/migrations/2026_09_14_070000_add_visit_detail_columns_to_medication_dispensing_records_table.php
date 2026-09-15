<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medication_dispensing_records', function (Blueprint $table) {
            // Week 0 marks the release made at enrollment; 1-4 are the
            // weekly returns. Ported from the medjofinal reference's
            // TreatmentDispensingRecord.
            $table->boolean('is_initial')->default(false)->after('week_number');

            // The dose actually used at THIS visit — distinct from the
            // month's prescribed_dose on treatment_monitoring_records, so a
            // later dose change never retroactively recalculates medicine
            // already handed over at an earlier visit.
            $table->unsignedTinyInteger('dose')->nullable()->after('next_dispensing_date');
            $table->unsignedSmallInteger('weekly_supply')->nullable()->after('dose');

            $table->unsignedSmallInteger('doses_missed')->default(0)->after('doses_taken');
            $table->string('missed_reason', 150)->nullable()->after('doses_missed');
            $table->string('missed_intervention', 150)->nullable()->after('missed_reason');

            $table->string('side_effect_severity', 30)->nullable()->after('side_effects_other');
            $table->string('side_effect_action', 255)->nullable()->after('side_effect_severity');
            $table->boolean('side_effect_referred')->default(false)->after('side_effect_action');

            $table->json('problems')->nullable()->after('side_effect_referred');
            $table->string('problem_action', 255)->nullable()->after('problems');
            $table->date('problem_followup_on')->nullable()->after('problem_action');

            $table->text('remarks')->nullable()->after('problem_followup_on');
        });
    }

    public function down(): void
    {
        Schema::table('medication_dispensing_records', function (Blueprint $table) {
            $table->dropColumn([
                'is_initial',
                'dose',
                'weekly_supply',
                'doses_missed',
                'missed_reason',
                'missed_intervention',
                'side_effect_severity',
                'side_effect_action',
                'side_effect_referred',
                'problems',
                'problem_action',
                'problem_followup_on',
                'remarks',
            ]);
        });
    }
};
