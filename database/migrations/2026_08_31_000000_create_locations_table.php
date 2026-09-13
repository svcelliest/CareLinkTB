<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->enum('level', ['province', 'municipality', 'barangay']);
            $table->string('name');
            $table->timestamps();

            $table->unique(['parent_id', 'name']);
            $table->index('level');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('locations');
    }
};
