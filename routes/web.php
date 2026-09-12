<?php

use App\Http\Controllers\ActivityController;
use App\Http\Controllers\IcmAccountController;
use App\Http\Controllers\IcmContactTracingController;
use App\Http\Controllers\IcmController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ProviderController;
use App\Http\Controllers\RhuController;
use App\Http\Controllers\RhuPatientTrackerController;
use App\Http\Controllers\RhuSmsLogController;
use App\Http\Controllers\RhuTreatmentController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\ProgramController;

// From welcome to landing page here
Route::get('/', function () {
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
    Route::patch('icm/programs/{program}', [ProgramController::class, 'update'])
        ->name('icm.programs.update');
    Route::patch('icm/programs/{program}/records', [ProgramController::class, 'updateRecords'])
        ->name('icm.programs.records.update');
    Route::patch('icm/programs/{program}/archive', [ProgramController::class, 'archive'])
        ->name('icm.programs.archive');
    Route::patch('icm/programs/{program}/restore', [ProgramController::class, 'restore'])
        ->name('icm.programs.restore');
    // Contact Tracing: patients under treatment, and the ACF report the RHU
    // filed for them. Read-only — the treatment workflow itself stays in the
    // RHU portal.
    Route::get('icm/contact-tracing', [IcmContactTracingController::class, 'index'])
        ->name('icm.contact-tracing.index');
    Route::get('icm/contact-tracing/{case}', [IcmContactTracingController::class, 'show'])
        ->name('icm.contact-tracing.show');

    Route::get('icm/archives', [ProgramController::class, 'archives'])->name('icm.archives.index');
    Route::get('icm/inbox', [MessageController::class, 'index'])->name('icm.inbox');
    Route::get('icm/activity', [ActivityController::class, 'index'])->name('icm.activity');
});

Route::middleware(['auth', 'active', 'role:rhu'])->group(function () {
    Route::get('rhu/dashboard', [RhuController::class, 'dashboard'])->name('rhu.dashboard');

    // The RHU has no Programs screen of its own. Programs remain ICM-owned and
    // reach the RHU through the Patient Tracker, whose program filter narrows
    // the roster to one of the ICM's programs.

    // Patient Tracker: Sputum Collection (read-only, ICM-owned) and Diagnostic
    // Assessment (RHU-owned). Only the diagnostic half has a write route.
    Route::get('rhu/patient-tracker', [RhuPatientTrackerController::class, 'index'])
        ->name('rhu.tracker.index');
    Route::patch('rhu/patient-tracker/diagnostic', [RhuPatientTrackerController::class, 'updateDiagnostic'])
        ->name('rhu.tracker.diagnostic.update');

    // Patient Monitoring: enrolment, the six-month record, and case closure.
    Route::get('rhu/patient-monitoring', [RhuTreatmentController::class, 'index'])
        ->name('rhu.treatment.index');
    Route::post('rhu/patient-monitoring', [RhuTreatmentController::class, 'store'])
        ->name('rhu.treatment.store');
    Route::get('rhu/patient-monitoring/{case}', [RhuTreatmentController::class, 'show'])
        ->name('rhu.treatment.show');
    Route::patch('rhu/patient-monitoring/{case}/monitoring', [RhuTreatmentController::class, 'updateMonitoring'])
        ->name('rhu.treatment.monitoring.update');

    // Weekly medication dispensing: one endpoint records a new visit, the same
    // one amends an existing record when the row is named.
    Route::post('rhu/patient-monitoring/{case}/dispensing', [RhuTreatmentController::class, 'storeDispensing'])
        ->name('rhu.treatment.dispensing.store');
    Route::patch('rhu/patient-monitoring/{case}/dispensing/{record}', [RhuTreatmentController::class, 'storeDispensing'])
        ->name('rhu.treatment.dispensing.update');

    Route::patch('rhu/patient-monitoring/{case}/followups/{followup}', [RhuTreatmentController::class, 'updateFollowup'])
        ->name('rhu.treatment.followups.update');
    Route::put('rhu/patient-monitoring/{case}/contact-tracing', [RhuTreatmentController::class, 'saveContactTracing'])
        ->name('rhu.treatment.contact-tracing.save');

    Route::patch('rhu/patient-monitoring/{case}/outcome', [RhuTreatmentController::class, 'updateOutcome'])
        ->name('rhu.treatment.outcome.update');

    Route::get('rhu/sms-log', [RhuSmsLogController::class, 'index'])->name('rhu.sms.index');
    Route::post('rhu/sms-log', [RhuSmsLogController::class, 'store'])->name('rhu.sms.store');

    Route::get('rhu/inbox', [MessageController::class, 'index'])->name('rhu.inbox');
    Route::get('rhu/activity', [ActivityController::class, 'index'])->name('rhu.activity');
});

Route::middleware(['auth', 'active', 'role:provider'])->group(function () {
    Route::get('provider/dashboard', [ProviderController::class, 'dashboard'])->name('provider.dashboard');
    Route::get('provider/programs', [ProviderController::class, 'programs'])->name('provider.programs.index');
    Route::get('provider/programs/{program}', [ProviderController::class, 'showProgram'])->name('provider.programs.show');
    Route::patch('provider/programs/{program}/finish', [ProviderController::class, 'finishProgram'])->name('provider.programs.finish');
    Route::post('provider/programs/{program}/patients', [ProviderController::class, 'storePatient'])
        ->name('provider.programs.patients.store');
    Route::patch('provider/programs/{program}/patients/{patient}', [ProviderController::class, 'updatePatient'])
        ->name('provider.programs.patients.update');
    Route::patch('provider/programs/{program}/patients/{patient}/presumptive', [ProviderController::class, 'togglePatientPresumptive'])
        ->name('provider.programs.patients.presumptive');
    Route::post('provider/programs/{program}/patients/{patient}/notify', [ProviderController::class, 'notifyPatient'])
        ->name('provider.programs.patients.notify');
    Route::delete('provider/programs/{program}/patients/{patient}', [ProviderController::class, 'destroyPatient'])
        ->name('provider.programs.patients.destroy');
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
