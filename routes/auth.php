<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\PasswordOtpController;

Route::middleware('guest')->group(function () {
    Route::get('login', [AuthenticatedSessionController::class, 'create'])
        ->name('login');

    Route::post('login', [AuthenticatedSessionController::class, 'store']);
    Route::post('password/otp/send', [PasswordOtpController::class, 'sendOtp'])
        ->middleware('throttle:5,1')
        ->name('password.otp.send');

    Route::post('password/otp/verify', [PasswordOtpController::class, 'verifyOtp'])
        ->middleware('throttle:10,1')
        ->name('password.otp.verify');

    Route::post('password/reset', [PasswordOtpController::class, 'reset'])
        ->middleware('throttle:10,1')
        ->name('password.reset');
});

Route::middleware('auth')->group(function () {
    Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])
        ->name('logout');
});
