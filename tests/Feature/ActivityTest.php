<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ActivityTest extends TestCase
{
    use RefreshDatabase;

    public function test_rhu_and_provider_can_view_only_their_own_recent_activity(): void
    {
        foreach (['rhu', 'provider'] as $role) {
            $user = User::factory()->create(['role' => $role]);
            $otherUser = User::factory()->create(['role' => $role]);

            Activity::create([
                'user_id' => $user->id,
                'type' => 'security.signed_in',
                'title' => "{$role} account activity",
            ]);
            Activity::create([
                'user_id' => $otherUser->id,
                'type' => 'security.signed_in',
                'title' => 'Another user activity',
            ]);

            $this->actingAs($user)
                ->get(route($role . '.activity'))
                ->assertOk()
                ->assertInertia(fn(Assert $page) => $page
                    ->component('Activity/Index')
                    ->where('role', $role)
                    ->where('isGlobal', false)
                    ->where('filters.category', 'all')
                    ->has('activities.data', 1)
                    ->where('activities.data.0.title', "{$role} account activity"));
        }
    }

    public function test_icm_can_view_activity_from_every_account(): void
    {
        $icm = User::factory()->create(['role' => 'icm']);
        $rhu = User::factory()->create(['role' => 'rhu']);
        $provider = User::factory()->create(['role' => 'provider']);

        Activity::create([
            'user_id' => $icm->id,
            'type' => 'security.signed_in',
            'title' => 'Signed in to CareLink',
        ]);
        Activity::create([
            'user_id' => $rhu->id,
            'type' => 'program.patient_recorded',
            'title' => 'Added patient record',
        ]);
        Activity::create([
            'user_id' => $provider->id,
            'type' => 'program.patient_flagged',
            'title' => 'Flagged patient as presumptive TB',
        ]);

        // ICM's feed is global — it should surface every account's
        // activity, not just its own, with the acting user attached to
        // each entry.
        $this->actingAs($icm)
            ->get(route('icm.activity'))
            ->assertOk()
            ->assertInertia(fn(Assert $page) => $page
                ->component('Activity/Index')
                ->where('role', 'icm')
                ->where('isGlobal', true)
                ->has('activities.data', 3)
                ->has('activities.data.0.actor')
                ->has('activities.data.1.actor')
                ->has('activities.data.2.actor'));

        $this->actingAs($icm)
            ->get(route('icm.activity', ['category' => 'programs']))
            ->assertOk()
            ->assertInertia(fn(Assert $page) => $page
                ->where('filters.category', 'programs')
                ->has('activities.data', 2));

        // Filtering by role narrows the global feed down to just that
        // role's accounts.
        $this->actingAs($icm)
            ->get(route('icm.activity', ['role' => 'rhu']))
            ->assertOk()
            ->assertInertia(fn(Assert $page) => $page
                ->where('filters.role', 'rhu')
                ->has('activities.data', 1)
                ->where('activities.data.0.type', 'program.patient_recorded')
                ->where('activities.data.0.actor.role', 'rhu'));

        $this->actingAs($icm)
            ->get(route('icm.activity', ['role' => 'provider']))
            ->assertOk()
            ->assertInertia(fn(Assert $page) => $page
                ->where('filters.role', 'provider')
                ->has('activities.data', 1)
                ->where('activities.data.0.type', 'program.patient_flagged')
                ->where('activities.data.0.actor.role', 'provider'));
    }

    public function test_activity_can_be_filtered_and_searched(): void
    {
        $user = User::factory()->create(['role' => 'icm']);

        $user->activities()->createMany([
            [
                'type' => 'message.sent',
                'title' => 'Sent a message',
                'description' => 'Message sent to RHU.',
            ],
            [
                'type' => 'profile.updated',
                'title' => 'Updated profile details',
                'description' => 'Your account information was changed.',
            ],
        ]);

        $this->actingAs($user)
            ->get(route('icm.activity', ['category' => 'messages']))
            ->assertOk()
            ->assertInertia(fn(Assert $page) => $page
                ->where('filters.category', 'messages')
                ->has('activities.data', 1)
                ->where('activities.data.0.type', 'message.sent'));

        $this->actingAs($user)
            ->get(route('icm.activity', ['search' => 'Updated']))
            ->assertOk()
            ->assertInertia(fn(Assert $page) => $page
                ->where('filters.search', 'Updated')
                ->has('activities.data', 1)
                ->where('activities.data.0.type', 'profile.updated'));
    }

    public function test_supported_actions_are_added_to_recent_activity(): void
    {
        $icm = User::factory()->create(['role' => 'icm']);
        $rhu = User::factory()->create(['role' => 'rhu']);

        $this->actingAs($icm)->post(route('messages.store'), [
            'recipient_id' => $rhu->id,
            'body' => 'Please prepare the screening forms.',
        ])->assertSessionHasNoErrors();

        $this->actingAs($icm)->patch(route('profile.update'), [
            'name' => 'Updated ICM',
            'email' => $icm->email,
            'phone' => null,
            'organization' => null,
            'position' => null,
            'address' => null,
            'bio' => null,
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('activities', [
            'user_id' => $icm->id,
            'type' => 'message.sent',
        ]);
        $this->assertDatabaseHas('activities', [
            'user_id' => $icm->id,
            'type' => 'profile.updated',
        ]);
        $this->assertDatabaseCount('activities', 2);
    }

    public function test_activity_urls_are_protected_by_role_and_authentication(): void
    {
        $rhu = User::factory()->create(['role' => 'rhu']);

        $this->get(route('rhu.activity'))->assertRedirect(route('login'));

        $this->actingAs($rhu)
            ->get(route('icm.activity'))
            ->assertForbidden();
    }

    public function test_sign_ins_and_password_changes_create_security_activity(): void
    {
        $user = User::factory()->create(['role' => 'provider']);

        $this->post(route('login'), [
            'role' => 'provider',
            'email' => $user->email,
            'password' => 'password',
        ])->assertRedirect(route('provider.dashboard', absolute: false));

        $this->put(route('profile.password.update'), [
            'current_password' => 'password',
            'password' => 'Stronger-password-123',
            'password_confirmation' => 'Stronger-password-123',
        ])->assertSessionHasNoErrors();

        $this->assertTrue(Hash::check('Stronger-password-123', $user->fresh()->password));
        $this->assertDatabaseHas('activities', [
            'user_id' => $user->id,
            'type' => 'security.signed_in',
        ]);
        $this->assertDatabaseHas('activities', [
            'user_id' => $user->id,
            'type' => 'security.password_updated',
        ]);
    }
}
