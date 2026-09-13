<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sputum_collections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->unique()->constrained()->restrictOnDelete();

            $table->boolean('collected')->nullable();
            $table->enum('not_collected_reason', [
                'no_rhu_staff_or_bhw',
                'patient_refused',
                'patient_absent',
                'no_supplies',
                'other',
            ])->nullable();
            $table->text('remarks')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sputum_collections');
    }
};
