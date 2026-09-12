<?php

namespace Tests\Feature;

use App\Models\Patient;
use App\Models\Program;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ProgramManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_icm_can_create_a_program_and_activity_is_recorded(): void
    {
        $coordinator = User::factory()->create(['role' => 'icm']);

        // Status is derived from the schedule, so the date has to stay ahead of
        // today for this to keep testing what it means to test: that a new
        // program is 'upcoming' and the posted 'completed' is ignored. A
        // literal date turns that assertion into a countdown.
        $scheduledAt = CarbonImmutable::now(config('app.timezone'))
            ->addMonth()
            ->setTime(9, 0);

        $this->actingAs($coordinator)
            ->from(route('icm.dashboard'))
            ->post(route('icm.programs.store'), [
                'name' => 'Tupi TB Screening',
                'location' => 'Tupi Rural Health Unit',
                'scheduled_at' => $scheduledAt->format('Y-m-d H:i:s'),
                'status' => 'completed',
            ])
            ->assertRedirect(route('icm.dashboard'))
            ->assertSessionHas('success');

        $program = Program::query()->sole();

        $this->assertSame($coordinator->id, $program->created_by);
        $this->assertSame('Tupi TB Screening', $program->name);
        $this->assertSame('upcoming', $program->status);
        $this->assertDatabaseHas('activities', [
            'user_id' => $coordinator->id,
            'type' => 'program.created',
            'subject_type' => Program::class,
            'subject_id' => $program->id,
        ]);
    }

    public function test_program_creation_requires_valid_input(): void
    {
        $coordinator = User::factory()->create(['role' => 'icm']);

        $this->actingAs($coordinator)
            ->from(route('icm.dashboard'))
            ->post(route('icm.programs.store'), [
                'name' => '',
                'location' => '',
                'scheduled_at' => 'not-a-date',
            ])
            ->assertRedirect(route('icm.dashboard'))
            ->assertSessionHasErrors(['name', 'location', 'scheduled_at']);

        $this->assertDatabaseCount('programs', 0);
    }

    public function test_program_time_is_stored_and_returned_exactly_as_picked(): void
    {
        $coordinator = User::factory()->create(['role' => 'icm']);

        $this->actingAs($coordinator)
            ->from(route('icm.programs.index'))
            ->post(route('icm.programs.store'), [
                'name' => 'Banga ACF Screening',
                'location' => 'Lapnag, Banga, Aklan',
                'date' => '2026-09-10',
                'time' => '14:30',
            ])
            ->assertSessionHasNoErrors();

        $program = Program::query()->sole();

        // The wall clock the coordinator picked is what lands in the column —
        // no timezone offset is applied on the way in.
        $this->assertSame('2026-09-10 14:30:00', $program->scheduled_at->format('Y-m-d H:i:s'));

        // ...and the page is handed pre-formatted labels, so the browser never
        // re-interprets an instant and shifts it back out again.
        $this->actingAs($coordinator)
            ->get(route('icm.programs.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Icm/Programs/Index')
                ->where('programs.0.scheduled_date', '2026-09-10')
                ->where('programs.0.scheduled_time', '14:30')
                ->where('programs.0.time_label', '2:30 PM')
                ->where('scheduleWindow.min', '08:00')
                ->where('scheduleWindow.max', '17:00'));
    }

    /**
     * @return array<string, array{string, bool}>
     */
    public static function programTimeProvider(): array
    {
        return [
            'before opening' => ['07:59', false],
            'at opening' => ['08:00', true],
            'midday' => ['12:15', true],
            'at closing' => ['17:00', true],
            'after closing' => ['17:01', false],
            'late evening' => ['21:00', false],
        ];
    }

    #[DataProvider('programTimeProvider')]
    public function test_program_time_must_be_inside_the_working_window(string $time, bool $allowed): void
    {
        $coordinator = User::factory()->create(['role' => 'icm']);

        $response = $this->actingAs($coordinator)
            ->from(route('icm.programs.index'))
            ->post(route('icm.programs.store'), [
                'name' => 'Window Check',
                'location' => 'Poblacion, Kalibo, Aklan',
                'date' => '2026-09-10',
                'time' => $time,
            ]);

        if ($allowed) {
            $response->assertSessionHasNoErrors();
            $this->assertDatabaseCount('programs', 1);

            return;
        }

        $response->assertSessionHasErrors('time');
        $this->assertDatabaseCount('programs', 0);
    }

    public function test_editing_a_program_respects_the_same_time_window(): void
    {
        $coordinator = User::factory()->create(['role' => 'icm']);
        $program = $this->createProgram($coordinator);

        $this->actingAs($coordinator)
            ->from(route('icm.programs.index'))
            ->patch(route('icm.programs.update', $program), [
                'name' => 'Lake Sebu TB Screening',
                'location' => 'Lake Sebu Rural Health Unit',
                'date' => '2026-10-02',
                'time' => '19:30',
            ])
            ->assertSessionHasErrors('time');

        $this->assertSame(
            '2026-10-01 09:00:00',
            $program->refresh()->scheduled_at->format('Y-m-d H:i:s'),
        );

        $this->actingAs($coordinator)
            ->from(route('icm.programs.index'))
            ->patch(route('icm.programs.update', $program), [
                'name' => 'Lake Sebu TB Screening',
                'location' => 'Lake Sebu Rural Health Unit',
                'date' => '2026-10-02',
                'time' => '16:45',
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(
            '2026-10-02 16:45:00',
            $program->refresh()->scheduled_at->format('Y-m-d H:i:s'),
        );

        // Another coordinator's program stays off limits.
        $this->actingAs(User::factory()->create(['role' => 'icm']))
            ->patch(route('icm.programs.update', $program), [
                'name' => 'Hijacked',
                'location' => 'Elsewhere',
                'date' => '2026-10-02',
                'time' => '09:00',
            ])
            ->assertForbidden();
    }

    public function test_icm_can_save_sputum_and_diagnostic_columns_for_its_own_program(): void
    {
        $coordinator = User::factory()->create(['role' => 'icm']);
        $program = $this->createProgram($coordinator);
        $patient = $this->createPatient($program, $coordinator);

        $this->actingAs($coordinator)
            ->from(route('icm.programs.show', $program))
            ->patch(route('icm.programs.records.update', $program), [
                'patients' => [[
                    'id' => $patient->id,
                    'tb_case_classification' => 'rr_tb',
                    // Treatment Status is derived from the treatment register
                    // now, so posting it must not write anything.
                    'enrolled_tb_treatment' => '1',
                    'remarks' => 'Referred to the TB DOTS facility.',
                ]],
            ])
            ->assertSessionHasNoErrors()
            ->assertSessionHas('success');

        $responses = $patient->refresh()->responses;

        $this->assertSame('rr_tb', $responses['tb_case_classification']);
        $this->assertArrayNotHasKey('enrolled_tb_treatment', $responses);
        $this->assertSame('Referred to the TB DOTS facility.', $responses['remarks']);
        // Untouched answers recorded by the RHU survive the partial update.
        $this->assertSame('1', $responses['tested_gene_xpert']);

        $this->actingAs($coordinator)
            ->patch(route('icm.programs.records.update', $program), [
                'patients' => [[
                    'id' => $patient->id,
                    'tb_case_classification' => 'not-a-classification',
                ]],
            ])
            ->assertSessionHasErrors('patients.0.tb_case_classification');
    }

    public function test_patients_from_another_program_cannot_be_edited_through_a_program(): void
    {
        $coordinator = User::factory()->create(['role' => 'icm']);
        $program = $this->createProgram($coordinator);
        $otherProgram = $this->createProgram($coordinator, ['name' => 'Other Program']);
        $foreignPatient = $this->createPatient($otherProgram, $coordinator);

        $this->actingAs($coordinator)
            ->patch(route('icm.programs.records.update', $program), [
                'patients' => [[
                    'id' => $foreignPatient->id,
                    'remarks' => 'Should not stick.',
                ]],
            ])
            ->assertSessionHasErrors('patients.0.id');

        $this->assertSame('', (string) ($foreignPatient->refresh()->responses['remarks'] ?? ''));
    }

    public function test_non_icm_users_cannot_access_program_routes(): void
    {
        $coordinator = User::factory()->create(['role' => 'icm']);
        $program = $this->createProgram($coordinator);

        foreach (['rhu', 'provider'] as $role) {
            $user = User::factory()->create(['role' => $role]);

            $this->actingAs($user)
                ->get(route('icm.programs.index'))
                ->assertForbidden();

            $this->actingAs($user)
                ->post(route('icm.programs.store'), [
                    'name' => 'Unauthorized Program',
                    'location' => 'Unauthorized Location',
                    'scheduled_at' => '2026-09-01 09:00:00',
                ])
                ->assertForbidden();

            $this->actingAs($user)
                ->get(route('icm.programs.show', $program))
                ->assertForbidden();
        }
    }

    public function test_icm_lists_only_its_own_programs(): void
    {
        $coordinator = User::factory()->create(['role' => 'icm']);
        $otherCoordinator = User::factory()->create(['role' => 'icm']);
        $ownedProgram = $this->createProgram($coordinator);
        $this->createProgram($otherCoordinator, [
            'name' => 'Other Coordinator Program',
        ]);

        $this->actingAs($coordinator)
            ->get(route('icm.programs.index'))
            ->assertOk()
            ->assertInertia(fn(Assert $page) => $page
                ->component('Icm/Programs/Index')
                ->has('programs', 1)
                ->where('programs.0.id', $ownedProgram->id));
    }

    public function test_icm_can_view_own_program_but_not_another_coordinators_program(): void
    {
        $coordinator = User::factory()->create(['role' => 'icm']);
        $otherCoordinator = User::factory()->create(['role' => 'icm']);
        $ownedProgram = $this->createProgram($coordinator);

        $this->actingAs($coordinator)
            ->get(route('icm.programs.show', $ownedProgram))
            ->assertOk()
            ->assertInertia(fn(Assert $page) => $page
                ->component('Icm/Programs/Show')
                ->where('program.id', $ownedProgram->id)
                // Editing a program is reached from this page, so it needs the
                // same schedule window the create form uses.
                ->where('scheduleWindow.min', '08:00')
                ->where('scheduleWindow.max', '17:00'));

        $this->actingAs($otherCoordinator)
            ->get(route('icm.programs.show', $ownedProgram))
            ->assertForbidden();
    }

    public function test_icm_can_export_only_its_own_programs(): void
    {
        $coordinator = User::factory()->create(['role' => 'icm']);
        $otherCoordinator = User::factory()->create(['role' => 'icm']);

        $this->createProgram($coordinator, [
            'name' => '=Needs Review',
            'location' => 'Tupi Rural Health Unit',
        ]);
        $this->createProgram($otherCoordinator, [
            'name' => 'Private Other Program',
        ]);

        $response = $this->actingAs($coordinator)
            ->get(route('icm.programs.export'));

        $response
            ->assertOk()
            ->assertHeader('content-disposition', 'attachment; filename=programs.csv');

        $csv = $response->streamedContent();

        $lines = explode("\n", trim($csv));

        $this->assertSame(
            [
                'Program Name',
                'Location',
                'Scheduled At',
                'Status',
                'Created At',
            ],
            str_getcsv($lines[0]),
        );
        $this->assertStringContainsString("'=Needs Review", $csv);
        $this->assertStringNotContainsString('Private Other Program', $csv);

        $rhu = User::factory()->create(['role' => 'rhu']);

        $this->actingAs($rhu)
            ->get(route('icm.programs.export'))
            ->assertForbidden();
    }

    private function createProgram(User $creator, array $attributes = []): Program
    {
        return $creator->createdPrograms()->create([
            'name' => 'Lake Sebu TB Screening',
            'location' => 'Lake Sebu Rural Health Unit',
            'scheduled_at' => '2026-10-01 09:00:00',
            ...$attributes,
        ]);
    }

    private function createPatient(Program $program, User $creator, array $attributes = []): Patient
    {
        return $program->patients()->create([
            'created_by' => $creator->id,
            'form_type' => 'sputum_collection',
            'name' => 'Maria D. Santos',
            'age' => 32,
            'sex' => 'female',
            'contact_number' => '09456732458',
            'address' => 'Lapnag, Banga, Aklan',
            'status' => 'completed',
            'responses' => [
                'tested_gene_xpert' => '1',
                'diagnostic_result' => 'positive',
                'positive_classification' => 'rr',
            ],
            ...$attributes,
        ]);
    }

}
