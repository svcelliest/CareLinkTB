<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_logs', function (Blueprint $table) {
            $table->id();
            // Exactly one of patient_id / bhw_id is set per row — the
            // recipient is either a registered patient or a BHW contact,
            // never both.
            $table->foreignId('patient_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('bhw_id')->nullable()->constrained('bhws')->cascadeOnDelete();
            $table->foreignId('sent_by')->constrained('users')->cascadeOnDelete();
            $table->string('contact_number', 40);
            $table->text('message');
            $table->timestamp('sent_at');
            $table->timestamps();

            $table->index(['patient_id', 'sent_at']);
            $table->index(['bhw_id', 'sent_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_logs');
    }
};
