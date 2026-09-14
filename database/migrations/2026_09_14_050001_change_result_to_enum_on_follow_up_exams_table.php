<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            ALTER TABLE follow_up_exams
            MODIFY result ENUM('negative', 'positive', 'not_done') NULL
        ");
    }

    public function down(): void
    {
        DB::statement('
            ALTER TABLE follow_up_exams
            MODIFY result VARCHAR(50) NULL
        ');
    }
};
