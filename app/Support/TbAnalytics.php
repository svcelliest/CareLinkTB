<?php

namespace App\Support;

use App\Models\Location;
use App\Models\Patient;
use App\Models\Program;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * The ICM dashboard's analytics, computed from the live `patients`,
 * `programs`, `users`, `diagnostic_assessments`, and `treatment_enrollments`
 * tables. Nothing here is sampled, seeded, or hard-coded.
 *
 * Ported from medjofinal's `TbAnalytics`, which read diagnosis and treatment
 * enrollment out of a `patients.responses` JSON key
 * (`tb_case_classification`/`enrolled_tb_treatment`). This session's schema
 * moved both into dedicated tables (see [[carelink_tb_scda_form_split_pending]]
 * and [[carelink_tb_treatment_enrollments_design]]), so this reads those
 * instead — a real relational signal rather than a JSON flag that can only
 * ever be as fresh as whichever form last wrote it.
 *
 * The rate card reports treatment *enrolment* and the gauge reports
 * diagnostic *follow-through*, not "outcome" — same reasoning as medjofinal:
 * there is no single outcome column to summarize (outcome lives on
 * `treatment_enrollments.outcome`, 6-way, per enrollment, not per patient).
 *
 * Rows are aggregated in PHP rather than SQL for the same reason as the
 * reference: a community TB programme's patient count is in the thousands at
 * most, and the per-form-type presumptive logic (`Patient::isPresumptive()`)
 * already has to run in PHP against the JSON `responses` column.
 */
class TbAnalytics
{
    /** `diagnostic_assessments.tb_diagnosis` labels, matching DiagnosticAssessment::diagnosisLabel(). */
    private const DIAGNOSIS_LABELS = [
        'dstb_bc' => 'Bacteriologically Confirmed',
        'dstb_cd' => 'Clinically Diagnosed',
        'rrtb_bc' => 'Rifampicin-Resistant, Bacteriologically Confirmed',
    ];

    /**
     * @param  string  $scope  'overall' or 'municipality'
     * @return array<string, mixed>
     */
    public static function build(string $scope, ?string $municipality, string $year): array
    {
        $patients = self::patients();

        $filtered = $patients
            ->when(
                $year !== 'all',
                fn (Collection $rows) => $rows->filter(
                    fn (array $row): bool => $row['year'] === (int) $year,
                ),
            )
            ->when(
                $scope === 'municipality' && $municipality !== null,
                fn (Collection $rows) => $rows->filter(
                    fn (array $row): bool => $row['municipality'] === $municipality,
                ),
            )
            ->values();

        // The municipality map and ranking always show the programme as a
        // whole; narrowing them to one municipality would leave a single bar.
        $forGeography = $patients
            ->when(
                $year !== 'all',
                fn (Collection $rows) => $rows->filter(
                    fn (array $row): bool => $row['year'] === (int) $year,
                ),
            )
            ->values();

        return [
            'scope' => $scope,
            'municipality' => $municipality,
            'year' => $year,
            'programs' => self::programStats(),
            'kpis' => self::kpis($filtered),
            'treatment_status' => self::treatmentStatus($filtered),
            'quarterly_cases' => self::quarterlyCases($filtered),
            'municipality_cases' => self::municipalityCases($forGeography),
            'age_groups' => self::ageGroups($filtered),
            'sex' => self::sexSplit($filtered),
            'trend' => [
                'quarterly' => self::trendByQuarter($filtered),
                'yearly' => self::trendByYear($filtered),
            ],
            'follow_through' => self::followThrough($filtered),
            'diagnoses' => self::diagnosisBreakdown($filtered),
        ];
    }

    /**
     * The filter options the dashboard offers, derived from what is in the
     * database rather than from a fixed list.
     *
     * @return array<string, mixed>
     */
    public static function filterOptions(): array
    {
        // Year extraction differs between SQLite (tests) and MySQL (runtime),
        // so the distinct years are derived in PHP from the timestamps rather
        // than from a driver-specific SQL function.
        $years = Patient::query()
            ->pluck('created_at')
            ->filter()
            ->map(fn (Carbon $createdAt): int => (int) $createdAt->format('Y'))
            ->unique()
            ->sort()
            ->values()
            ->all();

        return [
            'years' => $years,
            'municipalities' => self::municipalities(),
        ];
    }

