}<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Provider-side screening registration writes into the same `patients` table
 * the RHU forms use, but it is a third intake shape rather than one of the two
 * RHU form types. The column becomes a plain string so a new intake never
 * needs a schema change again — the allowed values stay enforced by the form
 * requests, as they already were.
 *
 * `notified_at` records that the provider sent the patient a follow-up text,
 * so the screening table's notify state survives a reload.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->string('form_type', 40)->change();
            $table->timestamp('notified_at')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn('notified_at');
            $table->enum('form_type', ['sputum_collection', 'contact_tracing'])->change();
        });
    }
};
