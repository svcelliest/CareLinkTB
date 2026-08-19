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
            'stats' => [],
        ]);
    }
}
