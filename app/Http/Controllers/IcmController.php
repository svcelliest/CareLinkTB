<?php

namespace App\Http\Controllers;

use App\Support\TbAnalytics;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class IcmController extends Controller
{
    public function dashboard(Request $request): Response
    {
        $options = TbAnalytics::filterOptions();

        $filters = $request->validate([
            'scope' => ['nullable', Rule::in(['overall', 'municipality'])],
            'municipality' => ['nullable', Rule::in($options['municipalities'])],
            'year' => ['nullable', 'string', 'max:4'],
        ]);

        $scope = $filters['scope'] ?? 'overall';
        $municipality = $filters['municipality'] ?? ($options['municipalities'][0] ?? null);
        $year = $filters['year'] ?? 'all';

        if ($year !== 'all' && ! in_array((int) $year, $options['years'], true)) {
            $year = 'all';
        }

        return Inertia::render('Icm/Dashboard', [
            'filters' => [
                'scope' => $scope,
                'municipality' => $municipality,
                'year' => $year,
            ],
            'options' => $options,
            // Re-fetched on its own when a filter changes, so switching
            // scope/municipality/year doesn't reload the whole page.
            'analytics' => fn () => TbAnalytics::build($scope, $municipality, $year),
        ]);
    }
}
