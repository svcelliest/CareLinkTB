<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class IcmAccountManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_icm_can_view_managed_accounts_and_summary_counts(): void
    {
        $icm = User::factory()->create(['role' => 'icm']);
        User::factory()->create([
            'role' => 'rhu',
            'name' => 'Banga RHU Nurse',
            'organization' => 'Banga Rural Health Unit',
        ]);
        User::factory()->create([
            'role' => 'provider',
            'disabled_at' => now(),
        ]);

        $this->actingAs($icm)
            ->get(route('icm.accounts.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Icm/Accounts/Index')
                ->where('stats.total', 2)
                ->where('stats.active', 1)
                ->where('stats.disabled', 1)
                ->has('accounts.data', 2));
    }

    public function test_icm_can_search_and_filter_managed_accounts(): void
    {
        $icm = User::factory()->create(['role' => 'icm']);
        User::factory()->create([
            'role' => 'rhu',
            'name' => 'Lake Sebu RHU',
            'organization' => 'Lake Sebu Health Office',
        ]);
        $provider = User::factory()->create([
            'role' => 'provider',
            'name' => 'South Cotabato Diagnostics',
            'disabled_at' => now(),
        ]);

        $this->actingAs($icm)
            ->get(route('icm.accounts.index', [
                'role' => 'provider',
                'status' => 'disabled',
                'search' => 'Diagnostics',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('accounts.data', 1)
                ->where('accounts.data.0.id', $provider->id)
                ->where('filters.role', 'provider')
                ->where('filters.status', 'disabled')
                ->where('filters.search', 'Diagnostics'));
    }

    public function test_icm_can_create_an_rhu_or_provider_account(): void
    {
        $icm = User::factory()->create(['role' => 'icm']);

        $response = $this->actingAs($icm)
            ->from(route('icm.accounts.index'))
            ->post(route('icm.accounts.store'), [
                'name' => 'Juan Dela Cruz',
                'email' => 'juan@example.com',
                'role' => 'rhu',
                'organization' => 'Tupi Rural Health Unit',
                'position' => 'TB Nurse',
                'phone' => '0917 123 4567',
                'password' => 'temporary-password',
                'password_confirmation' => 'temporary-password',
            ]);

        $response
            ->assertRedirect(route('icm.accounts.index'))
            ->assertSessionHas('success');

        $account = User::query()->where('email', 'juan@example.com')->firstOrFail();

        $this->assertSame('rhu', $account->role);
        $this->assertSame('Tupi Rural Health Unit', $account->organization);
        $this->assertNotNull($account->email_verified_at);
        $this->assertTrue(Hash::check('temporary-password', $account->password));
        $this->assertDatabaseHas('activities', [
            'user_id' => $icm->id,
            'type' => 'account.created',
            'subject_id' => $account->id,
        ]);
    }

    public function test_icm_cannot_create_another_icm_account_through_account_management(): void
    {
        $icm = User::factory()->create(['role' => 'icm']);

        $this->actingAs($icm)
            ->from(route('icm.accounts.index'))
            ->post(route('icm.accounts.store'), [
                'name' => 'Another Coordinator',
                'email' => 'coordinator@example.com',
                'role' => 'icm',
                'password' => 'temporary-password',
                'password_confirmation' => 'temporary-password',
            ])
            ->assertRedirect(route('icm.accounts.index'))
            ->assertSessionHasErrors('role');

        $this->assertDatabaseMissing('users', ['email' => 'coordinator@example.com']);
    }

    public function test_icm_can_disable_and_reenable_a_managed_account(): void
    {
        $icm = User::factory()->create(['role' => 'icm']);
        $provider = User::factory()->create(['role' => 'provider']);

        $this->actingAs($icm)
            ->patch(route('icm.accounts.status', $provider), ['active' => false])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertNotNull($provider->fresh()->disabled_at);
        $this->assertDatabaseHas('activities', [
            'user_id' => $icm->id,
            'type' => 'account.disabled',
            'subject_id' => $provider->id,
        ]);

        $this->actingAs($icm)
            ->patch(route('icm.accounts.status', $provider), ['active' => true])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertNull($provider->fresh()->disabled_at);
    }

    public function test_icm_account_cannot_be_disabled_through_managed_account_route(): void
    {
        $icm = User::factory()->create(['role' => 'icm']);
        $anotherIcm = User::factory()->create(['role' => 'icm']);

        $this->actingAs($icm)
            ->patch(route('icm.accounts.status', $anotherIcm), ['active' => false])
            ->assertForbidden();

        $this->assertNull($anotherIcm->fresh()->disabled_at);
    }

    public function test_non_icm_users_cannot_manage_accounts(): void
    {
        $rhu = User::factory()->create(['role' => 'rhu']);
        $provider = User::factory()->create(['role' => 'provider']);

        $this->actingAs($rhu)
            ->get(route('icm.accounts.index'))
            ->assertForbidden();

        $this->actingAs($provider)
            ->post(route('icm.accounts.store'), [
                'name' => 'Unauthorized User',
                'email' => 'unauthorized@example.com',
                'role' => 'rhu',
                'password' => 'temporary-password',
                'password_confirmation' => 'temporary-password',
            ])
            ->assertForbidden();
    }

    public function test_disabled_account_cannot_sign_in(): void
    {
        $account = User::factory()->create([
            'role' => 'rhu',
            'disabled_at' => now(),
        ]);

        $response = $this->from('/')
            ->post('/login', [
                'role' => 'rhu',
                'email' => $account->email,
                'password' => 'password',
            ]);

        $this->assertGuest();
        $response
            ->assertRedirect('/')
            ->assertSessionHasErrors([
                'email' => 'This account has been disabled. Contact an ICM coordinator for assistance.',
            ]);
    }

    public function test_disabled_account_with_an_existing_session_is_signed_out(): void
    {
        $account = User::factory()->create([
            'role' => 'rhu',
            'disabled_at' => now(),
        ]);

        $this->actingAs($account)
            ->get(route('rhu.dashboard'))
            ->assertRedirect(route('Landing'))
            ->assertSessionHas('error');

        $this->assertGuest();
    }
}
