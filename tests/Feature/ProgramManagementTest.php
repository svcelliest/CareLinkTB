<?php

namespace Tests\Feature;

use App\Models\Program;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProgramManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_icm_can_create_a_program_and_activity_is_recorded(): void
    {
        $coordinator = User::factory()->create(['role' => 'icm']);

        $this->actingAs($coordinator)
            ->from(route('icm.dashboard'))
            ->post(route('icm.programs.store'), [
                'name' => 'Tupi TB Screening',
                'location' => 'Tupi Rural Health Unit',
                'scheduled_at' => '2026-09-01 09:00:00',
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
                ->where('program.id', $ownedProgram->id));

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
}
