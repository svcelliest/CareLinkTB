<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class IcmController extends Controller
{
    public function dashboard(): Response
    {
        return Inertia::render('Icm/Dashboard', [
            'user' => auth()->user(),
            'stats' => [
                'total_programs' => \App\Models\Program::count(),
                'active_programs' => \App\Models\Program::active()->count(),
                'registered_patients' => \App\Models\Patient::count(),
            ],
        ]);
    }
}
