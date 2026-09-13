<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->date('date_of_birth')->nullable()->after('name');
            $table->dropColumn('age');
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->unsignedTinyInteger('age')->nullable()->after('name');
            $table->dropColumn('date_of_birth');
        });
    }
};
