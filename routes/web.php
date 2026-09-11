<?php

use App\Http\Controllers\ActivityController;
use App\Http\Controllers\IcmAccountController;
use App\Http\Controllers\IcmArchiveController;
use App\Http\Controllers\IcmController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ProviderController;
use App\Http\Controllers\RhuController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\ProgramController;
use Illuminate\Session\Store;

Route::get('/', function () {
    if (auth()->check()) {
        return redirect()->route('dashboard');
    }

    return Inertia::render('Landing');
})->name('Landing');

Route::middleware(['auth', 'active', 'role:icm'])->group(function () {
    Route::get('icm/dashboard', [IcmController::class, 'dashboard'])->name('icm.dashboard');
    Route::get('icm/accounts', [IcmAccountController::class, 'index'])->name('icm.accounts.index');
    Route::post('icm/accounts', [IcmAccountController::class, 'store'])->name('icm.accounts.store');
    Route::patch('icm/accounts/{account}/status', [IcmAccountController::class, 'updateStatus'])
        ->name('icm.accounts.status');
    Route::get('icm/programs', [ProgramController::class, 'index'])
        ->name('icm.programs.index');
    Route::post('icm/programs', [ProgramController::class, 'store'])
        ->name('icm.programs.store');
    Route::get('icm/programs/export', [ProgramController::class, 'export'])
        ->name('icm.programs.export');
    Route::get('icm/programs/{program}', [ProgramController::class, 'show'])
        ->name('icm.programs.show');
    Route::patch('icm/programs/{program}/archive', [ProgramController::class, 'archive'])
        ->name('icm.programs.archive');
    Route::get('icm/archives', [IcmArchiveController::class, 'index'])->name('icm.archives.index');
    Route::get('icm/archives/{program}/export', [IcmArchiveController::class, 'export'])
        ->name('icm.archives.export');
    Route::patch('icm/archives/{program}/restore', [IcmArchiveController::class, 'restore'])
        ->name('icm.archives.restore');
    Route::get('icm/inbox', [MessageController::class, 'index'])->name('icm.inbox');
    Route::get('icm/activity', [ActivityController::class, 'index'])->name('icm.activity');
});

Route::middleware(['auth', 'active', 'role:rhu'])->group(function () {
    Route::get('rhu/dashboard', [RhuController::class, 'dashboard'])->name('rhu.dashboard');
    Route::get('rhu/programs', [RhuController::class, 'programs'])->name('rhu.programs.index');
    Route::get('rhu/programs/{program}', [RhuController::class, 'showProgram'])->name('rhu.programs.show');
    Route::post('rhu/programs/{program}/forms', [RhuController::class, 'storeForm'])->name('rhu.programs.forms.store');
    Route::get('rhu/inbox', [MessageController::class, 'index'])->name('rhu.inbox');
    Route::get('rhu/activity', [ActivityController::class, 'index'])->name('rhu.activity');
});

Route::middleware(['auth', 'active', 'role:provider'])->group(function () {
    Route::get('provider/dashboard', [ProviderController::class, 'dashboard'])->name('provider.dashboard');
    Route::get('provider/programs', [ProviderController::class, 'programs'])->name('provider.programs.index');
    Route::get('provider/programs/{program}', [ProviderController::class, 'showProgram'])->name('provider.programs.show');
    Route::patch('provider/programs/{program}/finish', [ProviderController::class, 'finishProgram'])->name('provider.programs.finish');
    Route::post('provider/programs/{program}/patients', [ProviderController::class, 'storePatient'])->name('provider.programs.patients.store');
    Route::patch('provider/programs/{program}/patients/{patient}', [ProviderController::class, 'updatePatient'])->name('provider.programs.patients.update');
    Route::delete('provider/programs/{program}/patients/{patient}', [ProviderController::class, 'destroyPatient'])->name('provider.programs.patients.destroy');
    Route::get('provider/inbox', [MessageController::class, 'index'])->name('provider.inbox');
    Route::get('provider/activity', [ActivityController::class, 'index'])->name('provider.activity');
});

Route::middleware(['auth', 'active'])->group(function () {
    Route::post('messages', [MessageController::class, 'store'])->name('messages.store');
    Route::patch('messages/{contact}/read', [MessageController::class, 'markRead'])->name('messages.read');
    Route::get(
        'messages/{message}/attachments/{attachment}',
        [MessageController::class, 'showAttachment'],
    )->name('messages.attachments.show');

    Route::get('notifications', [NotificationController::class, 'index'])
        ->name('notifications.index');
    Route::patch('notifications/read-all', [NotificationController::class, 'markAllRead'])
        ->name('notifications.read-all');
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markRead'])
        ->name('notifications.read');

    Route::get('profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::post('profile/avatar', [ProfileController::class, 'updateAvatar'])
        ->name('profile.avatar.update');
    Route::get('profile/avatar', [ProfileController::class, 'avatar'])
        ->name('profile.avatar');
    Route::delete('profile/avatar', [ProfileController::class, 'destroyAvatar'])
        ->name('profile.avatar.destroy');
    Route::put('profile/password', [ProfileController::class, 'updatePassword'])
        ->name('profile.password.update');
});

Route::get('/dashboard', function () {
    return match (auth()->user()->role) {
        'icm' => redirect()->route('icm.dashboard'),
        'rhu' => redirect()->route('rhu.dashboard'),
        'provider' => redirect()->route('provider.dashboard'),
        default => redirect('/'),
    };
})->middleware(['auth', 'active'])->name('dashboard');

require __DIR__ . '/auth.php';
