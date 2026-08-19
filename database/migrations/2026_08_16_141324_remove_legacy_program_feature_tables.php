<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::dropIfExists('program_form_entries');
        Schema::dropIfExists('programs');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('programs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('location');
            $table->dateTime('schedule_at');
            $table->enum('status', ['upcoming', 'active', 'completed'])->default('upcoming');
            $table->timestamps();

            $table->index(['status', 'schedule_at']);
        });

        Schema::create('program_form_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('program_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->enum('form_type', ['sputum_collection', 'contact_tracing']);
            $table->string('patient_id', 80)->nullable();
            $table->string('patient_name', 150);
            $table->string('contact_number', 40)->nullable();
            $table->text('address')->nullable();
            $table->enum('status', ['draft', 'completed'])->default('draft');
            $table->json('responses');
            $table->timestamps();

            $table->index(['program_id', 'form_type', 'status']);
        });
    }
};
