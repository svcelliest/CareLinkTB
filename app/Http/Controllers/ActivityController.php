<?php

namespace App\Http\Controllers;

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
            'category' => ['nullable', Rule::in(['all', 'accounts', 'messages', 'profile', 'security'])],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $category = $filters['category'] ?? 'all';
        $search = trim($filters['search'] ?? '');
        $query = $request->user()->activities()->with('subject');

        if ($category !== 'all') {
            $prefix = match ($category) {
                'accounts' => 'account.',
                'messages' => 'message.',
                'security' => 'security.',
                default => 'profile.',
            };

            $query->where('type', 'like', $prefix . '%');
        }

        if ($search !== '') {
            $escapedSearch = addcslashes($search, '%_\\');
            $query->where(function (Builder $query) use ($escapedSearch) {
                $query->where('title', 'like', '%' . $escapedSearch . '%')
                    ->orWhere('description', 'like', '%' . $escapedSearch . '%');
            });
        }

        $activities = $query
            ->latest()
            ->paginate(15)
            ->withQueryString()
            ->through(fn($activity) => ActivityPresenter::make($activity, $request->user()));

        return Inertia::render('Activity/Index', [
            'role' => $request->user()->role,
            'activities' => $activities,
            'filters' => [
                'category' => $category,
                'search' => $search,
            ],
        ]);
    }
}
