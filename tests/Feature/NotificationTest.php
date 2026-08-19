<?php

namespace Tests\Feature;

use App\Models\Message;
use App\Models\User;
use App\Notifications\MessageReceived;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_sending_a_message_creates_a_notification_for_the_recipient(): void
    {
        $sender = User::factory()->create(['role' => 'rhu']);
        $recipient = User::factory()->create(['role' => 'icm']);

        $this->actingAs($sender)->post(route('messages.store'), [
            'recipient_id' => $recipient->id,
            'body' => 'A new referral is ready for review.',
        ])->assertRedirect();

        $notification = $recipient->notifications()->firstOrFail();

        $this->assertSame(MessageReceived::class, $notification->type);
        $this->assertSame($sender->id, $notification->data['sender_id']);
        $this->assertSame('New message', $notification->data['title']);
        $this->assertStringContainsString(
            'A new referral is ready for review.',
            $notification->data['message'],
        );
    }

    public function test_notification_page_only_contains_the_signed_in_users_notifications(): void
    {
        $sender = User::factory()->create(['role' => 'provider']);
        $recipient = User::factory()->create(['role' => 'icm']);
        $otherUser = User::factory()->create(['role' => 'rhu']);
        $message = Message::create([
            'sender_id' => $sender->id,
            'recipient_id' => $recipient->id,
            'body' => 'Private diagnostic update.',
        ]);

        $recipient->notify(new MessageReceived($sender, $message));
        $expectedMessage = $recipient->notifications()->firstOrFail()->data['message'];

        $this->actingAs($recipient)
            ->get(route('notifications.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Notifications/Index')
                ->where('role', 'icm')
                ->has('notifications.data', 1)
                ->where('notifications.data.0.message', $expectedMessage));

        $this->actingAs($otherUser)
            ->get(route('notifications.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('notifications.data', 0));
    }

    public function test_a_user_can_mark_their_notification_as_read(): void
    {
        [$sender, $recipient, $notification] = $this->createMessageNotification();

        $this->actingAs($recipient)
            ->patch(route('notifications.read', $notification->id))
            ->assertRedirect();

        $this->assertNotNull($notification->fresh()->read_at);
    }

    public function test_a_user_cannot_mark_another_users_notification_as_read(): void
    {
        [$sender, $recipient, $notification] = $this->createMessageNotification();
        $outsider = User::factory()->create(['role' => 'provider']);

        $this->actingAs($outsider)
            ->patch(route('notifications.read', $notification->id))
            ->assertNotFound();

        $this->assertNull($notification->fresh()->read_at);
    }

    public function test_reading_a_conversation_also_clears_its_message_notifications(): void
    {
        [$sender, $recipient, $notification] = $this->createMessageNotification();

        $this->actingAs($recipient)
            ->patch(route('messages.read', $sender))
            ->assertRedirect();

        $this->assertNotNull($notification->fresh()->read_at);
    }

    /**
     * @return array{User, User, DatabaseNotification}
     */
    private function createMessageNotification(): array
    {
        $sender = User::factory()->create(['role' => 'rhu']);
        $recipient = User::factory()->create(['role' => 'icm']);
        $message = Message::create([
            'sender_id' => $sender->id,
            'recipient_id' => $recipient->id,
            'body' => 'Please review this update.',
        ]);

        $recipient->notify(new MessageReceived($sender, $message));

        return [$sender, $recipient, $recipient->notifications()->firstOrFail()];
    }
}
