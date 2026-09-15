<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('treatment_monitoring_records', function (Blueprint $table) {
            // Null = draft/current, still editable. Set = saved and locked
            // until it's the current month again (it never is, once a later
            // month becomes current) — every save re-stamps this, which is
            // what "Edit Review" actually does.
            $table->timestamp('saved_at')->nullable()->after('remarks');
        });
    }

    public function down(): void
    {
        Schema::table('treatment_monitoring_records', function (Blueprint $table) {
            $table->dropColumn('saved_at');
        });
    }
};
