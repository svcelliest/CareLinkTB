<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Program;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Archiving a completed program: it leaves the program list for the Archives
 * page, keeps its completed status, and can be restored from there.
 */
class ProgramArchiveTest extends TestCase
{
    use RefreshDatabase;

    private function coordinator(): User
    {
        return User::factory()->create(['role' => 'icm']);
    }

    private function program(User $coordinator, array $attributes = []): Program
    {
        return $coordinator->createdPrograms()->create([
            'name' => 'ACF TB Program – Kalibo',
            'location' => 'Andagao, Kalibo, Aklan',
            'scheduled_at' => now()->subMonth()->format('Y-m-d').' 09:00:00',
            'status' => Program::STATUS_COMPLETED,
            ...$attributes,
        ]);
    }

    public function test_a_completed_program_can_be_archived_and_leaves_the_program_list(): void
    {
        $coordinator = $this->coordinator();
        $program = $this->program($coordinator);

        $this->actingAs($coordinator)
            ->from(route('icm.programs.index'))
            ->patch(route('icm.programs.archive', $program))
            ->assertRedirect(route('icm.programs.index'))
            ->assertSessionHas('success');

        $this->assertNotNull($program->fresh()->archived_at);
        $this->assertTrue($program->fresh()->isArchived());

        // Archiving files the program away; it does not change what it is.
        $this->assertSame(Program::STATUS_COMPLETED, $program->fresh()->status);

        $this->actingAs($coordinator)
            ->get(route('icm.programs.index'))
            ->assertInertia(fn (Assert $page) => $page->has('programs', 0));

        $this->actingAs($coordinator)
            ->get(route('icm.archives.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Icm/Archives/Index')
                ->has('archives', 1)
                ->where('archives.0.id', $program->id)
                ->where('archives.0.name', $program->name)
                ->where('archives.0.location', $program->location));

        $this->assertDatabaseHas('activities', [
            'user_id' => $coordinator->id,
            'type' => 'program.archived',
            'subject_type' => Program::class,
            'subject_id' => $program->id,
        ]);
    }

    public function test_a_program_that_is_not_completed_cannot_be_archived(): void
    {
        $coordinator = $this->coordinator();

        $active = $this->program($coordinator, [
            'status' => Program::STATUS_UPCOMING,
            'scheduled_at' => now()->format('Y-m-d').' 09:00:00',
        ]);
        $upcoming = $this->program($coordinator, [
            'name' => 'ACF TB Program – Malinao',
            'status' => Program::STATUS_UPCOMING,
            'scheduled_at' => now()->addWeek()->format('Y-m-d').' 09:00:00',
        ]);

        $this->assertSame(Program::STATUS_ACTIVE, $active->status);
        $this->assertSame(Program::STATUS_UPCOMING, $upcoming->status);

        foreach ([$active, $upcoming] as $program) {
            $this->actingAs($coordinator)
                ->patch(route('icm.programs.archive', $program))
                ->assertForbidden();

            $this->assertNull($program->fresh()->archived_at);
        }
    }

    public function test_archiving_twice_records_it_once(): void
    {
        $coordinator = $this->coordinator();
        $program = $this->program($coordinator);

        $this->actingAs($coordinator)
            ->from(route('icm.programs.index'))
            ->patch(route('icm.programs.archive', $program))
            ->assertRedirect(route('icm.programs.index'));

        $archivedAt = $program->fresh()->archived_at;

        $this->actingAs($coordinator)
            ->from(route('icm.programs.index'))
            ->patch(route('icm.programs.archive', $program))
            ->assertRedirect(route('icm.programs.index'))
            ->assertSessionHas('success');

        $this->assertEquals($archivedAt, $program->fresh()->archived_at);
        $this->assertSame(
            1,
            Activity::query()
                ->where('type', 'program.archived')
                ->where('subject_id', $program->id)
                ->count(),
        );
    }

    public function test_an_archived_program_can_be_restored_to_the_program_list(): void
    {
        $coordinator = $this->coordinator();
        $program = $this->program($coordinator, ['archived_at' => now()]);

        $this->actingAs($coordinator)
            ->from(route('icm.archives.index'))
            ->patch(route('icm.programs.restore', $program))
            ->assertRedirect(route('icm.archives.index'))
            ->assertSessionHas('success');

        $this->assertNull($program->fresh()->archived_at);
        $this->assertSame(Program::STATUS_COMPLETED, $program->fresh()->status);

        $this->actingAs($coordinator)
            ->get(route('icm.archives.index'))
            ->assertInertia(fn (Assert $page) => $page->has('archives', 0));

        $this->actingAs($coordinator)
            ->get(route('icm.programs.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('programs', 1)
                ->where('programs.0.status', Program::STATUS_COMPLETED));

        $this->assertDatabaseHas('activities', [
            'user_id' => $coordinator->id,
            'type' => 'program.restored',
            'subject_id' => $program->id,
        ]);
    }

    public function test_restoring_twice_records_it_once(): void
    {
        $coordinator = $this->coordinator();
        $program = $this->program($coordinator, ['archived_at' => now()]);

        foreach (range(1, 2) as $ignored) {
            $this->actingAs($coordinator)
                ->from(route('icm.archives.index'))
                ->patch(route('icm.programs.restore', $program))
                ->assertRedirect(route('icm.archives.index'));
        }

        $this->assertSame(
            1,
            Activity::query()
                ->where('type', 'program.restored')
                ->where('subject_id', $program->id)
                ->count(),
        );
    }

    public function test_a_coordinator_cannot_archive_another_coordinators_program(): void
    {
        $owner = $this->coordinator();
        $otherCoordinator = $this->coordinator();
        $program = $this->program($owner);

        $this->actingAs($otherCoordinator)
            ->patch(route('icm.programs.archive', $program))
            ->assertForbidden();

        $this->actingAs($otherCoordinator)
            ->patch(route('icm.programs.restore', $program))
            ->assertForbidden();

        $this->assertNull($program->fresh()->archived_at);
    }

    public function test_the_archive_only_lists_the_coordinators_own_programs(): void
    {
        $coordinator = $this->coordinator();
        $otherCoordinator = $this->coordinator();

        $this->program($coordinator, ['archived_at' => now()]);
        $this->program($otherCoordinator, [
            'name' => 'Someone Else Program',
            'archived_at' => now(),
        ]);

        $this->actingAs($coordinator)
            ->get(route('icm.archives.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->has('archives', 1)
                ->where('archives.0.name', 'ACF TB Program – Kalibo'));
    }

    public function test_non_coordinators_cannot_reach_the_archive(): void
    {
        $program = $this->program($this->coordinator(), ['archived_at' => now()]);

        foreach (['rhu', 'provider'] as $role) {
            $user = User::factory()->create(['role' => $role]);

            $this->actingAs($user)
                ->get(route('icm.archives.index'))
                ->assertForbidden();

            $this->actingAs($user)
                ->patch(route('icm.programs.restore', $program))
                ->assertForbidden();
        }
    }
}
