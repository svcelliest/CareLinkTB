<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_page_is_available_to_every_authenticated_role(): void
    {
        foreach (['icm', 'rhu', 'provider'] as $role) {
            $user = User::factory()->create(['role' => $role]);

            $this->actingAs($user)
                ->get(route('profile.edit'))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page
                    ->component('Profile/Edit')
                    ->where('role', $role)
                    ->where('auth.user.id', $user->id));
        }
    }

    public function test_a_user_can_update_profile_details(): void
    {
        $user = User::factory()->create([
            'role' => 'rhu',
            'email_verified_at' => now(),
        ]);

        $this->actingAs($user)
            ->patch(route('profile.update'), [
                'name' => 'Maria Santos',
                'email' => 'maria.santos@example.test',
                'address' => 'San Isidro, Leyte',
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $user->refresh();

        $this->assertSame('Maria Santos', $user->name);
        $this->assertSame('San Isidro, Leyte', $user->address);
        $this->assertNull($user->email_verified_at);
    }

    public function test_a_user_can_update_their_password_with_the_current_password(): void
    {
        $user = User::factory()->create(['role' => 'provider']);

        $this->actingAs($user)
            ->put(route('profile.password.update'), [
                'current_password' => 'password',
                'password' => 'Stronger-password-123',
                'password_confirmation' => 'Stronger-password-123',
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $this->assertTrue(Hash::check('Stronger-password-123', $user->fresh()->password));
    }

    public function test_the_current_password_is_required_to_change_a_password(): void
    {
        $user = User::factory()->create(['role' => 'provider']);

        $this->actingAs($user)
            ->put(route('profile.password.update'), [
                'current_password' => 'incorrect-password',
                'password' => 'Stronger-password-123',
                'password_confirmation' => 'Stronger-password-123',
            ])
            ->assertSessionHasErrors('current_password');

        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_a_user_can_upload_view_and_remove_a_private_avatar(): void
    {
        Storage::fake('local');
        $user = User::factory()->create(['role' => 'icm']);

        $this->actingAs($user)
            ->post(route('profile.avatar.update'), [
                'avatar' => UploadedFile::fake()->image('profile.jpg', 300, 300),
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $user->refresh();
        $this->assertNotNull($user->avatar_path);
        Storage::disk('local')->assertExists($user->avatar_path);

        $this->get(route('profile.avatar'))->assertOk();

        $storedPath = $user->avatar_path;
        $this->delete(route('profile.avatar.destroy'))->assertRedirect();

        $this->assertNull($user->fresh()->avatar_path);
        Storage::disk('local')->assertMissing($storedPath);
    }

    public function test_guests_cannot_access_profile_or_notifications(): void
    {
        $this->get(route('profile.edit'))->assertRedirect(route('login'));
        $this->get(route('notifications.index'))->assertRedirect(route('login'));
    }
}
