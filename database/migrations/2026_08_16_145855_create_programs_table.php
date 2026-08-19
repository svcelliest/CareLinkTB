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

        Schema::create('programs', function (Blueprint $table) {
            $table->id();

            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();

            $table->string('name', 150);
            $table->string('location');
            $table->dateTime('scheduled_at');
            $table->enum('status', [
                'upcoming',
                'active',
                'completed',
            ])->default('upcoming');

            $table->timestamps();

            $table->index(['status', 'scheduled_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('programs');
    }
};
