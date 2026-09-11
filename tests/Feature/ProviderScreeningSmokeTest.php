<?php

namespace Tests\Feature;

use App\Models\Patient;
use App\Models\Program;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProviderScreeningSmokeTest extends TestCase
{
    use RefreshDatabase;

    public function test_provider_can_register_a_patient_and_activity_is_recorded(): void
    {
        $provider = User::factory()->create(['role' => 'provider']);
        $program = $this->activeProgram($provider);

        $this->actingAs($provider)
            ->post(route('provider.programs.patients.store', $program), [
                'name' => 'juan dela cruz',
                'date_of_birth' => '1990-01-01',
                'sex' => 'Male',
                'address' => 'Purok 1',
                'contact_number' => '09171234567',
            ])
            ->assertOk();

        $patient = Patient::query()->sole();
        $this->assertSame('JUAN DELA CRUZ', $patient->name);
        $this->assertSame('male', $patient->sex);
        $this->assertFalse((bool) $patient->presumptive);
        $this->assertDatabaseHas('activities', [
            'type' => 'program.patient_registered',
            'subject_type' => Patient::class,
            'subject_id' => $patient->id,
        ]);
    }

    public function test_store_patient_validation_errors(): void
    {
        $provider = User::factory()->create(['role' => 'provider']);
        $program = $this->activeProgram($provider);

        $this->actingAs($provider)
            ->from(route('provider.programs.show', $program))
            ->post(route('provider.programs.patients.store', $program), [
                'name' => '',
                'date_of_birth' => 'not-a-date',
                'sex' => 'other',
                'address' => '',
                'contact_number' => '',
            ])
            ->assertRedirect(route('provider.programs.show', $program))
            ->assertSessionHasErrors(['name', 'date_of_birth', 'sex', 'address', 'contact_number']);

        $this->assertDatabaseCount('patients', 0);
    }

    public function test_store_update_destroy_against_completed_program_fail_with_program_error(): void
    {
        $provider = User::factory()->create(['role' => 'provider']);
        $completed = $this->activeProgram($provider, ['status' => 'completed']);
        $patient = $this->makePatient($completed, $provider, ['name' => 'EXISTING PATIENT']);

        $payload = [
            'name' => 'NEW PATIENT',
            'date_of_birth' => '1991-01-01',
            'sex' => 'Female',
            'address' => 'Purok 2',
            'contact_number' => '09171111111',
        ];

        $this->actingAs($provider)
            ->from(route('provider.programs.show', $completed))
            ->post(route('provider.programs.patients.store', $completed), $payload)
            ->assertSessionHasErrors('program');

        $this->actingAs($provider)
            ->from(route('provider.programs.show', $completed))
            ->patch(route('provider.programs.patients.update', [$completed, $patient]), [
                ...$payload,
                'presumptive' => false,
            ])
            ->assertSessionHasErrors('program');

        $this->actingAs($provider)
            ->from(route('provider.programs.show', $completed))
            ->delete(route('provider.programs.patients.destroy', [$completed, $patient]))
            ->assertSessionHasErrors('program');

        $this->assertDatabaseCount('patients', 1);
    }

    public function test_cross_program_patient_id_is_rejected(): void
    {
        $provider = User::factory()->create(['role' => 'provider']);
        $programA = $this->activeProgram($provider, ['name' => 'Program A']);
        $programB = $this->activeProgram($provider, ['name' => 'Program B']);
        $patientInB = $this->makePatient($programB, $provider, ['name' => 'PATIENT B']);

        $this->actingAs($provider)
            ->patch(route('provider.programs.patients.update', [$programA, $patientInB]), [
                'name' => 'HACKED',
                'date_of_birth' => '1990-01-01',
                'sex' => 'Male',
                'address' => 'Purok 1',
                'contact_number' => '09170000000',
                'presumptive' => false,
            ])
            ->assertForbidden();

        $this->actingAs($provider)
            ->delete(route('provider.programs.patients.destroy', [$programA, $patientInB]))
            ->assertNotFound();

        $this->assertDatabaseHas('patients', ['id' => $patientInB->id, 'name' => 'PATIENT B']);
    }

    public function test_retrying_a_store_does_not_create_a_duplicate_patient(): void
    {
        $provider = User::factory()->create(['role' => 'provider']);
        $program = $this->activeProgram($provider);

        $payload = [
            'name' => 'retry patient',
            'date_of_birth' => '1990-01-01',
            'sex' => 'Male',
            'address' => 'Purok 1',
            'contact_number' => '09171234567',
        ];

        $this->actingAs($provider)
            ->post(route('provider.programs.patients.store', $program), $payload)
            ->assertOk();

        $this->actingAs($provider)
            ->post(route('provider.programs.patients.store', $program), $payload)
            ->assertOk();

        $this->assertDatabaseCount('patients', 1);
    }

    private function activeProgram(User $creator, array $attributes = []): Program
    {
        return $creator->createdPrograms()->create([
            'name' => 'Lake Sebu TB Screening',
            'location' => 'Lake Sebu Rural Health Unit',
            'scheduled_at' => now()->subHour(),
            'status' => 'upcoming',
            ...$attributes,
        ]);
    }

    private function makePatient(Program $program, User $creator, array $attributes = []): Patient
    {
        return $program->patients()->create([
            'name' => 'PLACEHOLDER',
            'date_of_birth' => '1990-01-01',
            'sex' => 'male',
            'address' => 'Purok 1',
            'contact_number' => '09170000000',
            'created_by' => $creator->id,
            'presumptive' => false,
            ...$attributes,
        ]);
    }
}
