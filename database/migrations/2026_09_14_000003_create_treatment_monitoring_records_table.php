<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('treatment_monitoring_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('treatment_enrollment_id')->constrained()->restrictOnDelete();

            // 1-6 for the standard regimen. Not stored elsewhere on this row —
            // patient_id is reachable via treatment_enrollment_id, so it isn't
            // duplicated here.
            $table->unsignedTinyInteger('month_number');

            $table->decimal('current_weight', 5, 1)->nullable();
            $table->unsignedTinyInteger('prescribed_dose')->nullable();
            $table->string('clinical_status', 40)->nullable();
            $table->text('remarks')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            // A month is recorded once per enrollment.
            $table->unique(['treatment_enrollment_id', 'month_number'], 'monitoring_enrollment_month_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('treatment_monitoring_records');
    }
};
