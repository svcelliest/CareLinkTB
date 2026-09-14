<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('follow_up_exams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('treatment_enrollment_id')
                ->constrained()
                ->restrictOnDelete();

            // Which schedule month this exam belongs to (2, 5, or 6, per
            // the patient's diagnosis at the time it was performed). Which
            // months are actually due is computed live from the
            // enrollment's current diagnostic_assessments.tb_diagnosis,
            // never stored here — a row only exists once the exam has
            // actually been performed, there are no pre-created "pending"
            // rows, so a mid-treatment reclassification just works without
            // any backfill/migration needed.
            $table->unsignedTinyInteger('month_number');

            $table->date('performed_date');

            // Vocabulary not finalized yet — plain string until settled.
            $table->string('result', 50)->nullable();

            $table->text('remarks')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            $table->unique(['treatment_enrollment_id', 'month_number'], 'follow_up_exam_enrollment_month_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('follow_up_exams');
    }
};
