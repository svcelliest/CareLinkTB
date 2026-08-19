<?php

namespace App\Http\Controllers;


use Inertia\Inertia;
use Inertia\Response;

class RhuController extends Controller
{
    public function dashboard(): Response
    {
        return Inertia::render('Rhu/Dashboard', [
            'user' => auth()->user(),
            'stats' => [],
        ]);
    }
}
