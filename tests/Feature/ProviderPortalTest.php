<?php

namespace Tests\Feature;

use App\Models\Patient;
use App\Models\Program;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProviderPortalTest extends TestCase
{
    use RefreshDatabase;

    private function provider(): User
    {
        return User::factory()->create(['role' => 'provider']);
    }

    private function program(string $status = 'active'): Program
    {
        return Program::create([
            'name' => 'ACF TB Program – Banga',
            'location' => 'Toralba, Banga, Aklan',
            'status' => $status,
            'scheduled_at' => now(),
            'created_by' => User::factory()->create(['role' => 'icm'])->id,
        ]);
    }

    public function test_provider_dashboard_defers_its_content_heavy_props(): void
    {
        $this->actingAs($this->provider())
            ->get(route('provider.dashboard'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Provider/Dashboard')
                // Deferred props are absent from the first response and are
                // listed for the client to fetch, which is what drives the
                // skeletons.
                ->missing('stats')
                ->missing('recent_programs')
                ->missing('recent_activities'));
    }

    public function test_programs_index_renders(): void
    {
        $this->program();

        $this->actingAs($this->provider())
            ->get(route('provider.programs.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Provider/Programs/Index'));
    }

    public function test_active_program_opens_the_screening_screen_with_its_patients(): void
    {
        $program = $this->program('active');
        $provider = $this->provider();

        Patient::create([
            'program_id' => $program->id,
            'created_by' => $provider->id,
            'form_type' => Patient::FORM_TYPE_PROVIDER_SCREENING,
            'name' => 'JUAN A. DELA CRUZ',
            'age' => 45,
            'sex' => 'male',
            'contact_number' => '09998134769',
            'address' => 'Agbanawan, Banga, Aklan',
            'status' => 'completed',
            'responses' => ['birthday' => '1980-11-14', 'presumptive' => true],
        ]);

        $this->actingAs($provider)
            ->get(route('provider.programs.show', $program))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Provider/Programs/Screening')
                ->has('patients', 1)
                ->where('patients.0.number', '001')
                ->where('patients.0.sex', 'M')
                ->where('patients.0.status', 'Presumptive TB')
                ->where('patients.0.notified', false));
    }

    public function test_completed_program_opens_the_read_only_view(): void
    {
        $program = $this->program('completed');

        $this->actingAs($this->provider())
            ->get(route('provider.programs.show', $program))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Provider/Programs/Completed')
                ->missing('patients')
                ->missing('patient_counts'));
    }

    public function test_non_providers_cannot_reach_the_provider_portal(): void
    {
        foreach (['icm', 'rhu'] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role]))
                ->get(route('provider.dashboard'))
                ->assertForbidden();
        }
    }

    public function test_presumptive_derivation_is_unchanged_for_the_rhu_form_types(): void
    {
        $program = $this->program();
        $creator = $this->provider();

        $sputum = Patient::create([
            'program_id' => $program->id,
            'created_by' => $creator->id,
            'form_type' => 'sputum_collection',
            'name' => 'Sputum Case',
            'status' => 'completed',
            'responses' => ['diagnostic_result' => 'positive'],
        ]);

        $tracing = Patient::create([
            'program_id' => $program->id,
            'created_by' => $creator->id,
            'form_type' => 'contact_tracing',
            'name' => 'Tracing Case',
            'status' => 'completed',
            'responses' => ['tb_case_identified' => '0'],
        ]);

        $this->assertTrue($sputum->isPresumptive());
        $this->assertFalse($tracing->isPresumptive());
    }
}
