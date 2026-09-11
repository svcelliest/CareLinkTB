<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Repurposes the stock `password_reset_tokens` table (email primary key,
     * one row per email) for the OTP flow instead of Laravel's link-based
     * reset: `token` holds a hash of either the OTP or, once verified, the
     * reset token; `verified_at` marks which state a row is in.
     */
    public function up(): void
    {
        Schema::table('password_reset_tokens', function (Blueprint $table) {
            $table->timestamp('verified_at')->nullable()->after('token');
        });
    }

    public function down(): void
    {
        Schema::table('password_reset_tokens', function (Blueprint $table) {
            $table->dropColumn('verified_at');
        });
    }
};
