<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Archiving is a filing action, not a fourth status: a program is archived
 * only after it has been completed, and it stays completed while archived.
 * A nullable timestamp records it, which keeps the `status` enum — and the
 * upcoming/active/completed lifecycle derived from it — untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('programs', function (Blueprint $table) {
            $table->timestamp('archived_at')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('programs', function (Blueprint $table) {
            $table->dropColumn('archived_at');
        });
    }
};
