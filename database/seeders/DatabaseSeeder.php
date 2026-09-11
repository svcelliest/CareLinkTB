<?php

namespace Database\Seeders;

use App\Models\Location;
use App\Models\Message;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        if (!app()->environment('local')) {
            return;
        }

        $this->call(LocationSeeder::class);

        $kalibo = Location::where('level', 'municipality')->where('name', 'Kalibo')->firstOrFail();

        // updateOrCreate keeps the demo credentials repeatable when the seeder
        // is run more than once on a developer's existing database.
        $icm = User::updateOrCreate(
            ['email' => 'icm.demo@carelink.test'],
            [
                'name' => 'ICM Demo Coordinator',
                'password' => 'password',
                'role' => 'icm',
                'email_verified_at' => now(),
            ],
        );

        $rhu = User::updateOrCreate(
            ['email' => 'rhu.demo@carelink.test'],
            [
                'name' => 'RHU Demo Staff',
                'password' => 'password',
                'role' => 'rhu',
                'location_id' => $kalibo->id,
                'email_verified_at' => now(),
            ],
        );

        $provider = User::updateOrCreate(
            ['email' => 'provider.demo@carelink.test'],
            [
                'name' => 'Provider Demo Staff',
                'password' => 'password',
                'role' => 'provider',
                'email_verified_at' => now(),
            ],
        );

        // A small starter thread makes it easy to inspect previews, unread
        // badges, and read receipts immediately after seeding.
        Message::firstOrCreate(
            [
                'sender_id' => $icm->id,
                'recipient_id' => $rhu->id,
                'body' => 'Good morning! Please send the latest patient referral update when ready.',
            ],
            [
                'created_at' => now()->subMinutes(18),
                'updated_at' => now()->subMinutes(18),
            ],
        );

        Message::firstOrCreate(
            [
                'sender_id' => $rhu->id,
                'recipient_id' => $icm->id,
                'body' => 'Received. I will send the completed referral details this afternoon.',
            ],
            [
                'created_at' => now()->subMinutes(12),
                'updated_at' => now()->subMinutes(12),
            ],
        );

        Message::firstOrCreate(
            [
                'sender_id' => $provider->id,
                'recipient_id' => $icm->id,
                'body' => 'The diagnostic results are available for review.',
            ],
            [
                'created_at' => now()->subMinutes(5),
                'updated_at' => now()->subMinutes(5),
            ],
        );
    }
}
