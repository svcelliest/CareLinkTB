<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Support\ActivityLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthenticatedSessionController extends Controller
{
    /**
     * The login form now lives in the Landing page's LoginModal, so this
     * just sends direct visitors back there instead of the old full page.
     */
    public function create(): RedirectResponse
    {
        return redirect('/');
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        ActivityLogger::record(
            $request->user(),
            'security.signed_in',
            'Signed in to CareLink',
            'A new session was started for your account.',
        );

        return match ($request->user()->role) {
            'icm' => redirect()->intended(route('icm.dashboard', [], false)),
            'rhu' => redirect()->intended(route('rhu.dashboard', [], false)),
            'provider' => redirect()->intended(route('provider.dashboard', [], false)),
            default => redirect('/'),
        };
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect('/');
    }
}
