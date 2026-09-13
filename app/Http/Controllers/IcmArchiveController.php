<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\Program;
use App\Models\User;
use App\Support\ActivityLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class IcmArchiveController extends Controller
{
    public function index(Request $request): Response
    {
        $coordinator = $request->user();

        abort_unless($coordinator instanceof User && $coordinator->role === 'icm', 403);

        $filters = $request->validate([
            'location_id' => ['nullable', 'integer'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $search = trim($filters['search'] ?? '');

        $programs = $coordinator->createdPrograms()
            ->with('location')
            ->whereNotNull('archived_at')
            ->when($filters['location_id'] ?? null, fn ($query, $locationId) => $query->where('location_id', $locationId))
            ->when($search !== '', function ($query) use ($search) {
                $query->where('name', 'like', '%' . addcslashes($search, '%_\\') . '%');
            })
            ->orderByDesc('archived_at')
            ->get()
            ->map(fn (Program $program) => [
                'id' => $program->id,
                'name' => $program->name,
                'location' => $program->location?->name,
                'location_id' => $program->location_id,
                'archived_at' => $program->archived_at->format('M j, Y'),
            ]);

        return Inertia::render('Icm/Archives/Index', [
            'programs' => $programs,
            'locations' => Location::where('level', 'municipality')
                ->orderBy('name')
                ->get(['id', 'name']),
            'filters' => [
                'location_id' => $filters['location_id'] ?? null,
                'search' => $search,
            ],
        ]);
    }

    public function export(Request $request, Program $program): StreamedResponse
    {
        $coordinator = $request->user();

        abort_unless(
            $coordinator instanceof User
                && $coordinator->role === 'icm'
                && $program->created_by === $coordinator->id
                && $program->archived_at !== null,
            403,
        );

        $program->loadMissing('location');

        return response()->streamDownload(function () use ($program): void {
            $file = fopen('php://output', 'w');

            fputcsv($file, ['Program Name', 'Location', 'Scheduled At', 'Archived At']);
            fputcsv($file, [
                $program->name,
                $program->location?->name,
                $program->scheduled_at->toIso8601String(),
                $program->archived_at->toIso8601String(),
            ]);

            fclose($file);
        }, preg_replace('/[^A-Za-z0-9_\-]+/', '_', $program->name) . '_archive.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function restore(Request $request, Program $program): RedirectResponse
    {
        $coordinator = $request->user();

        abort_unless(
            $coordinator instanceof User
                && $coordinator->role === 'icm'
                && $program->created_by === $coordinator->id,
            403,
        );
        abort_unless($program->archived_at !== null, 422);

        $program->forceFill(['archived_at' => null])->save();

        ActivityLogger::record(
            $coordinator,
            'program.restored',
            'Restored program',
            "{$program->name} was restored from the archive.",
            ['program_id' => $program->id],
            $program,
        );

        return back()->with('success', "{$program->name} was restored.");
    }
}
