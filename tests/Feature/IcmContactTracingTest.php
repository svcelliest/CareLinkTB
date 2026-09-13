<?php

namespace Tests\Feature;

use App\Models\Patient;
use App\Models\Program;
use App\Models\TreatmentCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The ICM's Contact Tracing screens: patients under treatment, and the ACF
 * report filed for one of them.
 *
 * The point of these tests is as much what the screen is NOT as what it is —
 * it must stay a read-only, two-tab view rather than becoming a second way
 * into the RHU's treatment workflow.
 */
class IcmContactTracingTest extends TestCase
{
    use RefreshDatabase;

    private function coordinator(): User
    {
        return User::factory()->create(['role' => 'icm']);
    }

    private function rhu(string $municipality = 'Banga'): User
    {
        return User::factory()->create([
            'role' => 'rhu',
            'municipality' => $municipality,
            'organization' => "RHU {$municipality}",
        ]);
    }

    private function diagnosedPatient(string $address = 'Torralba, Banga, Aklan'): Patient
    {
        $program = Program::create([
            'name' => 'ACF TB Program',
            'location' => $address,
            'status' => 'active',
            'scheduled_at' => now(),
            'created_by' => $this->coordinator()->id,
        ]);

        return $program->patients()->create([
            'created_by' => User::factory()->create(['role' => 'provider'])->id,
            'form_type' => Patient::FORM_TYPE_PROVIDER_SCREENING,
            'name' => 'Juan A. Dela Cruz',
            'age' => 40,
            'sex' => 'male',
            'contact_number' => '09998134769',
            'address' => $address,
            'status' => 'completed',
            'responses' => [
                'birthday' => '1986-01-15',
                'sputum_collected' => '1',
                'tested_gene_xpert' => '1',
                'diagnostic_result' => 'positive',
                'positive_classification' => 'rr',
                'tb_case_classification' => 'rr_tb',
            ],
        ]);
    }

    /** Enrols through the RHU's own endpoint, so the case is a real one. */
    private function enroll(User $rhu, Patient $patient): TreatmentCase
    {
        $this->actingAs($rhu)
            ->post(route('rhu.treatment.store'), [
                'patient_id' => $patient->id,
                'baseline_weight' => 52,
                'registration_group' => 'New',
                'regimen' => TreatmentCase::REGIMENS[0],
                'treatment_start_date' => now()->toDateString(),
            ])
            ->assertSessionHasNoErrors();

        return TreatmentCase::where('patient_id', $patient->id)->firstOrFail();
    }

    public function test_the_list_shows_patients_currently_under_treatment(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient());

