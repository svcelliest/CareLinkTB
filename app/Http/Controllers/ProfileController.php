<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateAvatarRequest;
use App\Http\Requests\UpdatePasswordRequest;
use App\Http\Requests\UpdateProfileRequest;
use App\Support\ActivityLogger;
use App\Support\AklanAddresses;
use App\Support\RhuScope;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Profile/Edit', [
            'role' => $user->role,
            // Non-null only for an RHU account with a municipality. The page
            // shows it in place of the typed address and locks the field, and
            // update() writes the same value, so the two can never disagree —
            // including for accounts created before this was derived.
            'derivedAddress' => RhuScope::address($user),
            // A provider is assigned a municipality when the account is
            // created. It seeds the Address field so they never have to name a
            // place the account already records. Unlike the RHU's derived
            // address this is a starting value, not a lock — a provider works
            // across a catchment and may refine it.
            'assignedAddress' => $user->role === 'provider' && $user->municipality !== null
                ? $user->municipality.', '.AklanAddresses::province()
                : null,
        ]);
    }

    public function update(UpdateProfileRequest $request): RedirectResponse
    {
        $user = $request->user();
        $emailChanged = $user->email !== $request->validated('email');

        $user->fill($request->validated());

        // An RHU's address belongs to its municipality, not to whatever the
        // form posted. Enforced here rather than only in the browser, so a
        // crafted request cannot put an RHU somewhere it does not cover.
        $derivedAddress = RhuScope::address($user);

        if ($derivedAddress !== null) {
            $user->address = $derivedAddress;
        }

        $changedFields = array_keys($user->getDirty());

        if ($emailChanged) {
            $user->email_verified_at = null;
        }

        if ($user->isDirty()) {
            DB::transaction(function () use ($user, $changedFields): void {
                $user->save();

                ActivityLogger::record(
                    $user,
                    'profile.updated',
                    'Updated profile details',
                    'Your account information was changed.',
                    ['fields' => $changedFields],
                );
            });
        }

        return back()->with('success', 'Profile details updated.');
    }

    public function updateAvatar(UpdateAvatarRequest $request): RedirectResponse
    {
        $user = $request->user();
        $file = $request->file('avatar');
        $extension = $file->extension();
        $filename = (string) Str::uuid();

        if ($extension) {
            $filename .= '.'.$extension;
        }

        $path = $file->storeAs('profile-avatars/'.$user->id, $filename, 'local');

        if ($path === false) {
            return back()->withErrors([
                'avatar' => 'The profile photo could not be stored.',
            ]);
        }

        $previousPath = $user->avatar_path;

        try {
            DB::transaction(function () use ($user, $path): void {
                $user->update(['avatar_path' => $path]);

                ActivityLogger::record(
                    $user,
                    'profile.avatar_updated',
                    'Updated profile photo',
                    'Your account profile photo was changed.',
                );
            });
        } catch (Throwable $exception) {
            Storage::disk('local')->delete($path);

            throw $exception;
        }

        if ($previousPath) {
            Storage::disk('local')->delete($previousPath);
        }

        return back()->with('success', 'Profile photo updated.');
    }

    public function destroyAvatar(Request $request): RedirectResponse
    {
        $user = $request->user();
        $path = $user->avatar_path;

        if ($path) {
            DB::transaction(function () use ($user): void {
                $user->update(['avatar_path' => null]);

                ActivityLogger::record(
                    $user,
                    'profile.avatar_removed',
                    'Removed profile photo',
                    'Your account profile photo was removed.',
                );
            });

            Storage::disk('local')->delete($path);
        }

        return back()->with('success', 'Profile photo removed.');
    }

    public function avatar(Request $request): StreamedResponse
    {
        $path = $request->user()->avatar_path;
        abort_unless($path, 404);

        $storage = Storage::disk('local');
        abort_unless($storage->exists($path), 404);

        return $storage->response($path, null, [
            'Cache-Control' => 'private, max-age=86400',
            'Content-Type' => $storage->mimeType($path) ?: 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function updatePassword(UpdatePasswordRequest $request): RedirectResponse
    {
        DB::transaction(function () use ($request): void {
            $request->user()->update([
                'password' => Hash::make($request->validated('password')),
            ]);

            ActivityLogger::record(
                $request->user(),
                'security.password_updated',
                'Changed account password',
                'Your CareLink password was updated.',
            );
        });

        return back()->with('success', 'Password updated successfully.');
    }
}
