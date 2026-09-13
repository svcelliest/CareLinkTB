<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sms_logs', function (Blueprint $table) {
            $table->dropForeign(['patient_id']);
            $table->dropForeign(['bhw_id']);
            $table->dropForeign(['sent_by']);
        });

        Schema::table('sms_logs', function (Blueprint $table) {
            $table->foreign('patient_id')->references('id')->on('patients')->restrictOnDelete();
            $table->foreign('bhw_id')->references('id')->on('bhws')->restrictOnDelete();
            $table->foreign('sent_by')->references('id')->on('users')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sms_logs', function (Blueprint $table) {
            $table->dropForeign(['patient_id']);
            $table->dropForeign(['bhw_id']);
            $table->dropForeign(['sent_by']);
        });

        Schema::table('sms_logs', function (Blueprint $table) {
            $table->foreign('patient_id')->references('id')->on('patients')->cascadeOnDelete();
            $table->foreign('bhw_id')->references('id')->on('bhws')->cascadeOnDelete();
            $table->foreign('sent_by')->references('id')->on('users')->cascadeOnDelete();
        });
    }
};
