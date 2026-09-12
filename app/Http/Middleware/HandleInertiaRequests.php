<?php

namespace App\Http\Middleware;

use App\Support\NotificationPresenter;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'account_id' => sprintf(
                        '%s-%s-%05d',
                        match ($user->role) {
                            'provider' => 'PRV',
                            default => Str::upper((string) $user->role),
                        },
                        $user->created_at?->format('Y') ?? now()->format('Y'),
                        $user->id,
                    ),
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'phone' => $user->phone,
                    'organization' => $user->organization,
                    // The RHU sidebar names the unit under its logo, the way
                    // the portal reference does. Shared here rather than on
                    // each RHU page so the shell has it on every visit.
                    'municipality' => $user->municipality,
                    'position' => $user->position,
                    'address' => $user->address,
                    'bio' => $user->bio,
                    'avatar_url' => $user->avatar_path
                        ? route('profile.avatar', ['v' => $user->updated_at?->timestamp])
                        : null,
                ] : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            // Used by the shared sidebar to show an inbox badge on every dashboard page.
            'unreadMessageCount' => fn () => $user
                ? $user->receivedMessages()->whereNull('read_at')->count()
                : 0,
            'unreadNotificationCount' => fn () => $user
                ? $user->unreadNotifications()->count()
                : 0,
            'recentNotifications' => fn () => $user
                ? $user->notifications()
                    ->latest()
                    ->limit(6)
                    ->get()
                    ->map(fn ($notification) => NotificationPresenter::make($notification))
                    ->values()
                : [],
        ];
    }
}
