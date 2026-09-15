<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Replaces the placeholder 'standard_dstb' value with the 4 real
        // DOH NTP regimen categories (each maps to a fixed treatment
        // duration for Treatment Monitoring); 'drug_resistant' is kept
        // as-is for actual RR-TB (rrtb_bc) diagnoses.
        if (DB::connection()->getDriverName() === 'sqlite') {
            Schema::table('treatment_enrollments', function (Blueprint $table) {
                $table->dropColumn('treatment_regimen');
            });
            Schema::table('treatment_enrollments', function (Blueprint $table) {
                $table->enum('treatment_regimen', [
                    'category_1_new',
                    'category_2_retreatment',
                    'category_3_new_ep',
                    'category_4_retreatment_ep',
                    'drug_resistant',
                ]);
            });

            return;
        }

        DB::statement("
            ALTER TABLE treatment_enrollments
            MODIFY treatment_regimen ENUM(
                'category_1_new',
                'category_2_retreatment',
                'category_3_new_ep',
                'category_4_retreatment_ep',
                'drug_resistant'
            ) NOT NULL
        ");
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            Schema::table('treatment_enrollments', function (Blueprint $table) {
                $table->dropColumn('treatment_regimen');
            });
            Schema::table('treatment_enrollments', function (Blueprint $table) {
                $table->enum('treatment_regimen', ['standard_dstb', 'drug_resistant']);
            });

            return;
        }

        DB::statement("
            ALTER TABLE treatment_enrollments
            MODIFY treatment_regimen ENUM('standard_dstb', 'drug_resistant') NOT NULL
        ");
    }
};
