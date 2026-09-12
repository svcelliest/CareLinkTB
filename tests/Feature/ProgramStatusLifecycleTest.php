<?php

namespace Tests\Feature;

use App\Http\Middleware\HandleInertiaRequests;
use App\Models\Activity;
use App\Models\Patient;
use App\Models\Program;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The program status lifecycle: `completed` is stored when the provider ends
 * the session and outranks everything after that; until then the status is
 * derived from the scheduled date, so a program starts itself on the day it
 * was scheduled for and a session nobody ended stays open.
 */
class ProgramStatusLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private function coordinator(): User
    {
        return User::factory()->create(['role' => 'icm']);
    }

    private function provider(): User
    {
        return User::factory()->create(['role' => 'provider']);
    }

    private function program(string $scheduledAt, array $attributes = []): Program
    {
        return Program::create([
            'created_by' => $this->coordinator()->id,
            'name' => 'ACF TB Program – Banga',
            'location' => 'Toralba, Banga, Aklan',
            'scheduled_at' => $scheduledAt,
            'status' => Program::STATUS_UPCOMING,
            ...$attributes,
        ]);
    }

    /** A scheduled day, as the wall-clock string the form would have produced. */
    private function day(string $offset): string
    {
        $date = match ($offset) {
            'today' => now(),
            'tomorrow' => now()->addDay(),
            'yesterday' => now()->subDay(),
            'next week' => now()->addWeek(),
            'last week' => now()->subWeek(),
        };

        return $date->format('Y-m-d').' 09:00:00';
    }

    /** Registers the screening intake that marks a provider as the session's. */
    private function screen(Program $program, User $provider): Patient
    {
        return $program->patients()->create([
            'created_by' => $provider->id,
            'form_type' => Patient::FORM_TYPE_PROVIDER_SCREENING,
            'name' => 'JUAN A. DELA CRUZ',
            'age' => 45,
            'sex' => 'male',
            'contact_number' => '09998134769',
            'address' => 'Agbanawan, Banga, Aklan',
            'status' => 'completed',
            'responses' => ['birthday' => '1980-11-14', 'presumptive' => false],
        ]);
    }

    public function test_a_program_scheduled_after_today_is_upcoming(): void
    {
        $program = $this->program($this->day('tomorrow'));

        $this->assertSame(Program::STATUS_UPCOMING, $program->status);
        $this->assertFalse($program->isCompleted());
    }

    public function test_a_program_scheduled_for_today_is_active_from_the_start_of_the_day(): void
    {
        // Before the scheduled time on the scheduled day: the rule is the
        // calendar date, not the clock, so this is already active.
        $this->travelTo(now()->startOfDay()->addHours(7));

        $program = $this->program($this->day('today'));

        $this->assertSame(Program::STATUS_ACTIVE, $program->status);
    }

    public function test_a_past_program_that_was_never_ended_stays_active(): void
    {
        $program = $this->program($this->day('yesterday'));

        $this->assertSame(Program::STATUS_ACTIVE, $program->status);
    }

    public function test_an_upcoming_program_becomes_active_when_its_date_arrives(): void
    {
        $program = $this->program($this->day('tomorrow'));

        $this->assertSame(Program::STATUS_UPCOMING, $program->status);

        $this->travelTo(now()->addDay());

        $this->assertSame(Program::STATUS_ACTIVE, $program->fresh()->status);
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function scheduleProvider(): array
    {
        return [
            'future' => ['tomorrow'],
            'today' => ['today'],
            'past' => ['yesterday'],
        ];
    }

    #[DataProvider('scheduleProvider')]
    public function test_ending_the_session_completes_the_program_whatever_the_date(string $offset): void
    {
        $program = $this->program($this->day($offset));

        $this->actingAs($this->provider())
            ->patch(route('provider.programs.finish', $program))
            ->assertRedirect(route('provider.programs.index'))
            ->assertSessionHas('success');

        $this->assertSame(Program::STATUS_COMPLETED, $program->fresh()->status);
        $this->assertTrue($program->fresh()->isCompleted());
        $this->assertDatabaseHas('programs', [
            'id' => $program->id,
            'status' => Program::STATUS_COMPLETED,
        ]);
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function completedScheduleProvider(): array
    {
        return [
            'future' => ['tomorrow'],
            'past' => ['yesterday'],
        ];
    }

    #[DataProvider('completedScheduleProvider')]
    public function test_a_completed_program_stays_completed_whatever_the_date(string $offset): void
    {
        $program = $this->program($this->day($offset), ['status' => Program::STATUS_COMPLETED]);

        $this->assertSame(Program::STATUS_COMPLETED, $program->status);
        $this->assertSame(Program::STATUS_COMPLETED, $program->fresh()->status);
    }

    public function test_rescheduling_a_completed_program_cannot_reopen_it(): void
    {
        $coordinator = $this->coordinator();
        $program = $coordinator->createdPrograms()->create([
            'name' => 'ACF TB Program – Malinao',
            'location' => 'Poblacion, Malinao, Aklan',
            'scheduled_at' => $this->day('yesterday'),
            'status' => Program::STATUS_COMPLETED,
        ]);

        $this->actingAs($coordinator)
            ->from(route('icm.programs.show', $program))
            ->patch(route('icm.programs.update', $program), [
                'name' => $program->name,
                'location' => $program->location,
                'date' => now()->addWeek()->format('Y-m-d'),
                'time' => '10:00',
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(Program::STATUS_COMPLETED, $program->fresh()->status);
    }

    public function test_a_provider_cannot_end_a_session_another_provider_is_screening(): void
    {
        $program = $this->program($this->day('today'));
        $screeningProvider = $this->provider();
        $otherProvider = $this->provider();

        $this->screen($program, $screeningProvider);

        $this->actingAs($otherProvider)
            ->patch(route('provider.programs.finish', $program))
            ->assertForbidden();

        $this->assertSame(Program::STATUS_ACTIVE, $program->fresh()->status);

        // The provider who ran the screening still can.
        $this->actingAs($screeningProvider)
            ->patch(route('provider.programs.finish', $program))
            ->assertRedirect(route('provider.programs.index'));

        $this->assertSame(Program::STATUS_COMPLETED, $program->fresh()->status);
    }

    public function test_ending_the_session_twice_records_it_once(): void
    {
        $program = $this->program($this->day('today'));
        $provider = $this->provider();

        $this->actingAs($provider)
            ->patch(route('provider.programs.finish', $program))
            ->assertRedirect(route('provider.programs.index'));

        $this->actingAs($provider)
            ->patch(route('provider.programs.finish', $program))
            ->assertRedirect(route('provider.programs.index'))
            ->assertSessionHas('success');

        $this->assertSame(Program::STATUS_COMPLETED, $program->fresh()->status);
        $this->assertSame(
            1,
            Activity::query()
                ->where('type', 'program.finished')
                ->where('subject_id', $program->id)
                ->count(),
        );
    }

    /**
     * @return array<string, array{0: string, 1: string}>
     */
    public static function creationProvider(): array
    {
        return [
            'tomorrow' => ['tomorrow', Program::STATUS_UPCOMING],
            'today' => ['today', Program::STATUS_ACTIVE],
            'yesterday' => ['yesterday', Program::STATUS_ACTIVE],
        ];
    }

    #[DataProvider('creationProvider')]
    public function test_a_program_created_from_the_form_lands_in_the_right_status(
        string $offset,
        string $expected,
    ): void {
        $coordinator = $this->coordinator();
        $date = substr($this->day($offset), 0, 10);

        $this->actingAs($coordinator)
            ->from(route('icm.programs.index'))
            ->post(route('icm.programs.store'), [
                'name' => 'Banga TB Screening',
                'location' => 'Banga Rural Health Unit',
                'date' => $date,
                'time' => '09:00',
            ])
            ->assertRedirect(route('icm.programs.index'))
            ->assertSessionHas('success');

        $this->assertSame($expected, Program::query()->sole()->status);

        // The same status the coordinator's list shows — no page derives its own.
        $this->actingAs($coordinator)
            ->get(route('icm.programs.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('programs.0.status', $expected));
    }

    public function test_the_provider_portal_follows_the_derived_status(): void
    {
        $provider = $this->provider();
        $today = $this->program($this->day('today'));
        $future = $this->program($this->day('next week'), ['name' => 'ACF TB Program – Malinao']);

        // Active: the screening workflow opens, with nothing to start by hand.
        $this->actingAs($provider)
            ->get(route('provider.programs.show', $today))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Provider/Programs/Screening')
                ->where('program.status', Program::STATUS_ACTIVE));

        // Registration still works on it.
        $this->actingAs($provider)
            ->post(route('provider.programs.patients.store', $today), [
                'name' => 'JUAN A. DELA CRUZ',
                'birthday' => '1980-11-14',
                'sex' => 'male',
                'contact_number' => '09998134769',
                'address' => 'Agbanawan, Banga, Aklan',
                'presumptive' => false,
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(1, $today->patients()->count());

        // Upcoming: read-only, and outside the screening workflow.
        $this->actingAs($provider)
            ->get(route('provider.programs.show', $future))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Provider/Programs/Completed')
                ->where('program.status', Program::STATUS_UPCOMING));

        // Completed: read-only once the session has ended.
        $this->actingAs($provider)
            ->patch(route('provider.programs.finish', $today));

        $this->actingAs($provider)
            ->get(route('provider.programs.show', $today))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Provider/Programs/Completed')
                ->where('program.status', Program::STATUS_COMPLETED));
    }

    public function test_the_status_scope_matches_the_accessor(): void
    {
        $upcoming = $this->program($this->day('tomorrow'));
        $active = $this->program($this->day('yesterday'), ['name' => 'Active One']);
        $completed = $this->program($this->day('last week'), [
            'name' => 'Completed One',
            'status' => Program::STATUS_COMPLETED,
        ]);

        foreach ([$upcoming, $active, $completed] as $program) {
            $this->assertSame(
                [$program->id],
                Program::query()
                    ->whereCurrentStatus($program->status)
                    ->pluck('id')
                    ->all(),
                "The scope disagreed with the accessor for {$program->status}.",
            );
        }
    }

    public function test_the_provider_dashboard_picks_up_a_program_on_its_scheduled_day(): void
    {
        $this->program($this->day('today'));
        $provider = $this->provider();

        $this->actingAs($provider)
            ->withHeaders([
                'X-Inertia' => 'true',
                // Inertia derives the asset version from the built manifest,
                // so a literal here only matches while the app has never been
                // built — once `npm run build` has run, the mismatch answers
                // 409 instead of the page. Send what the browser would have.
                'X-Inertia-Version' => (string) app(HandleInertiaRequests::class)->version(request()),
                'X-Inertia-Partial-Component' => 'Provider/Dashboard',
                'X-Inertia-Partial-Data' => 'ongoing,upcoming,stats',
            ])
            ->get(route('provider.dashboard'))
            ->assertOk()
            ->assertJsonPath('component', 'Provider/Dashboard')
            ->assertJsonPath('props.ongoing.status', Program::STATUS_ACTIVE)
            ->assertJsonPath('props.stats.active_programs', 1)
            ->assertJsonPath('props.upcoming', null);
    }
}
