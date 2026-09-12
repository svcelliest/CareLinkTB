<?php

namespace Tests\Feature\Auth;

use App\Models\Activity;
use App\Models\User;
use App\Notifications\PasswordResetOtp;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PasswordResetOtpTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Issue a code for the user and return the plain-text value that was mailed.
     */
    private function requestCodeFor(User $user): string
    {
        Notification::fake();

        $this->postJson('/forgot-password/otp', ['email' => $user->email])
            ->assertOk();

        $code = null;

        Notification::assertSentTo(
            $user,
            PasswordResetOtp::class,
            function (PasswordResetOtp $notification) use (&$code, $user) {
                $mail = $notification->toMail($user);
                $code = collect($mail->introLines)->first(fn (string $line) => preg_match('/^\d{6}$/', $line) === 1);

                return $code !== null;
            },
        );

        return $code;
    }

    public function test_requesting_a_code_stores_a_hashed_token_and_notifies_the_user(): void
    {
        $user = User::factory()->create(['role' => 'icm']);

        $code = $this->requestCodeFor($user);

        $record = DB::table('password_reset_tokens')->where('email', $user->email)->first();

        $this->assertNotNull($record);
        $this->assertNotSame($code, $record->token, 'The code must not be stored in plain text.');
        $this->assertTrue(Hash::check($code, $record->token));
    }

    public function test_requesting_a_code_does_not_reveal_whether_an_address_is_registered(): void
    {
        Notification::fake();

        $this->postJson('/forgot-password/otp', ['email' => 'nobody@example.com'])
            ->assertOk()
            ->assertJsonStructure(['status']);

        $this->assertDatabaseCount('password_reset_tokens', 0);
        Notification::assertNothingSent();
    }

    public function test_disabled_accounts_cannot_request_a_code(): void
    {
        Notification::fake();

        $user = User::factory()->create([
            'role' => 'rhu',
            'disabled_at' => now(),
        ]);

        $this->postJson('/forgot-password/otp', ['email' => $user->email])
            ->assertOk();

        $this->assertDatabaseCount('password_reset_tokens', 0);
        Notification::assertNothingSent();
    }

    public function test_a_valid_code_allows_the_password_to_be_reset(): void
    {
        $user = User::factory()->create(['role' => 'icm']);
        $code = $this->requestCodeFor($user);

        $this->postJson('/forgot-password/otp/verify', [
            'email' => $user->email,
            'otp' => $code,
        ])->assertOk();

        $this->postJson('/forgot-password/reset', [
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertOk();

        $this->assertTrue(Hash::check('new-password-123', $user->fresh()->password));
        $this->assertDatabaseCount('password_reset_tokens', 0);

        $this->assertDatabaseHas('activities', [
            'user_id' => $user->id,
            'type' => 'security.password_reset',
        ]);
    }

    public function test_the_reset_password_can_be_used_to_sign_in(): void
    {
        $user = User::factory()->create(['role' => 'provider']);
        $code = $this->requestCodeFor($user);

        $this->postJson('/forgot-password/otp/verify', ['email' => $user->email, 'otp' => $code])->assertOk();
        $this->postJson('/forgot-password/reset', [
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertOk();

        $this->post('/login', [
            'role' => 'provider',
            'email' => $user->email,
            'password' => 'new-password-123',
        ])->assertRedirect(route('provider.dashboard', absolute: false));

        $this->assertAuthenticatedAs($user);
    }

    public function test_an_incorrect_code_is_rejected(): void
    {
        $user = User::factory()->create(['role' => 'icm']);
        $code = $this->requestCodeFor($user);
        $wrong = $code === '000000' ? '111111' : '000000';

        $this->postJson('/forgot-password/otp/verify', [
            'email' => $user->email,
            'otp' => $wrong,
        ])->assertStatus(422)->assertJsonValidationErrors('otp');

        // The code survives a single wrong guess.
        $this->assertDatabaseCount('password_reset_tokens', 1);
    }

    public function test_an_expired_code_is_rejected(): void
    {
        $user = User::factory()->create(['role' => 'icm']);
        $code = $this->requestCodeFor($user);

        DB::table('password_reset_tokens')
            ->where('email', $user->email)
            ->update(['created_at' => now()->subMinutes(11)]);

        $this->postJson('/forgot-password/otp/verify', [
            'email' => $user->email,
            'otp' => $code,
        ])->assertStatus(422)->assertJsonValidationErrors('otp');

        $this->assertDatabaseCount('password_reset_tokens', 0);
    }

    public function test_repeated_wrong_guesses_burn_the_code(): void
    {
        $user = User::factory()->create(['role' => 'icm']);
        $code = $this->requestCodeFor($user);
        $wrong = $code === '000000' ? '111111' : '000000';

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/forgot-password/otp/verify', [
                'email' => $user->email,
                'otp' => $wrong,
            ])->assertStatus(422);
        }

        // The sixth attempt discards the code, so even the correct one now fails.
        $this->postJson('/forgot-password/otp/verify', [
            'email' => $user->email,
            'otp' => $code,
        ])->assertStatus(422);

        $this->assertDatabaseCount('password_reset_tokens', 0);
    }

    public function test_the_password_cannot_be_reset_without_verifying_a_code(): void
    {
        $user = User::factory()->create(['role' => 'icm']);
        $this->requestCodeFor($user);

        $this->postJson('/forgot-password/reset', [
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertStatus(422)->assertJsonValidationErrors('password');

        $this->assertTrue(Hash::check('password', $user->fresh()->password));
        $this->assertSame(0, Activity::where('type', 'security.password_reset')->count());
    }

    public function test_the_new_password_must_be_confirmed_and_meet_the_server_rules(): void
    {
        $user = User::factory()->create(['role' => 'icm']);
        $code = $this->requestCodeFor($user);

        $this->postJson('/forgot-password/otp/verify', ['email' => $user->email, 'otp' => $code])->assertOk();

        $this->postJson('/forgot-password/reset', [
            'password' => 'short',
            'password_confirmation' => 'short',
        ])->assertStatus(422)->assertJsonValidationErrors('password');

        $this->postJson('/forgot-password/reset', [
            'password' => 'new-password-123',
            'password_confirmation' => 'different-password',
        ])->assertStatus(422)->assertJsonValidationErrors('password');

        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_the_verify_step_requires_six_digits(): void
    {
        $user = User::factory()->create(['role' => 'icm']);
        $this->requestCodeFor($user);

        $this->postJson('/forgot-password/otp/verify', [
            'email' => $user->email,
            'otp' => '123',
        ])->assertStatus(422)->assertJsonValidationErrors('otp');
    }

    public function test_authenticated_users_are_kept_out_of_the_recovery_routes(): void
    {
        $user = User::factory()->create(['role' => 'icm']);

        $this->actingAs($user)
            ->postJson('/forgot-password/otp', ['email' => $user->email])
            ->assertRedirect(route('dashboard', absolute: false));
    }
}
