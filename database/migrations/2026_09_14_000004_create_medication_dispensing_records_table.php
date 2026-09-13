<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medication_dispensing_records', function (Blueprint $table) {
            $table->id();

            // Points at the month's clinical review, not directly at the
            // enrollment — RHU staff must complete a month's review before
            // any weekly dispensing can be recorded for that month.
            $table->foreignId('treatment_monitoring_id')
                ->constrained('treatment_monitoring_records')
                ->restrictOnDelete();

            // Duplicated from the parent monitoring row on purpose, so a
            // month's dispensing rows can be filtered/grouped without a join.
            $table->unsignedTinyInteger('month_number');
            $table->unsignedTinyInteger('week_number');

            $table->date('dispensing_date');
            $table->date('next_dispensing_date')->nullable();
            $table->unsignedSmallInteger('remaining_tablets')->nullable();
            $table->unsignedSmallInteger('doses_taken')->nullable();
            $table->json('side_effects')->nullable();
            $table->string('side_effects_other', 255)->nullable();

            $table->timestamps();

            // Week N becomes uneditable once week N+1 exists — that lock is
            // app logic, not a schema constraint, but a week is still only
            // ever recorded once per monitoring row.
            $table->unique(['treatment_monitoring_id', 'week_number'], 'dispensing_monitoring_week_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medication_dispensing_records');
    }
};