    /**
     * Every municipality across every province the programme covers, read
     * from the real `locations` table rather than a static per-province
     * dataset — the reference's `AklanAddresses` only ever covered Aklan;
     * this project's `locations` table already spans Aklan and Antique.
     *
     * @return array<int, string>
     */
    private static function municipalities(): array
    {
        return Location::query()
            ->where('level', 'municipality')
            ->orderBy('name')
            ->pluck('name')
            ->all();
    }

    /**
     * One flattened row per patient, holding just what the aggregations read.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private static function patients(): Collection
    {
        return Patient::query()
            ->select(['id', 'date_of_birth', 'sex', 'address', 'form_type', 'responses', 'created_at', 'program_id'])
            ->with(['diagnosticAssessment:id,patient_id,tb_diagnosis', 'treatmentEnrollments:id,patient_id', 'program:id,location_id', 'program.location.parent'])
            ->get()
            ->map(function (Patient $patient): array {
                $diagnosis = (string) ($patient->diagnosticAssessment?->tb_diagnosis ?? '');
                $createdAt = $patient->created_at ?? Carbon::now();

                return [
                    'age' => $patient->age,
                    'sex' => $patient->sex,
                    'municipality' => self::municipalityFor($patient),
                    'year' => (int) $createdAt->format('Y'),
                    'quarter' => (int) ceil(((int) $createdAt->format('n')) / 3),
                    'diagnosis' => $diagnosis,
                    // All three enum values (dstb_bc/dstb_cd/rrtb_bc) are
                    // confirmed TB; the column is simply null before a
                    // diagnosis is recorded, unlike the reference's explicit
                    // "none" classification value.
                    'confirmed' => $diagnosis !== '',
                    'enrolled' => $patient->treatmentEnrollments->isNotEmpty(),
                    'flagged' => $patient->isPresumptive(),
                    // "Tested" = an RHU has actually run the diagnostic
                    // assessment, whatever it found — the row existing is the
                    // signal, not any particular result column on it.
                    'tested' => $patient->diagnosticAssessment !== null,
                ];
            });
    }

    /**
     * Prefers the patient's program's real location relation over
     * re-parsing the free-text address — same improvement, and same
     * fallback, as `Patient::acfDefaults()`.
     */
    private static function municipalityFor(Patient $patient): ?string
    {
        $location = $patient->program?->location;

        if ($location?->level === 'municipality') {
            return $location->name;
        }

        $parts = array_map('trim', explode(',', $patient->address ?? ''));

        return $parts[1] ?? null;
    }

