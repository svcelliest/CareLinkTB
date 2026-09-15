<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('follow_up_exams', function (Blueprint $table) {
            // Whether a specimen was actually collected for this exam —
            // ported from the medjofinal reference. How this interacts with
            // this schema's "a row only exists once performed" pattern is
            // still open; added now, business logic to follow.
            $table->boolean('collected')->nullable()->after('month_number');

            // Exact AFB count when result is 'scanty' — free text like the
            // reference, not an int (e.g. "Scanty (+3)").
            $table->string('afb_count', 60)->nullable()->after('result');
        });
    }

    public function down(): void
    {
        Schema::table('follow_up_exams', function (Blueprint $table) {
            $table->dropColumn(['collected', 'afb_count']);
        });
    }
};
