<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('activities')
            ->where('type', 'like', 'program.%')
            ->delete();
    }

    public function down(): void
    {
        // Program activity records cannot be restored after deletion.
    }
};
