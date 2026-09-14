<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('treatment_enrollments', function (Blueprint $table) {
            $table->renameColumn('case_number', 'registry_number');
        });
    }

    public function down(): void
    {
        Schema::table('treatment_enrollments', function (Blueprint $table) {
            $table->renameColumn('registry_number', 'case_number');
        });
    }
};
