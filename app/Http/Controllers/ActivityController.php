<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Support\ActivityPresenter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ActivityController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'category' => ['nullable', Rule::in(['all', 'accounts', 'programs', 'messages', 'profile', 'security'])],
            'role' => ['nullable', Rule::in(['all', 'icm', 'rhu', 'provider'])],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $category = $filters['category'] ?? 'all';
        $roleFilter = $filters['role'] ?? 'all';
        $search = trim($filters['search'] ?? '');

        // ICM coordinates every RHU/Provider account, so their feed is a
        // system-wide activity log rather than just their own actions —
        // everyone else still only sees what they themselves did.
        $isGlobal = $request->user()->role === 'icm';

        $query = $isGlobal
            ? Activity::query()->with(['user', 'subject'])
            : $request->user()->activities()->with('subject');

        if ($category !== 'all') {
            $prefix = match ($category) {
                'accounts' => 'account.',
                'programs' => 'program.',
                'messages' => 'message.',
                'security' => 'security.',
                default => 'profile.',
            };

            $query->where('type', 'like', $prefix . '%');
        }

        // Only meaningful on the global (ICM) feed — everyone else's own
        // activity is already implicitly scoped to a single role.
        if ($isGlobal && $roleFilter !== 'all') {
            $query->whereHas('user', function (Builder $userQuery) use ($roleFilter) {
                $userQuery->where('role', $roleFilter);
            });
        }

        if ($search !== '') {
            $escapedSearch = addcslashes($search, '%_\\');
            $query->where(function (Builder $query) use ($escapedSearch, $isGlobal) {
                $query->where('title', 'like', '%' . $escapedSearch . '%')
                    ->orWhere('description', 'like', '%' . $escapedSearch . '%');

                if ($isGlobal) {
                    $query->orWhereHas('user', function (Builder $userQuery) use ($escapedSearch) {
                        $userQuery->where('name', 'like', '%' . $escapedSearch . '%');
                    });
                }
            });
        }

        $activities = $query
            ->latest()
            ->paginate(10)
            ->withQueryString()
            ->through(fn($activity) => ActivityPresenter::make($activity, $request->user()));

        return Inertia::render('Activity/Index', [
            'role' => $request->user()->role,
            'activities' => $activities,
            'isGlobal' => $isGlobal,
            'filters' => [
                'category' => $category,
                'role' => $roleFilter,
                'search' => $search,
            ],
        ]);
    }
}
