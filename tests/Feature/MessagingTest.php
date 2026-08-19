<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class MessagingTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_user_can_open_a_cross_role_conversation(): void
    {
        $icm = User::factory()->create(['role' => 'icm']);
        $rhu = User::factory()->create(['role' => 'rhu']);

        Message::create([
            'sender_id' => $rhu->id,
            'recipient_id' => $icm->id,
            'body' => 'Referral update is ready.',
        ]);

        $this->actingAs($icm)
            ->get(route('icm.inbox', ['contact' => $rhu->id]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Messages/Inbox')
                ->where('role', 'icm')
                ->where('selectedContact.id', $rhu->id)
                ->where('selectedContact.unread_count', 1)
                ->has('messages', 1)
                ->where('messages.0.body', 'Referral update is ready.'));
    }

    public function test_an_authenticated_user_can_send_a_message_to_another_role(): void
    {
        $provider = User::factory()->create(['role' => 'provider']);
        $icm = User::factory()->create(['role' => 'icm']);

        $this->actingAs($provider)
            ->from(route('provider.inbox', ['contact' => $icm->id]))
            ->post(route('messages.store'), [
                'recipient_id' => $icm->id,
                'body' => 'The laboratory result is available.',
            ])
            ->assertRedirect(route('provider.inbox', ['contact' => $icm->id]));

        $this->assertDatabaseHas('messages', [
            'sender_id' => $provider->id,
            'recipient_id' => $icm->id,
            'body' => 'The laboratory result is available.',
        ]);
    }

    public function test_a_user_can_send_one_private_message_to_multiple_recipients(): void
    {
        Storage::fake('local');

        $icm = User::factory()->create(['role' => 'icm']);
        $rhu = User::factory()->create(['role' => 'rhu']);
        $provider = User::factory()->create(['role' => 'provider']);

        $this->actingAs($icm)
            ->post(route('messages.store'), [
                'recipient_ids' => [$rhu->id, $provider->id],
                'body' => 'Please review the attached program update.',
                'attachments' => [
                    UploadedFile::fake()->create(
                        'program-update.pdf',
                        120,
                        'application/pdf',
                    ),
                ],
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $messages = Message::query()
            ->where('sender_id', $icm->id)
            ->where('body', 'Please review the attached program update.')
            ->with('attachments')
            ->get();

        $this->assertCount(2, $messages);
        $this->assertEqualsCanonicalizing(
            [$rhu->id, $provider->id],
            $messages->pluck('recipient_id')->all(),
        );

        foreach ($messages as $message) {
            $this->assertCount(1, $message->attachments);
            Storage::disk('local')->assertExists($message->attachments->first()->path);
        }
    }

    public function test_a_multi_recipient_message_cannot_include_the_sender(): void
    {
        $icm = User::factory()->create(['role' => 'icm']);
        $rhu = User::factory()->create(['role' => 'rhu']);

        $this->actingAs($icm)
            ->post(route('messages.store'), [
                'recipient_ids' => [$rhu->id, $icm->id],
                'body' => 'This should not be stored.',
            ])
            ->assertSessionHasErrors('recipient_ids.1');

        $this->assertDatabaseCount('messages', 0);
    }

    public function test_a_user_can_send_private_message_attachments(): void
    {
        Storage::fake('local');

        $icm = User::factory()->create(['role' => 'icm']);
        $rhu = User::factory()->create(['role' => 'rhu']);

        $this->actingAs($icm)
            ->from(route('icm.inbox', ['contact' => $rhu->id]))
            ->post(route('messages.store'), [
                'recipient_id' => $rhu->id,
                'body' => 'Attached are the requested files.',
                'attachments' => [
                    UploadedFile::fake()->image('sputum-result.png'),
                    UploadedFile::fake()->create(
                        'referral.pdf',
                        250,
                        'application/pdf',
                    ),
                ],
            ])
            ->assertRedirect(route('icm.inbox', ['contact' => $rhu->id]))
            ->assertSessionHasNoErrors();

        $message = Message::query()->latest('id')->firstOrFail();
        $this->assertCount(2, $message->attachments);

        foreach ($message->attachments as $attachment) {
            Storage::disk('local')->assertExists($attachment->path);
        }
    }

    public function test_only_message_participants_can_access_an_attachment(): void
    {
        Storage::fake('local');

        $icm = User::factory()->create(['role' => 'icm']);
        $rhu = User::factory()->create(['role' => 'rhu']);
        $outsider = User::factory()->create(['role' => 'provider']);
        $message = Message::create([
            'sender_id' => $icm->id,
            'recipient_id' => $rhu->id,
            'body' => 'Private result attached.',
        ]);
        $path = 'message-attachments/'.$message->id.'/result.txt';
        Storage::disk('local')->put($path, 'Private result');
        $attachment = $message->attachments()->create([
            'disk' => 'local',
            'path' => $path,
            'original_name' => 'result.txt',
            'mime_type' => 'text/plain',
            'size' => 14,
        ]);
        $url = route('messages.attachments.show', [$message, $attachment]);

        $this->actingAs($icm)->get($url)->assertOk();
        $this->actingAs($rhu)->get($url.'?download=1')->assertOk();
        $this->actingAs($outsider)->get($url)->assertForbidden();
    }

    public function test_unsafe_message_attachments_are_rejected(): void
    {
        Storage::fake('local');

        $icm = User::factory()->create(['role' => 'icm']);
        $rhu = User::factory()->create(['role' => 'rhu']);

        $this->actingAs($icm)
            ->post(route('messages.store'), [
                'recipient_id' => $rhu->id,
                'body' => 'This attachment should be rejected.',
                'attachments' => [
                    UploadedFile::fake()->create(
                        'malware.exe',
                        20,
                        'application/x-msdownload',
                    ),
                ],
            ])
            ->assertSessionHasErrors('attachments.0');

        $this->assertDatabaseCount('messages', 0);
        $this->assertDatabaseCount('message_attachments', 0);
    }

    public function test_a_user_cannot_message_themselves(): void
    {
        $user = User::factory()->create(['role' => 'rhu']);

        $this->actingAs($user)
            ->post(route('messages.store'), [
                'recipient_id' => $user->id,
                'body' => 'This should not be stored.',
            ])
            ->assertSessionHasErrors('recipient_id');

        $this->assertDatabaseCount('messages', 0);
    }

    public function test_opened_messages_can_be_marked_as_read(): void
    {
        $icm = User::factory()->create(['role' => 'icm']);
        $rhu = User::factory()->create(['role' => 'rhu']);
        $message = Message::create([
            'sender_id' => $rhu->id,
            'recipient_id' => $icm->id,
            'body' => 'Please confirm receipt.',
        ]);

        $this->actingAs($icm)
            ->patch(route('messages.read', $rhu))
            ->assertRedirect();

        $this->assertNotNull($message->fresh()->read_at);
    }

    public function test_role_middleware_protects_each_inbox_url(): void
    {
        $rhu = User::factory()->create(['role' => 'rhu']);

        $this->actingAs($rhu)
            ->get(route('icm.inbox'))
            ->assertForbidden();
    }

    public function test_demo_accounts_are_seeded_for_all_three_roles(): void
    {
        $this->seed();

        $this->assertDatabaseHas('users', [
            'email' => 'icm.demo@carelink.test',
            'role' => 'icm',
        ]);
        $this->assertDatabaseHas('users', [
            'email' => 'rhu.demo@carelink.test',
            'role' => 'rhu',
        ]);
        $this->assertDatabaseHas('users', [
            'email' => 'provider.demo@carelink.test',
            'role' => 'provider',
        ]);
        $this->assertDatabaseCount('messages', 3);
    }
}