    /**
     * @return array<string, int>
     */
    private static function programStats(): array
    {
        $byStatus = Program::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'active' => (int) $byStatus->get('active', 0),
            'upcoming' => (int) $byStatus->get('upcoming', 0),
            'completed' => (int) $byStatus->get('completed', 0),
            'active_accounts' => User::query()
                ->whereIn('role', ['rhu', 'provider'])
                ->whereNull('disabled_at')
                ->count(),
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array<string, mixed>
     */
    private static function kpis(Collection $rows): array
    {
        $confirmed = $rows->where('confirmed', true);
        $enrolled = $confirmed->where('enrolled', true)->count();

        return [
            'total' => $rows->count(),
            // Flagged for TB but with no final classification recorded yet.
            'presumptive' => $rows
                ->filter(fn (array $row): bool => $row['flagged'] && $row['diagnosis'] === '')
                ->count(),
            'active_cases' => $confirmed->count(),
            'enrolment_rate' => self::percentage($enrolled, $confirmed->count()),
            'enrolled' => $enrolled,
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    private static function treatmentStatus(Collection $rows): array
    {
        $confirmed = $rows->where('confirmed', true);
        $enrolled = $confirmed->where('enrolled', true)->count();

        return [
            ['label' => 'Enrolled', 'value' => $enrolled, 'color' => '#27ae60'],
            [
                'label' => 'Not yet Enrolled',
                'value' => $confirmed->count() - $enrolled,
                'color' => '#e2941b',
            ],
            [
                'label' => 'Not classified',
                'value' => $rows->count() - $confirmed->count(),
                'color' => '#c9c2c2',
            ],
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    private static function quarterlyCases(Collection $rows): array
    {
        $confirmed = $rows->where('confirmed', true)->groupBy('quarter');

        return collect(range(1, 4))
            ->map(fn (int $quarter): array => [
                'label' => "Q{$quarter}",
                'value' => $confirmed->get($quarter)?->count() ?? 0,
            ])
            ->all();
    }

    /**
     * Aggregated municipality counts for the choropleth and the ranking. Only
     * municipality-level totals leave this method — never a patient row.
     *
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    private static function municipalityCases(Collection $rows): array
    {
        $confirmedByMunicipality = $rows
            ->where('confirmed', true)
            ->groupBy('municipality');

        $registeredByMunicipality = $rows->groupBy('municipality');

        return Location::query()
            ->where('level', 'municipality')
            ->with('parent')
            ->orderBy('name')
            ->get()
            ->map(fn (Location $location): array => [
                'municipality' => $location->name,
                'province' => $location->parent?->name,
                'tb_cases' => $confirmedByMunicipality->get($location->name)?->count() ?? 0,
                'registered' => $registeredByMunicipality->get($location->name)?->count() ?? 0,
            ])
            ->sortByDesc('tb_cases')
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    private static function ageGroups(Collection $rows): array
    {
        $buckets = [
            'Children (0–14)' => fn (?int $age): bool => $age !== null && $age <= 14,
            'Adults (15–59)' => fn (?int $age): bool => $age !== null && $age >= 15 && $age <= 59,
            'Elderly (60+)' => fn (?int $age): bool => $age !== null && $age >= 60,
            'Age not recorded' => fn (?int $age): bool => $age === null,
        ];

        $total = $rows->count();

        return collect($buckets)
            ->map(function (callable $matches, string $label) use ($rows, $total): array {
                $count = $rows->filter(
                    fn (array $row): bool => $matches($row['age']),
                )->count();

                return [
                    'label' => $label,
                    'value' => $count,
                    'percent' => self::percentage($count, $total),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    private static function sexSplit(Collection $rows): array
    {
        $counts = $rows->countBy(
            fn (array $row): string => match ($row['sex']) {
                'male', 'Male' => 'Male',
                'female', 'Female' => 'Female',
                default => 'Not recorded',
            },
        );

        return collect([
            ['label' => 'Male', 'color' => '#4a7cf7'],
            ['label' => 'Female', 'color' => '#e0559b'],
            ['label' => 'Not recorded', 'color' => '#c9c2c2'],
        ])
            ->map(fn (array $entry): array => [
                ...$entry,
                'value' => (int) $counts->get($entry['label'], 0),
            ])
            ->filter(fn (array $entry): bool => $entry['label'] !== 'Not recorded' || $entry['value'] > 0)
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    private static function trendByQuarter(Collection $rows): array
    {
        $grouped = $rows->groupBy(fn (array $row): string => "{$row['year']}-Q{$row['quarter']}");

        return $grouped
            ->map(fn (Collection $group, string $label): array => [
                'label' => $label,
                'value' => $group->count(),
            ])
            ->sortKeys()
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    private static function trendByYear(Collection $rows): array
    {
        return $rows
            ->groupBy('year')
            ->map(fn (Collection $group, int|string $year): array => [
                'label' => (string) $year,
                'value' => $group->count(),
            ])
            ->sortKeys()
            ->values()
            ->all();
    }

    /**
     * Share of TB-flagged patients who have a recorded diagnostic result — the
     * schema's honest stand-in for the mockup's adherence gauge.
     *
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array<string, int>
     */
    private static function followThrough(Collection $rows): array
    {
        $flagged = $rows->where('flagged', true);
        $tested = $flagged->where('tested', true)->count();

        return [
            'percent' => self::percentage($tested, $flagged->count()),
            'tested' => $tested,
            'flagged' => $flagged->count(),
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    private static function diagnosisBreakdown(Collection $rows): array
    {
        $counts = $rows->countBy('diagnosis');

        return collect(self::DIAGNOSIS_LABELS)
            ->map(fn (string $label, string $key): array => [
                'label' => $label,
                'value' => (int) $counts->get($key, 0),
            ])
            ->values()
            ->all();
    }

    private static function percentage(int $part, int $whole): int
    {
        return $whole > 0 ? (int) round(($part / $whole) * 100) : 0;
    }
}
