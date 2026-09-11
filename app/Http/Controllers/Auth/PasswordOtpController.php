<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Mail\PasswordResetOtpMail;
use App\Models\User;
use App\Support\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class PasswordOtpController extends Controller
{
    private const OTP_TTL_MINUTES = 10;

    private const RESET_TOKEN_TTL_MINUTES = 15;

    /**
     * Send a one-time password to the given email, if an account for it exists.
     * The response is identical either way so we don't leak account existence.
     */
    public function sendOtp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email'],
        ]);

        $email = $data['email'];

        $user = User::query()->where('email', $email)->first();

        if ($user) {
            $otp = (string) random_int(100000, 999999);

            DB::table('password_reset_tokens')->where('email', $email)->delete();

            DB::table('password_reset_tokens')->insert([
                'email' => $email,
                'token' => Hash::make($otp),
                'verified_at' => null,
                'created_at' => now(),
            ]);

            Mail::to($email)->send(new PasswordResetOtpMail($otp, self::OTP_TTL_MINUTES));
        }

        return response()->json([
            'message' => 'If that email exists, a code was sent.',
        ]);
    }

    /**
     * Verify the OTP and issue a short-lived reset token for the final step.
     */
    public function verifyOtp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email'],
            'otp' => ['required', 'string'],
        ]);

        $row = DB::table('password_reset_tokens')
            ->where('email', $data['email'])
            ->whereNull('verified_at')
            ->where('created_at', '>=', now()->subMinutes(self::OTP_TTL_MINUTES))
            ->first();

        if (! $row || ! Hash::check($data['otp'], $row->token)) {
            throw ValidationException::withMessages([
                'otp' => 'That code is invalid or has expired.',
            ]);
        }

        $resetToken = Str::random(64);

        DB::table('password_reset_tokens')
            ->where('email', $data['email'])
            ->update([
                'token' => Hash::make($resetToken),
                'verified_at' => now(),
            ]);

        return response()->json([
            'reset_token' => $resetToken,
        ]);
    }

    /**
     * Apply the new password once a verified reset token is presented.
     */
    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email'],
            'reset_token' => ['required', 'string'],
            'password' => ['required', Password::defaults(), 'confirmed'],
        ]);

        $row = DB::table('password_reset_tokens')
            ->where('email', $data['email'])
            ->whereNotNull('verified_at')
            ->where('verified_at', '>=', now()->subMinutes(self::RESET_TOKEN_TTL_MINUTES))
            ->first();

        if (! $row || ! Hash::check($data['reset_token'], $row->token)) {
            throw ValidationException::withMessages([
                'reset_token' => 'This reset session is invalid or has expired. Please request a new code.',
            ]);
        }

        $user = User::query()->where('email', $data['email'])->firstOrFail();
        $user->password = $data['password'];
        $user->save();

        DB::table('password_reset_tokens')->where('email', $data['email'])->delete();

        ActivityLogger::record(
            $user,
            'security.password_reset',
            'Password reset',
            'Your password was reset via the forgot-password flow.',
        );

        return response()->json([
            'message' => 'Password reset successfully.',
        ]);
    }
}
