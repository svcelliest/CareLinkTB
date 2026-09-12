<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\PasswordResetOtpController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('login', [AuthenticatedSessionController::class, 'create'])
        ->name('login');

    Route::post('login', [AuthenticatedSessionController::class, 'store']);

    // Password recovery for the landing page's login modal. Throttles are per
    // IP; the controller separately limits guesses against an issued code.
    Route::post('forgot-password/otp', [PasswordResetOtpController::class, 'send'])
        ->middleware('throttle:6,1')
        ->name('password.otp.send');

    Route::post('forgot-password/otp/verify', [PasswordResetOtpController::class, 'verify'])
        ->middleware('throttle:20,1')
        ->name('password.otp.verify');

    Route::post('forgot-password/reset', [PasswordResetOtpController::class, 'reset'])
        ->middleware('throttle:6,1')
        ->name('password.otp.reset');

});

Route::middleware('auth')->group(function () {
    Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])
        ->name('logout');
});
