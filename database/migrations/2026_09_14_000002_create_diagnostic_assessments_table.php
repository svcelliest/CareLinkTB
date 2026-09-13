<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('diagnostic_assessments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->unique()->constrained()->restrictOnDelete();

            $table->boolean('tested_with_gxpert')->default(false);
            $table->boolean('tested_with_dssm')->default(false);

            // A GeneXpert/DSSM read can flag more than one of these at once,
            // so each is its own flag rather than a single result enum.
            $table->boolean('result_dssm')->default(false);
            $table->boolean('result_rr')->default(false);
            $table->boolean('result_t')->default(false);
            $table->boolean('result_tt')->default(false);
            $table->boolean('result_ti')->default(false);
            $table->boolean('result_negative')->default(false);

            $table->string('registry_number', 40)->nullable();

            // rrtb_cd isn't a real case — RR-TB can only be lab-confirmed,
            // never clinically diagnosed.
            $table->enum('tb_diagnosis', ['dstb_cd', 'dstb_bc', 'rrtb_bc'])->nullable();

            $table->text('remarks')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('diagnostic_assessments');
    }
};
