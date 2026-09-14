<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('treatment_enrollments', function (Blueprint $table) {
            $table->decimal('baseline_weight', 5, 1)->nullable()->after('treatment_start_date');
        });
    }

    public function down(): void
    {
        Schema::table('treatment_enrollments', function (Blueprint $table) {
            $table->dropColumn('baseline_weight');
        });
    }
};
