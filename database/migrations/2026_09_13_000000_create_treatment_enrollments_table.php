<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('treatment_enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->restrictOnDelete();
            $table->string('case_number', 30)->unique();
            $table->string('treatment_facility', 150);
            $table->string('diagnosing_facility', 150)->nullable();
            $table->date('registration_date');
            $table->date('treatment_start_date');
            $table->enum('registration_group', [
                'new',
                'relapse',
                'treatment_after_failure',
                'treatment_after_loss_to_follow_up',
                'transfer_in',
            ]);
            $table->enum('treatment_regimen', ['standard_dstb', 'drug_resistant']);
            $table->foreignId('assigned_provider_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->enum('outcome', [
                'cured',
                'treatment_completed',
                'treatment_failed',
                'died',
                'lost_to_follow_up',
                'not_evaluated',
            ])->nullable();
            $table->date('outcome_date')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('outcome_remarks')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('treatment_enrollments');
    }
};