        $this->actingAs($this->coordinator())
            ->get(route('icm.contact-tracing.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Icm/ContactTracing/Index')
                ->where('stats.under_treatment', 1)
                ->where('stats.pending', 1)
                ->where('stats.traced', 0)
                ->count('cases', 1)
                ->where('cases.0.case_number', $case->case_number)
                ->where('cases.0.has_tracing', false));
    }

    /**
     * A closed case is no longer under treatment, so it leaves the list. This
     * is the existing open-case scope, not a status invented for this screen.
     */
    public function test_a_closed_case_drops_off_the_list(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient());

        $this->actingAs($rhu)
            ->patch(route('rhu.treatment.outcome.update', $case), [
                'outcome' => 'Treatment Completed',
                'outcome_date' => now()->toDateString(),
            ])
            ->assertSessionHasNoErrors();

        $this->actingAs($this->coordinator())
            ->get(route('icm.contact-tracing.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('stats.under_treatment', 0)
                ->count('cases', 0));
    }

    /**
     * The ICM is not scoped to a municipality the way an RHU is — it
     * coordinates the whole programme, as the accounts and analytics screens
     * already do.
     */
    public function test_the_coordinator_sees_every_municipality(): void
    {
        $this->enroll($this->rhu('Banga'), $this->diagnosedPatient('Torralba, Banga, Aklan'));
        $this->enroll($this->rhu('Kalibo'), $this->diagnosedPatient('Andagao, Kalibo, Aklan'));

        $this->actingAs($this->coordinator())
            ->get(route('icm.contact-tracing.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('stats.under_treatment', 2)
                ->count('cases', 2)
                ->where('cases.0.municipality', 'Banga')
                ->where('cases.1.municipality', 'Kalibo'));
    }

    /**
     * The register shows the filed answers as columns, with the form's exact
     * wording, and counts the filed forms as its progress.
     */
    public function test_the_register_shows_the_filed_answers_and_the_progress(): void
    {
        $rhu = $this->rhu();
        $traced = $this->enroll($rhu, $this->diagnosedPatient());
        $this->enroll($this->rhu('Kalibo'), $this->diagnosedPatient('Andagao, Kalibo, Aklan'));

        $this->actingAs($rhu)
            ->put(route('rhu.treatment.contact-tracing.save', $traced), [
                'enumerator' => 'Nurse Maria',
                'household_total' => 4,
                'visit_type' => 'Home Visit',
            ])
            ->assertSessionHasNoErrors();

        $this->actingAs($this->coordinator())
            ->get(route('icm.contact-tracing.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('stats.under_treatment', 2)
                ->where('stats.traced', 1)
                ->count('cases', 2)
                ->where('cases.0.has_tracing', true)
                ->where('cases.0.tracing.enumerator', 'Nurse Maria')
                ->where('cases.0.tracing.household_total', '4')
                ->where('cases.0.tracing.visit_type', 'Home Visit')
                ->where('cases.1.has_tracing', false)
                ->where('cases.1.tracing.enumerator', '')
                ->where('options.visit_types', ['Call', 'Home Visit']));
    }

    public function test_the_patient_view_shows_the_summary_and_the_filed_report(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient());

        $this->actingAs($rhu)
            ->put(route('rhu.treatment.contact-tracing.save', $case), [
                'patient_address' => 'Torralba, Banga, Aklan',
                'municipality' => 'Banga',
                'visit_type' => 'Home Visit',
                'household_total' => 5,
                'enumerator' => 'Nurse Maria',
            ])
            ->assertSessionHasNoErrors();

        $this->actingAs($this->coordinator())
            ->get(route('icm.contact-tracing.show', $case))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Icm/ContactTracing/Show')
                ->where('case.case_number', $case->case_number)
                ->where('case.patient.name', 'Juan A. Dela Cruz')
                // The four ACF groups, in the order the form files them.
                ->count('tracing.groups', 4)
                ->where('tracing.groups.0.title', '1. ACF Activity')
                ->where('tracing.groups.3.title', '4. TPT Enrollment'));
    }

    public function test_a_patient_without_tracing_yet_reports_none(): void
    {
        $case = $this->enroll($this->rhu(), $this->diagnosedPatient());

        $this->actingAs($this->coordinator())
            ->get(route('icm.contact-tracing.show', $case))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('tracing', null));
    }

    /**
     * The ICM view carries the patient summary and the ACF report and nothing
     * else — none of the RHU's treatment workflow leaks into its props.
     */
    public function test_the_icm_view_exposes_no_rhu_treatment_workflow(): void
    {
        $case = $this->enroll($this->rhu(), $this->diagnosedPatient());

        $this->actingAs($this->coordinator())
            ->get(route('icm.contact-tracing.show', $case))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->missing('months')
                ->missing('supply')
                ->missing('followups')
                ->missing('timeline')
                ->missing('audit')
                ->missing('options'));
    }

    public function test_other_roles_cannot_reach_the_icm_contact_tracing_screens(): void
    {
        $case = $this->enroll($this->rhu(), $this->diagnosedPatient());

        foreach (['rhu', 'provider'] as $role) {
            $user = $role === 'rhu' ? $this->rhu() : User::factory()->create(['role' => $role]);

            $this->actingAs($user)
                ->get(route('icm.contact-tracing.index'))
                ->assertForbidden();

            $this->actingAs($user)
                ->get(route('icm.contact-tracing.show', $case))
                ->assertForbidden();
        }
    }
}
