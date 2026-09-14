<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contact_tracing_records', function (Blueprint $table) {
            $table->dropColumn(['contact_enrolled_treatment', 'contacts_enrolled_tpt']);
        });
    }

    public function down(): void
    {
        Schema::table('contact_tracing_records', function (Blueprint $table) {
            $table->boolean('contact_enrolled_treatment')->default(false);
            $table->unsignedSmallInteger('contacts_enrolled_tpt')->nullable();
        });
    }
};
