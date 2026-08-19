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

    public function test_each_role_can_view_only_their_own_recent_activity(): void
    {
        foreach (['icm', 'rhu', 'provider'] as $role) {
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
                    ->where('filters.category', 'all')
                    ->has('activities.data', 1)
                    ->where('activities.data.0.title', "{$role} account activity"));
        }
    }

    public function test_activity_can_be_filtered_and_searched(): void
    {
        $user = User::factory()->create(['role' => 'icm']);

        $user->activities()->createMany([
            [
                'type' => 'message.sent',
                'title' => 'Sent a message',
                'description' => 'Message sent to RHU Staff.',
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
            'name' => 'Updated ICM Coordinator',
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
