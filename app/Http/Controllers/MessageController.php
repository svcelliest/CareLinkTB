<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMessageRequest;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\User;
use App\Notifications\MessageReceived;
use App\Support\ActivityLogger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class MessageController extends Controller
{
    public function index(Request $request): Response
    {
        $currentUser = $request->user();
        $contactModels = User::query()
            ->whereKeyNot($currentUser->id)
            ->whereNotNull('role')
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role']);

        // Load the lightweight conversation timeline once, then derive each
        // contact's preview and unread count without issuing an N+1 query.
        $conversationMessages = Message::query()
            ->where(function ($query) use ($currentUser) {
                $query->where('sender_id', $currentUser->id)
                    ->orWhere('recipient_id', $currentUser->id);
            })
            ->latest()
            ->get(['id', 'sender_id', 'recipient_id', 'body', 'read_at', 'created_at']);

        $conversationMeta = [];

        foreach ($conversationMessages as $message) {
            $contactId = $message->sender_id === $currentUser->id
                ? $message->recipient_id
                : $message->sender_id;

            $conversationMeta[$contactId] ??= [
                'last_message' => null,
                'unread_count' => 0,
            ];

            if ($conversationMeta[$contactId]['last_message'] === null) {
                $conversationMeta[$contactId]['last_message'] = [
                    'body' => Str::limit($message->body, 70),
                    'created_at' => $message->created_at->toIso8601String(),
                    'is_mine' => $message->sender_id === $currentUser->id,
                ];
            }

            if ($message->recipient_id === $currentUser->id && $message->read_at === null) {
                $conversationMeta[$contactId]['unread_count']++;
            }
        }

        $contacts = $contactModels
            ->map(function (User $contact) use ($conversationMeta) {
                $meta = $conversationMeta[$contact->id] ?? [
                    'last_message' => null,
                    'unread_count' => 0,
                ];

                return [
                    'id' => $contact->id,
                    'name' => $contact->name,
                    'email' => $contact->email,
                    'role' => $contact->role,
                    'role_label' => $this->roleLabel($contact->role),
                    ...$meta,
                ];
            })

            ->sort(function (array $left, array $right) {
                $leftDate = $left['last_message']['created_at'] ?? null;
                $rightDate = $right['last_message']['created_at'] ?? null;

                if ($leftDate && $rightDate) {
                    return strcmp($rightDate, $leftDate);
                }

                if ($leftDate) {
                    return -1;
                }

                if ($rightDate) {
                    return 1;
                }

                return strcasecmp($left['name'], $right['name']);
            })
            ->values();

        $requestedContactId = $request->integer('contact');
        $selectedContact = $requestedContactId
            ? $contacts->firstWhere('id', $requestedContactId)
            : null;

        $messages = collect();

        if ($selectedContact) {
            $selectedContactId = $selectedContact['id'];


            $messages = Message::query()
                ->with('attachments')
                ->where(function ($query) use ($currentUser, $selectedContactId) {
                    $query->where('sender_id', $currentUser->id)
                        ->where('recipient_id', $selectedContactId);
                })
                ->orWhere(function ($query) use ($currentUser, $selectedContactId) {
                    $query->where('sender_id', $selectedContactId)
                        ->where('recipient_id', $currentUser->id);
                })
                ->latest()
                ->limit(200)
                ->get()
                ->reverse()
                ->values()
                ->map(fn(Message $message) => [
                    'id' => $message->id,
                    'sender_id' => $message->sender_id,
                    'recipient_id' => $message->recipient_id,
                    'body' => $message->body,
                    'read_at' => $message->read_at?->toIso8601String(),
                    'created_at' => $message->created_at->toIso8601String(),
                    'attachments' => $message->attachments->map(
                        fn(MessageAttachment $attachment) => [
                            'id' => $attachment->id,
                            'name' => $attachment->original_name,
                            'mime_type' => $attachment->mime_type,
                            'size' => $attachment->size,
                            'is_image' => str_starts_with(
                                (string) $attachment->mime_type,
                                'image/',
                            ),
                            'url' => route('messages.attachments.show', [
                                'message' => $message->id,
                                'attachment' => $attachment->id,
                            ]),
                            'download_url' => route('messages.attachments.show', [
                                'message' => $message->id,
                                'attachment' => $attachment->id,
                                'download' => 1,
                            ]),
                        ],
                    )->values(),
                ]);
        }

        return Inertia::render('Messages/Inbox', [
            'role' => $currentUser->role,
            'contacts' => $contacts,
            'selectedContact' => $selectedContact,
            'messages' => $messages,
        ]);
    }

    public function store(StoreMessageRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $storedPaths = [];
        $recipientIds = collect($validated['recipient_ids'] ?? [])
            ->when(
                isset($validated['recipient_id']),
                fn($recipients) => $recipients->push($validated['recipient_id']),
            )
            ->map(fn($recipientId) => (int) $recipientId)
            ->unique()
            ->values();

        try {
            DB::transaction(function () use ($request, $validated, $recipientIds, &$storedPaths) {
                $recipientNames = [];

                foreach ($recipientIds as $recipientId) {
                    $recipient = User::query()->findOrFail($recipientId);
                    $recipientNames[] = $recipient->name;
                    $message = $request->user()->sentMessages()->create([
                        'recipient_id' => $recipientId,
                        'body' => $validated['body'],
                    ]);

                    foreach ($request->file('attachments', []) as $file) {
                        $extension = $file->extension();
                        $storedName = (string) Str::uuid();

                        if ($extension) {
                            $storedName .= '.' . $extension;
                        }

                        $path = $file->storeAs(
                            'message-attachments/' . $message->id,
                            $storedName,
                            'local',
                        );

                        if ($path === false) {
                            throw new RuntimeException('The attachment could not be stored.');
                        }

                        $storedPaths[] = $path;
                        $message->attachments()->create([
                            'disk' => 'local',
                            'path' => $path,
                            'original_name' => Str::limit(
                                $file->getClientOriginalName(),
                                255,
                                '',
                            ),
                            'mime_type' => $file->getMimeType()
                                ?: $file->getClientMimeType(),
                            'size' => $file->getSize(),
                        ]);
                    }

                    $recipient->notify(new MessageReceived($request->user(), $message));
                }

                $recipientCount = count($recipientNames);
                ActivityLogger::record(
                    $request->user(),
                    'message.sent',
                    $recipientCount === 1 ? 'Sent a message' : 'Sent a group message',
                    $recipientCount === 1
                        ? 'Message sent to ' . $recipientNames[0] . '.'
                        : "Message sent privately to {$recipientCount} recipients.",
                    [
                        'recipient_count' => $recipientCount,
                        'contact_id' => $recipientCount === 1 ? $recipientIds->first() : null,
                    ],
                );
            });
        } catch (Throwable $exception) {
            if ($storedPaths !== []) {
                Storage::disk('local')->delete($storedPaths);
            }

            throw $exception;
        }

        $recipientCount = $recipientIds->count();

        return back()->with(
            'success',
            $recipientCount === 1
                ? 'Message sent.'
                : "Message sent to {$recipientCount} recipients.",
        );
    }

    public function showAttachment(
        Request $request,
        Message $message,
        MessageAttachment $attachment,
    ): StreamedResponse {
        abort_unless($attachment->message_id === $message->id, 404);
        abort_unless(
            in_array(
                $request->user()->id,
                [$message->sender_id, $message->recipient_id],
                true,
            ),
            403,
        );

        $storage = Storage::disk($attachment->disk);
        abort_unless($storage->exists($attachment->path), 404);

        $headers = [
            'Content-Type' => $attachment->mime_type ?: 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
        ];

        if ($request->boolean('download')) {
            return $storage->download(
                $attachment->path,
                $attachment->original_name,
                $headers,
            );
        }

        return $storage->response(
            $attachment->path,
            $attachment->original_name,
            $headers,
        );
    }

    public function markRead(Request $request, User $contact): RedirectResponse
    {
        abort_if($contact->is($request->user()), 422, 'A user cannot be their own contact.');

        $request->user()->receivedMessages()
            ->where('sender_id', $contact->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $request->user()->unreadNotifications()
            ->where('type', MessageReceived::class)
            ->where('data->sender_id', $contact->id)
            ->update(['read_at' => now()]);

        return back();
    }

    private function roleLabel(?string $role): string
    {
        return match ($role) {
            'icm' => 'ICM Coordinator',
            'rhu' => 'RHU Staff',
            'provider' => 'Service Provider',
            default => 'CareLink User',
        };
    }
}
