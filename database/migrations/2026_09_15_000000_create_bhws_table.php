<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Barangay Health Worker contacts an RHU can pick as SMS Log recipients
 * alongside its confirmed TB patients.
 *
 * A BHW is not a patient and not a portal account — just a name and a number
 * the RHU keeps on file — so they get their own table rather than a role on
 * `users`. `municipality` is the RHU catchment the contact belongs to, stored
 * exactly as `users.municipality` is, which is what lets {@see \App\Support\RhuScope}
 * keep one municipality's contacts from showing up in another's list.
 * `notified_at` backs the "Last alert" line under the name, the same way
 * `patients.notified_at` does for patients.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bhws', function (Blueprint $table) {
            $table->id();
            $table->foreignId('added_by')->constrained('users')->cascadeOnDelete();
            $table->string('municipality', 100);
            $table->string('name', 150);
            $table->string('contact_number', 40);
            $table->string('address', 255)->nullable();
            $table->timestamp('notified_at')->nullable();
            $table->timestamps();

            $table->index(['municipality', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bhws');
    }
};
