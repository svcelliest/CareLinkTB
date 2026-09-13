<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->enum('form_type', ['sputum_collection', 'contact_tracing', 'provider_screening'])->change();
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->enum('form_type', ['sputum_collection', 'contact_tracing'])->change();
        });
    }
};
