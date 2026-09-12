<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\ActivityLogger;
use App\Support\AklanAddresses;
use App\Support\RhuScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            ->when($role !== 'all', fn (Builder $query) => $query->where('role', $role))
            ->when($status === 'active', fn (Builder $query) => $query->whereNull('disabled_at'))
            ->when($status === 'disabled', fn (Builder $query) => $query->whereNotNull('disabled_at'))
            ->when($search !== '', function (Builder $query) use ($search) {
                $escapedSearch = addcslashes($search, '%_\\');

                $query->where(function (Builder $query) use ($escapedSearch) {
                    $query->where('name', 'like', '%'.$escapedSearch.'%')
                        ->orWhere('email', 'like', '%'.$escapedSearch.'%')
                        ->orWhere('organization', 'like', '%'.$escapedSearch.'%');
                });
            })
            ->latest()
            ->paginate(10)
            ->withQueryString()
            ->through(fn (User $account) => [
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
                'organization' => $account->organization,
                'municipality' => $account->municipality,
                // The address shown against an account. For an RHU this is
                // derived from its municipality by the same helper the RHU's
                // own account page uses, so the coordinator's list and the
                // staff member's profile always read the same.
                'location' => $account->role === 'rhu'
                    ? RhuScope::address($account)
                    : ($account->address ?: null),
                'position' => $account->position,
                'phone' => $account->phone,
                'is_active' => $account->disabled_at === null,
                'disabled_at' => $account->disabled_at?->toIso8601String(),
                'created_at' => $account->created_at?->toIso8601String(),
                'last_login_label' => $account->last_login_at?->format('M j, Y – g:i A') ?? 'Never',
            ]);

        return Inertia::render('Icm/Accounts/Index', [
            'accounts' => $accounts,
            'filters' => compact('role', 'status', 'search'),
            'stats' => [
                'total' => (clone $managedAccounts)->count(),
                'active' => (clone $managedAccounts)->whereNull('disabled_at')->count(),
                'disabled' => (clone $managedAccounts)->whereNotNull('disabled_at')->count(),
            ],
            // Same list patient registration cascades through, so the RHU
            // municipality on this form can never name a place the rest of the
            // app does not recognise.
            'municipalities' => AklanAddresses::municipalities(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email'],
            'role' => ['required', Rule::in(['rhu', 'provider'])],
            'organization' => ['nullable', 'string', 'max:150'],
            // An RHU account covers one municipality and cannot be created
            // without one. A provider is not *scoped* by its municipality —
            // it stays optional — but recording it lets the provider's profile
            // open with its address already filled in.
            'municipality' => [
                Rule::requiredIf(fn (): bool => $request->input('role') === 'rhu'),
                'nullable',
                Rule::in(AklanAddresses::municipalities()),
            ],
            'position' => ['nullable', 'string', 'max:100'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        // Only RHU scope is decided by this field, so it is left as posted.
        // An omitted or empty selection normalises to null rather than an
        // empty string, so "no municipality" is one value in the column.
        $validated['municipality'] = ($validated['municipality'] ?? null) ?: null;

        $account = DB::transaction(function () use ($request, $validated) {
            $account = User::create($validated);
            $account->forceFill(['email_verified_at' => now()])->save();

            ActivityLogger::record(
                $request->user(),
                'account.created',
                'Created '.$this->roleLabel($account).' account',
                "{$account->name} ({$account->email}) can now sign in to CareLink.",
                ['account_id' => $account->id],
                $account,
            );

            return $account;
        });

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
                ($activate ? 'Enabled ' : 'Disabled ').$this->roleLabel($account).' account',
                "{$account->name} ({$account->email}) was ".($activate ? 'restored' : 'denied sign-in access').'.',
                ['account_id' => $account->id],
                $account,
            );
        });

        $action = $activate ? 'enabled' : 'disabled';

        return back()->with('success', "{$account->name}'s account was {$action}.");
    }

    private function roleLabel(User $account): string
    {
        return $account->role === 'provider' ? 'provider' : 'RHU';
    }
}
