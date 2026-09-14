<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('diagnostic_assessments', function (Blueprint $table) {
            $table->dropColumn('registry_number');
        });
    }

    public function down(): void
    {
        Schema::table('diagnostic_assessments', function (Blueprint $table) {
            $table->string('registry_number', 40)->nullable();
        });
    }
};
