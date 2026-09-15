<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            Schema::table('follow_up_exams', function (Blueprint $table) {
                $table->dropColumn('result');
            });
            Schema::table('follow_up_exams', function (Blueprint $table) {
                $table->enum('result', ['negative', 'positive', 'not_done'])->nullable();
            });

            return;
        }

        DB::statement("
            ALTER TABLE follow_up_exams
            MODIFY result ENUM('negative', 'positive', 'not_done') NULL
        ");
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            Schema::table('follow_up_exams', function (Blueprint $table) {
                $table->dropColumn('result');
            });
            Schema::table('follow_up_exams', function (Blueprint $table) {
                $table->string('result', 50)->nullable();
            });

            return;
        }

        DB::statement('
            ALTER TABLE follow_up_exams
            MODIFY result VARCHAR(50) NULL
        ');
    }
};
