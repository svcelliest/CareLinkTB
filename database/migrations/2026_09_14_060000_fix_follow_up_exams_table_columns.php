<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('follow_up_exams', function (Blueprint $table) {
            $table->renameColumn('performed_date', 'collection_date');
        });

        Schema::table('follow_up_exams', function (Blueprint $table) {
            $table->date('result_date')->after('collection_date');
        });

        // Real WHO/IUATLD AFB smear grading scale, per the actual RHU
        // mockup's "Smear Result" dropdown — not the simplified
        // negative/positive/not_done placeholder from the prior migration.
        DB::statement("
            ALTER TABLE follow_up_exams
            MODIFY result ENUM('negative', 'scanty', '1+', '2+', '3+') NOT NULL
        ");
    }

    public function down(): void
    {
        DB::statement("
            ALTER TABLE follow_up_exams
            MODIFY result ENUM('negative', 'scanty', '1+', '2+', '3+') NULL
        ");

        Schema::table('follow_up_exams', function (Blueprint $table) {
            $table->dropColumn('result_date');
        });

        Schema::table('follow_up_exams', function (Blueprint $table) {
            $table->renameColumn('collection_date', 'performed_date');
        });
    }
};
