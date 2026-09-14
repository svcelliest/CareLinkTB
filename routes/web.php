<?php

use App\Http\Controllers\ActivityController;
use App\Http\Controllers\AuditTrailController;
use App\Http\Controllers\BhwController;
use App\Http\Controllers\ContactTracingController;
use App\Http\Controllers\DiagnosticAssessmentController;
use App\Http\Controllers\FollowUpExamController;
use App\Http\Controllers\IcmAccountController;
use App\Http\Controllers\IcmArchiveController;
use App\Http\Controllers\IcmController;
use App\Http\Controllers\MedicationDispensingController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PatientSummaryController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ProgramController;
use App\Http\Controllers\ProviderController;
use App\Http\Controllers\RhuController;
use App\Http\Controllers\SmsLogController;
use App\Http\Controllers\SputumCollectionController;
use App\Http\Controllers\TreatmentEnrollmentController;
use App\Http\Controllers\TreatmentMonitoringController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

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
    Route::get('icm/patients/{patient}/sputum-collection', [SputumCollectionController::class, 'show'])
        ->name('icm.patients.sputum-collection.show');
    Route::post('icm/patients/{patient}/sputum-collection', [SputumCollectionController::class, 'store'])
        ->name('icm.patients.sputum-collection.store');
    Route::get('icm/patients/{patient}/diagnostic-assessment', [DiagnosticAssessmentController::class, 'show'])
        ->name('icm.patients.diagnostic-assessment.show');
});

Route::middleware(['auth', 'active', 'role:rhu'])->group(function () {
    Route::get('rhu/dashboard', [RhuController::class, 'dashboard'])->name('rhu.dashboard');
    Route::get('rhu/programs', [RhuController::class, 'programs'])->name('rhu.programs.index');
    Route::get('rhu/programs/{program}', [RhuController::class, 'showProgram'])->name('rhu.programs.show');
    Route::post('rhu/programs/{program}/forms', [RhuController::class, 'storeForm'])->name('rhu.programs.forms.store');
    Route::get('rhu/patients/{patient}/enroll', [TreatmentEnrollmentController::class, 'create'])
        ->name('rhu.patients.enroll.create');
    Route::post('rhu/patients/{patient}/enroll', [TreatmentEnrollmentController::class, 'store'])
        ->name('rhu.patients.enroll.store');
    Route::get('rhu/patients/{patient}/audit-trail', [AuditTrailController::class, 'index'])
        ->name('rhu.patients.audit-trail.index');
    Route::get('rhu/patients/{patient}/contact-tracing', [ContactTracingController::class, 'show'])
        ->name('rhu.patients.contact-tracing.show');
    Route::post('rhu/patients/{patient}/contact-tracing', [ContactTracingController::class, 'store'])
        ->name('rhu.patients.contact-tracing.store');
    Route::get('rhu/treatment-enrollments/{treatmentEnrollment}/summary', [PatientSummaryController::class, 'show'])
        ->name('rhu.treatment-enrollments.summary.show');
    Route::get('rhu/treatment-enrollments/{treatmentEnrollment}/outcome', [TreatmentEnrollmentController::class, 'showOutcome'])
        ->name('rhu.treatment-enrollments.outcome.show');
    Route::patch('rhu/treatment-enrollments/{treatmentEnrollment}/outcome', [TreatmentEnrollmentController::class, 'updateOutcome'])
        ->name('rhu.treatment-enrollments.outcome.update');
    Route::get('rhu/treatment-enrollments/{treatmentEnrollment}/monitoring', [TreatmentMonitoringController::class, 'index'])
        ->name('rhu.treatment-enrollments.monitoring.index');
    Route::post('rhu/treatment-enrollments/{treatmentEnrollment}/monitoring', [TreatmentMonitoringController::class, 'store'])
        ->name('rhu.treatment-enrollments.monitoring.store');
    Route::get('rhu/treatment-enrollments/{treatmentEnrollment}/follow-up-exams', [FollowUpExamController::class, 'index'])
        ->name('rhu.treatment-enrollments.follow-up-exams.index');
    Route::post('rhu/treatment-enrollments/{treatmentEnrollment}/follow-up-exams', [FollowUpExamController::class, 'store'])
        ->name('rhu.treatment-enrollments.follow-up-exams.store');
    Route::get('rhu/treatment-monitoring/{treatmentMonitoringRecord}/dispensing', [MedicationDispensingController::class, 'index'])
        ->name('rhu.treatment-monitoring.dispensing.index');
    Route::post('rhu/treatment-monitoring/{treatmentMonitoringRecord}/dispensing', [MedicationDispensingController::class, 'store'])
        ->name('rhu.treatment-monitoring.dispensing.store');
    Route::get('rhu/bhws', [BhwController::class, 'index'])->name('rhu.bhws.index');
    Route::post('rhu/bhws', [BhwController::class, 'store'])->name('rhu.bhws.store');
    Route::delete('rhu/bhws/{bhw}', [BhwController::class, 'destroy'])->name('rhu.bhws.destroy');
    Route::get('rhu/sms-logs', [SmsLogController::class, 'index'])->name('rhu.sms-logs.index');
    Route::post('rhu/sms-logs', [SmsLogController::class, 'store'])->name('rhu.sms-logs.store');
    Route::get('rhu/inbox', [MessageController::class, 'index'])->name('rhu.inbox');
    Route::get('rhu/activity', [ActivityController::class, 'index'])->name('rhu.activity');
    Route::get('rhu/patients/{patient}/diagnostic-assessment', [DiagnosticAssessmentController::class, 'show'])
        ->name('rhu.patients.diagnostic-assessment.show');
    Route::post('rhu/patients/{patient}/diagnostic-assessment', [DiagnosticAssessmentController::class, 'store'])
        ->name('rhu.patients.diagnostic-assessment.store');
    Route::get('rhu/patients/{patient}/sputum-collection', [SputumCollectionController::class, 'show'])
        ->name('rhu.patients.sputum-collection.show');
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

require __DIR__.'/auth.php';
