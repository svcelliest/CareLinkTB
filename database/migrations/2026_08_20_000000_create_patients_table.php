<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('program_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->enum('form_type', ['sputum_collection', 'contact_tracing']);
            $table->string('patient_code', 80)->nullable();
            $table->string('name', 150);
            $table->unsignedTinyInteger('age')->nullable();
            $table->enum('sex', ['male', 'female'])->nullable();
            $table->string('contact_number', 40)->nullable();
            $table->text('address')->nullable();
            $table->enum('status', ['draft', 'completed'])->default('draft');
            $table->json('responses');
            $table->timestamps();

            $table->index(['program_id', 'form_type', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patients');
    }
};
