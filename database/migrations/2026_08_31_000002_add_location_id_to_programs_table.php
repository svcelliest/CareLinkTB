<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('programs', function (Blueprint $table) {
            $table->dropColumn('location');
        });

        Schema::table('programs', function (Blueprint $table) {
            $table->foreignId('location_id')
                ->after('name')
                ->constrained('locations')
                ->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('programs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('location_id');
        });

        Schema::table('programs', function (Blueprint $table) {
            $table->string('location')->after('name');
        });
    }
};
