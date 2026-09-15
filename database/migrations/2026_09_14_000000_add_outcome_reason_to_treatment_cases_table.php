<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The Treatment Outcome form now asks for a reason when a case is closed as
 * Died or Lost to Follow Up. It is its own column rather than folded into
 * `outcome_remarks`, which stays the free-text note it always was.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('treatment_cases', function (Blueprint $table) {
            $table->string('outcome_reason', 255)->nullable()->after('outcome_date');
        });
    }

    public function down(): void
    {
        Schema::table('treatment_cases', function (Blueprint $table) {
            $table->dropColumn('outcome_reason');
        });
    }
};
