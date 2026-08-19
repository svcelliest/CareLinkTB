<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone', 30)->nullable()->after('role');
            $table->string('organization', 150)->nullable()->after('phone');
            $table->string('position', 100)->nullable()->after('organization');
            $table->string('address')->nullable()->after('position');
            $table->text('bio')->nullable()->after('address');
            $table->string('avatar_path')->nullable()->after('bio');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'phone',
                'organization',
                'position',
                'address',
                'bio',
                'avatar_path',
            ]);
        });
    }
};
