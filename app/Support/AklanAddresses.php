<?php

namespace App\Support;

use Illuminate\Support\Collection;
use RuntimeException;

/**
 * Server-side reader for the one address dataset the app has.
 *
 * The file it reads is the same `resources/js/data/aklanAddresses.json` that
 * provider patient registration, ICM program locations, and the RHU
 * municipality dropdown all import in the browser. Keeping a second list in PHP
 * would let the two drift, so validation and municipality analytics read the
 * shared file instead.
 */
class AklanAddresses
{
    /** @var array{province: string, municipalities: array<int, array{name: string, barangays: array<int, string>}>}|null */
    private static ?array $dataset = null;

    public static function province(): string
    {
        return self::dataset()['province'];
    }

    /**
     * Every municipality the programme covers, in the dataset's own order.
     *
     * @return array<int, string>
     */
    public static function municipalities(): array
    {
        return array_map(
            static fn (array $entry): string => $entry['name'],
            self::dataset()['municipalities'],
        );
    }

    /**
     * The municipality named in a stored "Barangay, Municipality, Province"
     * address, or null when the address does not name a covered municipality.
     *
     * Matching is done against the dataset rather than by position, so a
     * shorter or longer address string still resolves correctly.
     */
    public static function municipalityFromAddress(?string $address): ?string
    {
        if ($address === null || trim($address) === '') {
            return null;
        }

        $parts = Collection::make(explode(',', $address))
            ->map(static fn (string $part): string => trim($part))
            ->filter()
            ->all();

        $known = array_combine(
            array_map(mb_strtolower(...), self::municipalities()),
            self::municipalities(),
        );

        foreach ($parts as $part) {
            $match = $known[mb_strtolower($part)] ?? null;

            if ($match !== null) {
                return $match;
            }
        }

        return null;
    }

    /**
     * @return array{province: string, municipalities: array<int, array{name: string, barangays: array<int, string>}>}
     */
    private static function dataset(): array
    {
        if (self::$dataset !== null) {
            return self::$dataset;
        }

        $path = resource_path('js/data/aklanAddresses.json');
        $contents = is_readable($path) ? file_get_contents($path) : false;
        $decoded = $contents === false ? null : json_decode($contents, true);

        if (! is_array($decoded) || ! isset($decoded['province'], $decoded['municipalities'])) {
            throw new RuntimeException("The Aklan address dataset at {$path} is missing or unreadable.");
        }

        return self::$dataset = $decoded;
    }
}
