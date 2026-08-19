<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;

class ProviderController extends Controller
{
    public function dashboard()
    {
        return Inertia::render('Provider/Dashboard', [
            'user' => auth()->user(),
        ]);
    }
}
