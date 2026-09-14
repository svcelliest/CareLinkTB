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
        Schema::table('bhws', function (Blueprint $table) {
            $table->foreignId('location_id')
                ->after('added_by')
                ->constrained('locations')
                ->restrictOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bhws', function (Blueprint $table) {
            $table->dropConstrainedForeignId('location_id');
        });
    }
};
