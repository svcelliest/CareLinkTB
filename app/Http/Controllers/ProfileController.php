<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateAvatarRequest;
use App\Http\Requests\UpdatePasswordRequest;
use App\Http\Requests\UpdateProfileRequest;
use App\Support\ActivityLogger;
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
        return Inertia::render('Profile/Edit', [
            'role' => $request->user()->role,
        ]);
    }

    public function update(UpdateProfileRequest $request): RedirectResponse
    {
        $user = $request->user();
        $emailChanged = $user->email !== $request->validated('email');

        $user->fill($request->validated());

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
