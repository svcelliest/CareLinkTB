<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ResetPasswordWithOtpRequest;
use App\Http\Requests\Auth\SendPasswordResetOtpRequest;
use App\Http\Requests\Auth\VerifyPasswordResetOtpRequest;
use App\Models\User;
use App\Notifications\PasswordResetOtp;
use App\Support\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Password recovery for the landing page's login modal.
 *
 * The modal collects a 6-digit one-time code rather than following an emailed
 * reset link, so this controller stores a hashed code in Laravel's existing
 * `password_reset_tokens` table instead of using the stock password broker.
 * The three steps are deliberately separate requests because the modal shows
 * them as separate screens. They answer with JSON rather than an Inertia
 * redirect so the modal keeps its own screen state across steps; failed
 * validation still returns Laravel's standard 422 error payload.
 */
class PasswordResetOtpController extends Controller
{
    /** How long an issued code stays valid. */
    private const CODE_TTL_MINUTES = 10;

    /** How long a verified code authorizes the final password change. */
    private const VERIFIED_TTL_MINUTES = 15;

    /** Wrong guesses allowed before the code is burned. */
    private const MAX_ATTEMPTS = 5;

    private const SESSION_EMAIL = 'password_reset_otp.email';

    private const SESSION_VERIFIED_AT = 'password_reset_otp.verified_at';

    /**
     * Step 1 — issue a code.
     *
     * The response is identical whether or not the address belongs to an
     * account, so this endpoint cannot be used to discover registered users.
     */
    public function send(SendPasswordResetOtpRequest $request): RedirectResponse
    {
        $email = $this->normalizeEmail($request->validated('email'));
        $user = $this->resolveUser($email);

        if ($user) {
            $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $email],
                [
                    'token' => Hash::make($code),
                    'created_at' => now(),
                ],
            );

            $request->session()->put($this->attemptsKey($email), 0);

            $user->notify(new PasswordResetOtp($code, self::CODE_TTL_MINUTES));
        }

        $request->session()->forget([self::SESSION_EMAIL, self::SESSION_VERIFIED_AT]);

        return back()->with('status', 'If that address belongs to a CareLink TB account, a code is on its way.');
    }

    /**
     * Step 2 — check the code.
     */
    public function verify(VerifyPasswordResetOtpRequest $request): RedirectResponse
    {
        $email = $this->normalizeEmail($request->validated('email'));
        $record = DB::table('password_reset_tokens')->where('email', $email)->first();

        if (! $record || $this->isExpired($record->created_at)) {
            $this->discardCode($request, $email);

            throw ValidationException::withMessages([
                'otp' => 'That code has expired. Request a new one.',
            ]);
        }

        $attempts = (int) $request->session()->get($this->attemptsKey($email), 0);

        if ($attempts >= self::MAX_ATTEMPTS) {
            $this->discardCode($request, $email);

            throw ValidationException::withMessages([
                'otp' => 'Too many incorrect attempts. Request a new code.',
            ]);
        }

        if (! Hash::check($request->validated('otp'), $record->token)) {
            $request->session()->put($this->attemptsKey($email), $attempts + 1);

            throw ValidationException::withMessages([
                'otp' => 'Incorrect OTP. Please try again.',
            ]);
        }

        // The code is correct. Authorize the password change for a short window
        // instead of trusting the email the browser posts in the next step.
        $request->session()->put(self::SESSION_EMAIL, $email);
        $request->session()->put(self::SESSION_VERIFIED_AT, now()->toIso8601String());
        $request->session()->forget($this->attemptsKey($email));

        return back();
    }

    /**
     * Step 3 — set the new password.
     */
    public function reset(ResetPasswordWithOtpRequest $request): RedirectResponse
    {
        $email = $request->session()->get(self::SESSION_EMAIL);
        $verifiedAt = $request->session()->get(self::SESSION_VERIFIED_AT);

        if (! $email || ! $verifiedAt || now()->greaterThan(Carbon::parse($verifiedAt)->addMinutes(self::VERIFIED_TTL_MINUTES))) {
            $request->session()->forget([self::SESSION_EMAIL, self::SESSION_VERIFIED_AT]);

            throw ValidationException::withMessages([
                'password' => 'This reset session has expired. Start again.',
            ]);
        }

        $user = $this->resolveUser($email);

        if (! $user) {
            $request->session()->forget([self::SESSION_EMAIL, self::SESSION_VERIFIED_AT]);

            throw ValidationException::withMessages([
                'password' => 'This reset session is no longer valid. Start again.',
            ]);
        }

        $user->forceFill([
            'password' => $request->validated('password'),
            'remember_token' => Str::random(60),
        ])->save();

        DB::table('password_reset_tokens')->where('email', $email)->delete();
        $request->session()->forget([self::SESSION_EMAIL, self::SESSION_VERIFIED_AT, $this->attemptsKey($email)]);

        ActivityLogger::record(
            $user,
            'security.password_reset',
            'Reset account password',
            'Your password was changed using an emailed one-time code.',
        );

        return back()->with('status', 'Your password has been reset.');
    }

    /**
     * Disabled accounts are treated as if they do not exist, matching login.
     */
    private function resolveUser(string $email): ?User
    {
        return User::query()
            ->where('email', $email)
            ->whereNull('disabled_at')
            ->first();
    }

    private function normalizeEmail(string $email): string
    {
        return Str::lower(trim($email));
    }

    private function isExpired(?string $createdAt): bool
    {
        return ! $createdAt || now()->greaterThan(Carbon::parse($createdAt)->addMinutes(self::CODE_TTL_MINUTES));
    }

    private function discardCode(Request $request, string $email): void
    {
        DB::table('password_reset_tokens')->where('email', $email)->delete();
        $request->session()->forget([$this->attemptsKey($email), self::SESSION_EMAIL, self::SESSION_VERIFIED_AT]);
    }

    private function attemptsKey(string $email): string
    {
        return 'password_reset_otp.attempts.'.sha1($email);
    }
}
