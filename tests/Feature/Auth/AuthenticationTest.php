<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_screen_can_be_rendered(): void
    {
        $response = $this->get('/login');

        $response->assertStatus(200);
    }

    public function test_users_can_authenticate_using_the_login_screen(): void
    {
        $user = User::factory()->create([
            'role' => 'icm',
        ]);

        $response = $this->post('/login', [
            'role' => 'icm',
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('icm.dashboard', absolute: false));
    }

    public function test_users_can_not_authenticate_with_invalid_password(): void
    {
        $user = User::factory()->create([
            'role' => 'rhu',
        ]);

        $this->post('/login', [
            'role' => 'rhu',
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $this->assertGuest();
    }

    public function test_users_can_not_authenticate_under_the_wrong_selected_role(): void
    {
        $user = User::factory()->create([
            'role' => 'rhu',
        ]);

        $response = $this->from('/')->post('/login', [
            'role' => 'icm',
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertGuest();
        $response->assertRedirect('/');
        $response->assertSessionHasErrors([
            'email' => 'Invalid credentials for the selected role.',
        ]);
    }

    public function test_login_rejects_an_unsupported_role(): void
    {
        $user = User::factory()->create([
            'role' => 'provider',
        ]);

        $response = $this->from('/')->post('/login', [
            'role' => 'administrator',
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertGuest();
        $response->assertRedirect('/');
        $response->assertSessionHasErrors('role');
    }

    public function test_users_can_logout(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/logout');

        $this->assertGuest();
        $response->assertRedirect('/');
    }
}
