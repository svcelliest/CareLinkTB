<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Two values the account management screen needs and no existing column
 * carries.
 *
 * `municipality` is the RHU municipality an account covers. `organization` is
 * free-text ("Kalibo Rural Health Unit", "RHU Kalibo", …) and `address` is a
 * whole address string, so neither can be grouped or filtered on reliably —
 * this column stores exactly one name from the shared Aklan address dataset.
 * It stays null for providers and ICM coordinators, who are not scoped to a
 * municipality.
 *
 * `last_login_at` backs the account table's LAST LOGIN column.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('municipality', 100)->nullable()->after('organization');
            $table->timestamp('last_login_at')->nullable()->after('disabled_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['municipality', 'last_login_at']);
        });
    }
};
