<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class UniSmsClient
{
    /**
     * Sends one SMS through unismsapi.com.
     *
     * @return array<string, mixed> the decoded response body
     */
    public function send(string $recipient, string $message): array
    {
        $response = Http::withBasicAuth((string) config('services.unisms.key'), '')
            ->post('https://unismsapi.com/api/sms', array_filter([
                'recipient' => $recipient,
                'content' => $message,
                'sender_id' => config('services.unisms.sender_id'),
            ]));

        if ($response->failed()) {
            throw new RuntimeException(
                'SMS could not be sent: ' . ($response->json('message') ?? $response->body()),
            );
        }

        return $response->json() ?? [];
    }

    /**
     * Looks up a previously sent message's current delivery status.
     *
     * @return array<string, mixed> {status, content, created, recipient, reference_id, fail_reason}
     */
    // public function checkStatus(string $referenceId): array
    // {
    //     $response = Http::withBasicAuth((string) config('services.unisms.key'), '')
    //         ->get("https://unismsapi.com/api/sms/{$referenceId}");

    //     if ($response->failed()) {
    //         throw new RuntimeException(
    //             'Could not check SMS status: '.($response->json('message') ?? $response->body()),
    //         );
    //     }

    //     return $response->json('message') ?? [];
    // }
}
