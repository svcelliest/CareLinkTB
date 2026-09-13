<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bhws', function (Blueprint $table) {
            $table->id();
            $table->foreignId('added_by')->constrained('users')->cascadeOnDelete();
            $table->string('name', 150);
            $table->string('contact_number', 40);
            $table->text('address')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bhws');
    }
};
