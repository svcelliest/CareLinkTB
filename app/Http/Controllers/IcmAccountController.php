<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\User;
use App\Support\ActivityLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class IcmAccountController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'role' => ['nullable', Rule::in(['all', 'rhu', 'provider'])],
            'status' => ['nullable', Rule::in(['all', 'active', 'disabled'])],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $role = $filters['role'] ?? 'all';
        $status = $filters['status'] ?? 'all';
        $search = trim($filters['search'] ?? '');
        $managedAccounts = User::query()->whereIn('role', ['rhu', 'provider']);

        $accounts = (clone $managedAccounts)
            ->when($role !== 'all', fn(Builder $query) => $query->where('role', $role))
            ->when($status === 'active', fn(Builder $query) => $query->whereNull('disabled_at'))
            ->when($status === 'disabled', fn(Builder $query) => $query->whereNotNull('disabled_at'))
            ->when($search !== '', function (Builder $query) use ($search) {
                $escapedSearch = addcslashes($search, '%_\\');

                $query->where(function (Builder $query) use ($escapedSearch) {
                    $query->where('name', 'like', '%' . $escapedSearch . '%')
                        ->orWhere('email', 'like', '%' . $escapedSearch . '%');
                });
            })
            ->latest()
            ->paginate(10)
            ->withQueryString()
            ->through(fn(User $account) => [
                'id' => $account->id,
                'account_id' => sprintf(
                    '%s-%s-%05d',
                    $account->role === 'provider' ? 'PRV' : 'RHU',
                    $account->created_at?->format('Y') ?? now()->format('Y'),
                    $account->id,
                ),
                'name' => $account->name,
                'email' => $account->email,
                'role' => $account->role,
                'is_active' => $account->disabled_at === null,
                'disabled_at' => $account->disabled_at?->toIso8601String(),
                'last_login_at' => $account->last_login_at?->toIso8601String(),
            ]);

        return Inertia::render('Icm/Accounts/Index', [
            'accounts' => $accounts,
            'filters' => compact('role', 'status', 'search'),
            'locations' => Location::where('level', 'municipality')
                ->orderBy('name')
                ->get(['id', 'name']),
            'stats' => [
                'total' => (clone $managedAccounts)->count(),
                'active' => (clone $managedAccounts)->whereNull('disabled_at')->count(),
                'disabled' => (clone $managedAccounts)->whereNotNull('disabled_at')->count(),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email'],
            'role' => ['required', Rule::in(['rhu', 'provider'])],
            'location_id' => [
                'nullable',
                'required_if:role,rhu',
                Rule::exists('locations', 'id')->where('level', 'municipality'),
            ],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        try {

            $account = DB::transaction(function () use ($request, $validated) {
                $account = User::create($validated);
                $account->forceFill(['email_verified_at' => now()])->save();

                ActivityLogger::record(
                    $request->user(),
                    'account.created',
                    'Created ' . $this->roleLabel($account) . ' account',
                    "{$account->name} ({$account->email}) can now sign in to CareLink.",
                    ['account_id' => $account->id],
                    $account,
                );

                return $account;
            });
        } catch (\Throwable $exception) {
            Log::error('Account creation failed', [
                'created_by' => $request->user()->id,
                'email_attemp' => $validated['email'],
                'role_attemp' => $validated['role'],
                'exception' => $exception->getMessage(),

            ]);
            throw $exception;
        }

        return back()->with('success', "Account for {$account->name} was created successfully.");
    }

    public function updateStatus(Request $request, User $account): RedirectResponse
    {
        abort_unless(in_array($account->role, ['rhu', 'provider'], true), 403);

        $validated = $request->validate([
            'active' => ['required', 'boolean'],
        ]);
        $activate = (bool) $validated['active'];

        if (($account->disabled_at === null) === $activate) {
            return back();
        }
        try {
            DB::transaction(function () use ($request, $account, $activate) {
                $account->forceFill([
                    'disabled_at' => $activate ? null : now(),
                    'remember_token' => $activate ? $account->remember_token : Str::random(60),
                ])->save();

                if (! $activate && config('session.driver') === 'database') {
                    DB::table(config('session.table', 'sessions'))
                        ->where('user_id', $account->id)
                        ->delete();
                }

                ActivityLogger::record(
                    $request->user(),
                    $activate ? 'account.enabled' : 'account.disabled',
                    ($activate ? 'Enabled ' : 'Disabled ') . $this->roleLabel($account) . ' account',
                    "{$account->name} ({$account->email}) was " . ($activate ? 'restored' : 'denied sign-in access') . '.',
                    ['account_id' => $account->id],
                    $account,
                );
            });
        } catch (\Throwable $exception) {
            Log::error('Update account failed', [
                'updated_at' => $request->user()->id,
                'account_id' => $account->id,
                'target_activation' => $activate,
                'exception' => $exception->getMessage(),
            ]);
            throw $exception;
        }

        $action = $activate ? 'enabled' : 'disabled';

        return back()->with('success', "{$account->name}'s account was {$action}.");
    }

    private function roleLabel(User $account): string
    {
        return $account->role === 'provider' ? 'provider' : 'RHU';
    }
}
