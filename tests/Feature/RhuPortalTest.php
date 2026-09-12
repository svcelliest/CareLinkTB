<?php

namespace Tests\Feature;

use App\Models\Patient;
use App\Models\Program;
use App\Models\TreatmentCase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The RHU portal: what an RHU account can reach, and — the larger half — what
 * it cannot. Every negative case here goes through the HTTP layer rather than
 * checking that a button is hidden, because hiding a button is not the control.
 */
class RhuPortalTest extends TestCase
{
    use RefreshDatabase;

    private function rhu(string $municipality = 'Banga'): User
    {
        return User::factory()->create([
            'role' => 'rhu',
            'municipality' => $municipality,
            'organization' => "RHU {$municipality}",
        ]);
    }

    private function program(string $location = 'Torralba, Banga, Aklan'): Program
    {
        return Program::create([
            'name' => "ACF TB Program – {$location}",
            'location' => $location,
            'status' => 'active',
            'scheduled_at' => now(),
            'created_by' => User::factory()->create(['role' => 'icm'])->id,
        ]);
    }

    /**
     * @param  array<string, mixed>  $responses
     */
    private function patient(
        Program $program,
        string $address = 'Torralba, Banga, Aklan',
        array $responses = [],
        string $name = 'Juan A. Dela Cruz',
    ): Patient {
        return $program->patients()->create([
            'created_by' => User::factory()->create(['role' => 'provider'])->id,
            'form_type' => Patient::FORM_TYPE_PROVIDER_SCREENING,
            'name' => $name,
            'age' => 40,
            'sex' => 'male',
            'contact_number' => '09998134769',
            'address' => $address,
            'status' => 'completed',
            'responses' => ['birthday' => '1986-01-15', ...$responses],
        ]);
    }

    /** A patient the register already shows as a confirmed TB case. */
    private function diagnosedPatient(Program $program, string $address = 'Torralba, Banga, Aklan'): Patient
    {
        return $this->patient($program, $address, [
            'sputum_collected' => '1',
            'tested_gene_xpert' => '1',
            'diagnostic_result' => 'positive',
            'positive_classification' => 'rr',
            'tb_case_classification' => 'rr_tb',
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function enroll(User $rhu, Patient $patient, array $overrides = []): TreatmentCase
    {
        $this->actingAs($rhu)
            ->post(route('rhu.treatment.store'), [
                'patient_id' => $patient->id,
                'baseline_weight' => 52,
                'registration_group' => 'New',
                'regimen' => TreatmentCase::REGIMENS[0],
                'treatment_start_date' => now()->toDateString(),
                ...$overrides,
            ])
            ->assertSessionHasNoErrors();

        return TreatmentCase::where('patient_id', $patient->id)->firstOrFail();
    }

    /* ── access ────────────────────────────────────────────────────────── */

    public function test_rhu_can_open_every_portal_screen(): void
    {
        $rhu = $this->rhu();

        $this->actingAs($rhu)->get(route('rhu.dashboard'))->assertOk();
        $this->actingAs($rhu)->get(route('rhu.tracker.index'))->assertOk();
        $this->actingAs($rhu)->get(route('rhu.treatment.index'))->assertOk();
        $this->actingAs($rhu)->get(route('rhu.sms.index'))->assertOk();
        $this->actingAs($rhu)->get(route('rhu.inbox'))->assertOk();
        $this->actingAs($rhu)->get(route('rhu.activity'))->assertOk();
    }

    public function test_other_roles_cannot_reach_rhu_screens(): void
    {
        foreach (['icm', 'provider'] as $role) {
            $user = User::factory()->create(['role' => $role]);

            $this->actingAs($user)->get(route('rhu.dashboard'))->assertForbidden();
            $this->actingAs($user)->get(route('rhu.tracker.index'))->assertForbidden();
            $this->actingAs($user)->get(route('rhu.treatment.index'))->assertForbidden();
            $this->actingAs($user)->post(route('rhu.treatment.store'), [])->assertForbidden();
        }
    }

    public function test_rhu_cannot_reach_icm_or_provider_screens(): void
    {
        $rhu = $this->rhu();

        $this->actingAs($rhu)->get(route('icm.dashboard'))->assertForbidden();
        $this->actingAs($rhu)->get(route('icm.accounts.index'))->assertForbidden();
        $this->actingAs($rhu)->get(route('provider.dashboard'))->assertForbidden();
    }

    /* ── scoping ───────────────────────────────────────────────────────── */

    public function test_patient_tracker_lists_only_the_accounts_own_municipality(): void
    {
        $program = $this->program();
        $mine = $this->patient($program, 'Torralba, Banga, Aklan', [], 'Mine Banga');
        $theirs = $this->patient($program, 'Andagao, Kalibo, Aklan', [], 'Theirs Kalibo');

        $this->actingAs($this->rhu('Banga'))
            ->get(route('rhu.tracker.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Rhu/PatientTracker/Index')
                ->where('patients.0.name', $mine->name)
                ->count('patients', 1)
                ->where('progress.total', 1));

        $this->assertDatabaseHas('patients', ['id' => $theirs->id]);
    }

    /**
     * The RHU has no Programs screen; the only place a program reaches an RHU
     * is the Patient Tracker's filter, so that is where program scope is
     * enforced — both in what the filter offers and in what it accepts.
     */
    public function test_the_tracker_program_filter_is_scoped_to_the_municipality(): void
    {
        $mine = $this->program('Torralba, Banga, Aklan');
        $theirs = $this->program('Andagao, Kalibo, Aklan');
        $this->patient($mine, 'Torralba, Banga, Aklan', [], 'Mine Banga');
        $this->patient($theirs, 'Andagao, Kalibo, Aklan', [], 'Theirs Kalibo');

        $rhu = $this->rhu('Banga');

        $this->actingAs($rhu)
            ->get(route('rhu.tracker.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->count('programs', 1)
                ->where('programs.0.id', $mine->id));

        // The id is real and the account is a valid RHU — only the catchment
        // stops it. A filter outside the catchment is dropped rather than
        // applied, so it cannot be used to pull another municipality's roster.
        $this->actingAs($rhu)
            ->get(route('rhu.tracker.index', ['program' => $theirs->id]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('filters.program', null)
                ->count('patients', 1)
                ->where('patients.0.name', 'Mine Banga'));
    }

    public function test_an_account_without_a_municipality_has_no_catchment(): void
    {
        $program = $this->program();
        $this->patient($program);

        $this->actingAs(User::factory()->create(['role' => 'rhu', 'municipality' => null]))
            ->get(route('rhu.tracker.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->count('patients', 0)->count('programs', 0));
    }

    /* ── account address ───────────────────────────────────────────────── */

    public function test_an_rhu_address_is_derived_from_its_municipality(): void
    {
        $rhu = $this->rhu('Banga');

        $this->actingAs($rhu)
            ->get(route('profile.edit'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('derivedAddress', 'Banga, Aklan'));

        // The field is locked in the browser; this proves the rule is the
        // server's, by posting a different address anyway.
        $this->actingAs($rhu)
            ->patch(route('profile.update'), [
                'name' => $rhu->name,
                'email' => $rhu->email,
                'address' => 'Somewhere Else, Kalibo, Aklan',
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame('Banga, Aklan', $rhu->fresh()->address);
    }

    public function test_the_coordinators_account_list_shows_the_same_derived_address(): void
    {
        $rhu = $this->rhu('Banga');
        $provider = User::factory()->create([
            'role' => 'provider',
            'address' => 'Poblacion, Kalibo, Aklan',
        ]);

        $this->actingAs(User::factory()->create(['role' => 'icm']))
            ->get(route('icm.accounts.index'))
            ->assertOk()
            ->assertInertia(function ($page) use ($rhu, $provider) {
                $accounts = collect($page->toArray()['props']['accounts']['data'])
                    ->keyBy('id');

                $this->assertSame('Banga, Aklan', $accounts[$rhu->id]['location']);
                $this->assertSame(
                    'Poblacion, Kalibo, Aklan',
                    $accounts[$provider->id]['location'],
                );
            });
    }

    public function test_other_roles_keep_their_own_typed_address(): void
    {
        foreach (['icm', 'provider'] as $role) {
            $user = User::factory()->create(['role' => $role]);

            $this->actingAs($user)
                ->get(route('profile.edit'))
                ->assertOk()
                ->assertInertia(fn ($page) => $page->where('derivedAddress', null));

            $this->actingAs($user)
                ->patch(route('profile.update'), [
                    'name' => $user->name,
                    'email' => $user->email,
                    'address' => 'Poblacion, Kalibo, Aklan',
                ])
                ->assertSessionHasNoErrors();

            $this->assertSame('Poblacion, Kalibo, Aklan', $user->fresh()->address);
        }
    }

    /* ── account address ───────────────────────────────────────────────── */

    /* ── Patient Tracker: the ownership split ──────────────────────────── */

    /**
     * Diagnostic assessment progress is the two required tests — GXpert (3a)
     * and DSSM (3b) — so one patient reads 0%, 50% or 100%.
     */
    public function test_diagnostic_progress_counts_the_two_required_tests(): void
    {
        $program = $this->program();
        $rhu = $this->rhu();

        $cases = [
            [[], 0],
            [['tested_gene_xpert' => '1'], 50],
            [['tested_dssm' => '1'], 50],
            [['tested_gene_xpert' => '1', 'tested_dssm' => '1'], 100],
        ];

        foreach ($cases as [$responses, $expected]) {
            $patient = $this->patient($program, 'Torralba, Banga, Aklan', $responses);

            $this->assertSame(
                $expected,
                $patient->diagnosticProgressPercent(),
                'Progress for '.json_encode($responses),
            );

            $patient->delete();
        }

        // Aggregated across the roster, the tracker counts tests rather than
        // patients: two patients need four tests, and three of them are done.
        $this->patient($program, 'Torralba, Banga, Aklan', [
            'tested_gene_xpert' => '1',
            'tested_dssm' => '1',
        ], 'Both Done');
        $this->patient($program, 'Torralba, Banga, Aklan', [
            'tested_gene_xpert' => '1',
        ], 'Half Done');

        $this->actingAs($rhu)
            ->get(route('rhu.tracker.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('progress.tests_completed', 3)
                ->where('progress.tests_total', 4)
                ->where('progress.total', 2));
    }

    public function test_recording_a_test_moves_the_diagnostic_progress(): void
    {
        $patient = $this->patient($this->program());
        $rhu = $this->rhu();

        $this->assertSame(0, $patient->diagnosticProgressPercent());

        $this->actingAs($rhu)
            ->patch(route('rhu.tracker.diagnostic.update'), [
                'patients' => [[
                    'id' => $patient->id,
                    'tested_gene_xpert' => '1',
                    'tested_dssm' => '1',
                ]],
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(100, $patient->fresh()->diagnosticProgressPercent());
    }

    public function test_rhu_can_record_a_diagnostic_assessment(): void
    {
        $patient = $this->patient($this->program());
        $rhu = $this->rhu();

        $this->actingAs($rhu)
            ->patch(route('rhu.tracker.diagnostic.update'), [
                'patients' => [[
                    'id' => $patient->id,
                    'tested_gene_xpert' => '1',
                    'tested_dssm' => '',
                    'diagnostic_result' => 'positive',
                    'positive_classification' => 'tt',
                    'diagnostic_remarks' => 'Confirmed by provincial GeneXpert.',
                ]],
            ])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $responses = $patient->fresh()->responses;

        $this->assertSame('1', $responses['tested_gene_xpert']);
        $this->assertSame('positive', $responses['diagnostic_result']);
        $this->assertSame('tt', $responses['positive_classification']);
        $this->assertSame('Confirmed by provincial GeneXpert.', $responses['diagnostic_remarks']);

        $this->assertDatabaseHas('activities', [
            'user_id' => $rhu->id,
            'type' => 'diagnostic.assessment_updated',
        ]);
    }

    public function test_rhu_records_sputum_collection_but_never_the_coordinators_remark(): void
    {
        $patient = $this->patient($this->program(), 'Torralba, Banga, Aklan', [
            'sputum_collected' => '1',
            'not_collected_reason' => '',
            'remarks' => 'Coordinator note — do not lose.',
        ]);

        // The coordinator's own keys are posted alongside the legitimate ones.
        $this->actingAs($this->rhu())
            ->patch(route('rhu.tracker.diagnostic.update'), [
                'patients' => [[
                    'id' => $patient->id,
                    'diagnostic_result' => 'negative',
                    'sputum_collected' => '0',
                    'not_collected_reason' => 'Patient Refused',
                    'remarks' => 'overwritten',
                    'tb_case_classification' => 'rr_tb',
                    'enrolled_tb_treatment' => '1',
                ]],
            ])
            ->assertSessionHasNoErrors();

        $responses = $patient->fresh()->responses;

        // The RHU's own columns changed — the diagnostic assessment, the Final
        // Classification's TB Diagnosis, and sputum collection, which the RHU
        // now records in its tracker…
        $this->assertSame('negative', $responses['diagnostic_result']);
        $this->assertSame('rr_tb', $responses['tb_case_classification']);
        $this->assertSame('0', $responses['sputum_collected']);
        $this->assertSame('Patient Refused', $responses['not_collected_reason']);

        // …and the coordinator's remark on the same record did not.
        $this->assertSame('Coordinator note — do not lose.', $responses['remarks']);

        // Treatment Status is never written from a form, by either portal.
        $this->assertArrayNotHasKey('enrolled_tb_treatment', $responses);
    }

    /**
     * Treatment Status is not typed anywhere: it follows the treatment
     * register, flipping to "On Treatment" the moment a case is opened and to
     * the outcome once that case is closed.
     */
    public function test_treatment_status_follows_the_treatment_register(): void
    {
        $rhu = $this->rhu();
        $patient = $this->diagnosedPatient($this->program());

        $this->assertSame(
            ['label' => 'Not yet Enrolled', 'tone' => 'not_enrolled'],
            $patient->fresh()->load('treatmentCases')->treatmentStatus(),
        );

        $case = $this->enroll($rhu, $patient);

        $this->assertSame(
            ['label' => 'On Treatment', 'tone' => 'enrolled'],
            $patient->fresh()->load('treatmentCases')->treatmentStatus(),
        );

        $this->actingAs($rhu)
            ->patch(route('rhu.treatment.outcome.update', $case), [
                'outcome' => 'Treatment Completed',
                'outcome_date' => now()->toDateString(),
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(
            ['label' => 'Treatment Completed', 'tone' => 'closed'],
            $patient->fresh()->load('treatmentCases')->treatmentStatus(),
        );
    }

    public function test_the_tracker_sends_the_derived_treatment_status(): void
    {
        $rhu = $this->rhu();
        $enrolled = $this->diagnosedPatient($this->program());
        $this->enroll($rhu, $enrolled);

        $this->actingAs($rhu)
            ->get(route('rhu.tracker.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('patients.0.treatment_status.label', 'On Treatment')
                ->where('patients.0.treatment_status.tone', 'enrolled'));
    }

    public function test_a_negative_result_clears_any_stale_positive_classification(): void
    {
        $patient = $this->diagnosedPatient($this->program());

        $this->actingAs($this->rhu())
            ->patch(route('rhu.tracker.diagnostic.update'), [
                'patients' => [[
                    'id' => $patient->id,
                    'diagnostic_result' => 'negative',
                    'positive_classification' => 'rr',
                ]],
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame('', $patient->fresh()->responses['positive_classification']);
    }

    public function test_rhu_cannot_assess_a_patient_outside_its_municipality(): void
    {
        $patient = $this->patient($this->program(), 'Andagao, Kalibo, Aklan');

        $this->actingAs($this->rhu('Banga'))
            ->patch(route('rhu.tracker.diagnostic.update'), [
                'patients' => [[
                    'id' => $patient->id,
                    'diagnostic_result' => 'positive',
                    'positive_classification' => 'rr',
                ]],
            ])
            ->assertNotFound();

        $this->assertArrayNotHasKey('diagnostic_result', $patient->fresh()->responses);
    }

    /* ── Treatment enrolment ───────────────────────────────────────────── */

    public function test_enrolling_a_diagnosed_patient_opens_a_numbered_case(): void
    {
        $rhu = $this->rhu();
        $patient = $this->diagnosedPatient($this->program());

        $case = $this->enroll($rhu, $patient);

        $this->assertSame('TB-'.now()->format('Y').'-001', $case->case_number);
        $this->assertSame('Banga', $case->municipality);
        $this->assertSame('RHU Banga', $case->treatment_facility);
        $this->assertNull($case->outcome);

        // The program register is kept in step, additively.
        $responses = $patient->fresh()->responses;
        $this->assertSame('1', $responses['enrolled_tb_treatment']);
        $this->assertSame($case->case_number, $responses['tb_registry_number']);
        $this->assertSame('1', $responses['sputum_collected']);

        $this->assertDatabaseHas('activities', [
            'user_id' => $rhu->id,
            'type' => 'treatment.enrolled',
        ]);
    }

    public function test_case_numbers_increment_and_are_never_reused(): void
    {
        $rhu = $this->rhu();
        $program = $this->program();
        $year = now()->format('Y');

        $first = $this->enroll($rhu, $this->diagnosedPatient($program));
        $second = $this->enroll($rhu, $this->diagnosedPatient($program));

        $this->assertSame("TB-{$year}-001", $first->case_number);
        $this->assertSame("TB-{$year}-002", $second->case_number);

        // Deleting the highest must not hand its number out again.
        $second->delete();
        $third = $this->enroll($rhu, $this->diagnosedPatient($program));

        $this->assertSame("TB-{$year}-003", $third->case_number);
    }

    public function test_an_undiagnosed_patient_cannot_be_enrolled(): void
    {
        $rhu = $this->rhu();
        $patient = $this->patient($this->program());

        $this->actingAs($rhu)
            ->post(route('rhu.treatment.store'), [
                'patient_id' => $patient->id,
                'baseline_weight' => 52,
                'registration_group' => 'New',
                'regimen' => TreatmentCase::REGIMENS[0],
                'treatment_start_date' => now()->toDateString(),
            ])
            ->assertSessionHasErrors('patient_id');

        $this->assertDatabaseCount('treatment_cases', 0);
    }

    public function test_a_patient_cannot_be_enrolled_twice_while_a_case_is_open(): void
    {
        $rhu = $this->rhu();
        $patient = $this->diagnosedPatient($this->program());

        $this->enroll($rhu, $patient);

        $this->actingAs($rhu)
            ->post(route('rhu.treatment.store'), [
                'patient_id' => $patient->id,
                'baseline_weight' => 52,
                'registration_group' => 'New',
                'regimen' => TreatmentCase::REGIMENS[0],
                'treatment_start_date' => now()->toDateString(),
            ])
            ->assertSessionHasErrors('patient_id');

        $this->assertDatabaseCount('treatment_cases', 1);
    }

    public function test_treatment_cannot_start_before_registration(): void
    {
        $rhu = $this->rhu();
        $patient = $this->diagnosedPatient($this->program());

        $this->actingAs($rhu)
            ->post(route('rhu.treatment.store'), [
                'patient_id' => $patient->id,
                'baseline_weight' => 52,
                'registration_group' => 'New',
                'regimen' => TreatmentCase::REGIMENS[0],
                'treatment_start_date' => now()->subDay()->toDateString(),
            ])
            ->assertSessionHasErrors('treatment_start_date');
    }

    public function test_a_patient_outside_the_municipality_cannot_be_enrolled(): void
    {
        $rhu = $this->rhu('Banga');
        $patient = $this->diagnosedPatient($this->program(), 'Andagao, Kalibo, Aklan');

        $this->actingAs($rhu)
            ->post(route('rhu.treatment.store'), [
                'patient_id' => $patient->id,
                'baseline_weight' => 52,
                'registration_group' => 'New',
                'regimen' => TreatmentCase::REGIMENS[0],
                'treatment_start_date' => now()->toDateString(),
            ])
            ->assertNotFound();

        $this->assertDatabaseCount('treatment_cases', 0);
    }

    /* ── Treatment monitoring and closure ──────────────────────────────── */

    /**
     * The Monthly Clinical Review's own fields. Adherence is not among them —
     * it belongs to the weekly dispensing visits.
     *
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function review(array $overrides = []): array
    {
        return [
            'month' => 1,
            'review_date' => now()->toDateString(),
            'weight_kg' => 52.5,
            'confirmed_dose' => 3,
            'reviewed_by_name' => 'Nurse Maria',
            'clinical_status' => 'Improving',
            ...$overrides,
        ];
    }

    /** Saves month `$month`'s review so dispensing is allowed against it. */
    private function saveReview(User $rhu, TreatmentCase $case, int $month = 1): void
    {
        $this->actingAs($rhu)
            ->patch(route('rhu.treatment.monitoring.update', $case), $this->review([
                'month' => $month,
            ]))
            ->assertSessionHasNoErrors();
    }

    public function test_rhu_can_save_a_monthly_clinical_review(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));

        $this->actingAs($rhu)
            ->patch(route('rhu.treatment.monitoring.update', $case), $this->review([
                'symptoms' => 'Occasional cough',
                'remarks' => 'Tolerating the regimen.',
            ]))
            ->assertSessionHasNoErrors();

        $entry = $case->monitoringEntries()->where('month', 1)->firstOrFail();

        $this->assertSame(52.5, $entry->weight_kg);
        $this->assertSame(3, $entry->confirmed_dose);
        $this->assertSame('Nurse Maria', $entry->reviewed_by_name);
        $this->assertSame('Improving', $entry->clinical_status);
        $this->assertTrue($entry->isSaved());
        $this->assertSame($rhu->id, $entry->recorded_by);

        // The baseline is the weight taken at enrolment (52 kg, from enroll());
        // a later review's weight is progress, not a new baseline.
        $this->assertSame(52.0, $case->fresh()->baseline_weight);
    }

    public function test_a_review_needs_a_weight_dose_and_reviewer(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));

        $this->actingAs($rhu)
            ->patch(route('rhu.treatment.monitoring.update', $case), [
                'month' => 1,
                'review_date' => now()->toDateString(),
            ])
            ->assertSessionHasErrors(['weight_kg', 'confirmed_dose', 'reviewed_by_name']);

        $this->assertDatabaseCount('treatment_monitoring_entries', 0);
    }

    public function test_a_month_that_is_not_due_yet_is_refused(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));

        $this->actingAs($rhu)
            ->patch(
                route('rhu.treatment.monitoring.update', $case),
                $this->review(['month' => 5]),
            )
            ->assertSessionHasErrors('month');

        $this->assertDatabaseCount('treatment_monitoring_entries', 0);
    }

    public function test_closing_a_case_locks_further_monitoring(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));

        $this->actingAs($rhu)
            ->patch(route('rhu.treatment.outcome.update', $case), [
                'outcome' => 'Treatment Completed',
                'outcome_date' => now()->toDateString(),
                'outcome_remarks' => 'Completed six months.',
            ])
            ->assertSessionHasNoErrors();

        $case->refresh();
        $this->assertSame('Treatment Completed', $case->outcome);
        $this->assertNotNull($case->closed_at);

        $this->actingAs($rhu)
            ->patch(route('rhu.treatment.monitoring.update', $case), $this->review())
            ->assertSessionHasErrors('month');

        // And it cannot be closed a second time with a different outcome.
        $this->actingAs($rhu)
            ->patch(route('rhu.treatment.outcome.update', $case), [
                'outcome' => 'Failed',
                'outcome_date' => now()->toDateString(),
            ])
            ->assertSessionHasErrors('outcome');

        $this->assertSame('Treatment Completed', $case->fresh()->outcome);
    }

    /* ── Medication dispensing ─────────────────────────────────────────── */

    public function test_enrolment_opens_the_followup_schedule_and_first_release(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));

        // A bacteriologically confirmed case is examined three times.
        $this->assertSame('Bacteriologically Confirmed', $case->enrolled_as);
        $this->assertSame([2, 5, 6], $case->followups()->pluck('month')->all());

        // The first strip is released at enrolment, as week 0.
        $initial = $case->dispensingRecords()->firstOrFail();
        $this->assertTrue($initial->is_initial);
        $this->assertSame(0, $initial->week);
        $this->assertSame(28, $initial->weekly_supply);
    }

    public function test_dispensing_is_refused_until_the_month_review_is_saved(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));

        $this->actingAs($rhu)
            ->post(route('rhu.treatment.dispensing.store', $case), [
                'dispensed_on' => now()->toDateString(),
            ])
            ->assertSessionHasErrors('dispensed_on');

        $this->assertSame(1, $case->dispensingRecords()->count());
    }

    /**
     * The dose is the one confirmed on the review, and missed doses come from
     * the interval since the previous visit — neither is taken from the form.
     */
    public function test_a_dispensing_visit_derives_its_dose_and_missed_doses(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));
        $this->saveReview($rhu, $case);

        $this->actingAs($rhu)
            ->post(route('rhu.treatment.dispensing.store', $case), [
                'dispensed_on' => now()->addDays(7)->toDateString(),
                'next_dispensing_on' => now()->addDays(14)->toDateString(),
                'remaining_tablets' => 4,
                'doses_taken' => 5,
                // Posted, and ignored: the review decides the dose.
                'dose' => 5,
            ])
            ->assertSessionHasNoErrors();

        $record = $case->dispensingRecords()->where('is_initial', false)->firstOrFail();

        $this->assertSame(3, $record->dose, 'The confirmed review dose is used.');
        $this->assertSame(1, $record->week);
        $this->assertSame(5, $record->doses_taken);
        $this->assertSame(2, $record->doses_missed, '7 scheduled days less 5 taken.');
        $this->assertSame(28, $record->weekly_supply);
    }

    public function test_doses_taken_cannot_exceed_the_days_since_the_last_visit(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));
        $this->saveReview($rhu, $case);

        $this->actingAs($rhu)
            ->post(route('rhu.treatment.dispensing.store', $case), [
                'dispensed_on' => now()->addDays(7)->toDateString(),
                'doses_taken' => 30,
            ])
            ->assertSessionHasNoErrors();

        // Clamped rather than rejected: 30 days cannot have passed in 7.
        $record = $case->dispensingRecords()->where('is_initial', false)->firstOrFail();
        $this->assertSame(7, $record->doses_taken);
        $this->assertSame(0, $record->doses_missed);
    }

    public function test_a_serious_side_effect_is_flagged_on_save(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));
        $this->saveReview($rhu, $case);

        $this->actingAs($rhu)
            ->post(route('rhu.treatment.dispensing.store', $case), [
                'dispensed_on' => now()->addDays(7)->toDateString(),
                'doses_taken' => 7,
                'side_effects' => ['Yellowing of eyes / skin'],
                'side_effect_severity' => 'Severe',
                'side_effect_referred' => true,
            ])
            ->assertSessionHasNoErrors();

        $record = $case->dispensingRecords()->where('is_initial', false)->firstOrFail();

        $this->assertTrue($record->hasSeriousSideEffect());
        $this->assertSame(['Yellowing of eyes / skin'], $record->side_effects);
        $this->assertTrue($record->side_effect_referred);
    }

    /**
     * Side effects are recorded as Yes / No / Other, and Other carries the
     * effect the RHU typed — so free text is stored, not refused. The next
     * dispensing date is always one pickup cycle after the dispensing date,
     * whatever the form sent.
     */
    public function test_a_typed_side_effect_is_stored_and_the_next_date_is_derived(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));
        $this->saveReview($rhu, $case);

        $dispensedOn = now()->addDays(7)->toDateString();

        $this->actingAs($rhu)
            ->post(route('rhu.treatment.dispensing.store', $case), [
                'dispensed_on' => $dispensedOn,
                'next_dispensing_on' => now()->addDays(30)->toDateString(),
                'side_effects' => ['Mild rash on the arms'],
            ])
            ->assertSessionHasNoErrors();

        $record = $case->dispensingRecords()->where('is_initial', false)->firstOrFail();

        $this->assertSame(['Mild rash on the arms'], $record->side_effects);
        $this->assertSame(
            now()->addDays(14)->toDateString(),
            $record->next_dispensing_on->toDateString(),
        );
    }

    /* ── Sequential months and weeks ───────────────────────────────────── */

    /** Record one weekly return, `$days` after the previous visit. */
    private function dispense(User $rhu, TreatmentCase $case, int $days = 7): void
    {
        $last = $case->fresh()->dispensingRecords()->orderByDesc('dispensed_on')->orderByDesc('id')->first();

        $this->actingAs($rhu)
            ->post(route('rhu.treatment.dispensing.store', $case), [
                'dispensed_on' => $last->dispensed_on->copy()->addDays($days)->toDateString(),
                'remaining_tablets' => 7,
                'doses_taken' => $days,
            ])
            ->assertSessionHasNoErrors();
    }

    public function test_the_current_month_advances_only_when_the_month_is_completed(): void
    {
        $rhu = $this->rhu();
        // Started two calendar months ago — on the old date-based rule this
        // would already be Month 3. It is Month 1 until Month 1 is worked.
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()), [
            'treatment_start_date' => now()->toDateString(),
        ]);
        $case->forceFill(['treatment_start_date' => now()->subDays(60)])->save();

        $this->assertSame(1, $case->fresh()->currentMonth());

        // Month 2 is locked: it cannot be reviewed while Month 1 is open.
        $this->actingAs($rhu)
            ->patch(route('rhu.treatment.monitoring.update', $case), $this->review(['month' => 2]))
            ->assertSessionHasErrors('month');

        $this->saveReview($rhu, $case, 1);
        $this->assertSame(1, $case->fresh()->currentMonth(), 'a review alone does not complete the month');

        foreach (range(1, 4) as $week) {
            $this->dispense($rhu, $case);
        }

        $fresh = $case->fresh();
        $this->assertTrue($fresh->isMonthComplete(1));
        $this->assertSame(2, $fresh->currentMonth());

        // A completed month is finalized — its review can no longer be edited.
        $this->actingAs($rhu)
            ->patch(route('rhu.treatment.monitoring.update', $case), $this->review(['month' => 1]))
            ->assertSessionHasErrors('month');

        // …and Month 2 is now open.
        $this->saveReview($rhu, $case, 2);
        $this->assertTrue($case->fresh()->monitoringEntries()->where('month', 2)->firstOrFail()->isSaved());
    }

    public function test_a_finalized_week_cannot_be_edited_but_the_latest_can(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));
        $this->saveReview($rhu, $case);

        $this->dispense($rhu, $case);
        $this->dispense($rhu, $case);

        [$week1, $week2] = $case->fresh()->dispensingRecords()
            ->where('is_initial', false)->orderBy('week')->get();

        // Week 1 is behind Week 2 now, so it is finalized.
        $this->actingAs($rhu)
            ->patch(route('rhu.treatment.dispensing.update', [$case, $week1]), [
                'dispensed_on' => $week1->dispensed_on->toDateString(),
                'remarks' => 'late correction',
            ])
            ->assertSessionHasErrors('dispensed_on');

        $this->assertNull($week1->fresh()->remarks);

        // Week 2 is the latest visit and can still be corrected.
        $this->actingAs($rhu)
            ->patch(route('rhu.treatment.dispensing.update', [$case, $week2]), [
                'dispensed_on' => $week2->dispensed_on->toDateString(),
                'remarks' => 'corrected count',
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame('corrected count', $week2->fresh()->remarks);
    }

    /* ── Treatment alerts ──────────────────────────────────────────────── */

    public function test_the_rhu_is_notified_once_when_medication_runs_low(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()), [
            // 100 kg → 5 tablets/day, so a 28-tablet strip is down to 3
            // tablets after five days.
            'baseline_weight' => 100,
        ]);
        $case->dispensingRecords()->update(['dispensed_on' => now()->subDays(5)]);

        $this->actingAs($rhu)->get(route('rhu.treatment.show', $case))->assertOk();

        $alerts = $rhu->fresh()->notifications()->get()
            ->filter(fn ($n) => ($n->data['kind'] ?? null) === 'low_supply');

        $this->assertCount(1, $alerts);
        $this->assertSame('Low Medication Supply', $alerts->first()->data['title']);
        $this->assertStringContainsString('3 tablets remaining', $alerts->first()->data['message']);

        // Opening the page again does not raise it a second time.
        $this->actingAs($rhu)->get(route('rhu.treatment.show', $case))->assertOk();
        $this->actingAs($rhu)->get(route('rhu.dashboard'))->assertOk();

        $this->assertCount(1, $rhu->fresh()->notifications()->get()
            ->filter(fn ($n) => ($n->data['kind'] ?? null) === 'low_supply'));
    }

    public function test_the_rhu_is_notified_when_a_followup_diagnostic_test_approaches(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));

        // Nothing is due within the window yet.
        $this->actingAs($rhu)->get(route('rhu.treatment.index'))->assertOk();
        $this->assertCount(0, $rhu->fresh()->notifications()->get()
            ->filter(fn ($n) => ($n->data['kind'] ?? null) === 'followup_due'));

        // Bring the Month 2 test to three days away.
        $case->followups()->where('month', 2)->update(['due_date' => now()->addDays(3)]);

        $this->actingAs($rhu)->get(route('rhu.treatment.index'))->assertOk();

        $alerts = $rhu->fresh()->notifications()->get()
            ->filter(fn ($n) => ($n->data['kind'] ?? null) === 'followup_due');

        $this->assertCount(1, $alerts);
        $this->assertSame('Follow-up Diagnostic Test Approaching', $alerts->first()->data['title']);
        $this->assertStringContainsString($case->patient->name, $alerts->first()->data['message']);

        // Once, not once per page view.
        $this->actingAs($rhu)->get(route('rhu.treatment.index'))->assertOk();
        $this->assertCount(1, $rhu->fresh()->notifications()->get()
            ->filter(fn ($n) => ($n->data['kind'] ?? null) === 'followup_due'));
    }

    public function test_enrolment_sets_the_rhu_fields_from_the_account(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));

        $this->assertSame(now()->toDateString(), $case->registration_date->toDateString());
        $this->assertSame($rhu->name, $case->assigned_provider);
        $this->assertSame('RHU Banga', $case->treatment_facility);
        $this->assertSame('RHU Banga', $case->diagnostic_facility);
        $this->assertSame(52.0, $case->baseline_weight);
        // The initial release is dosed from that weight's band, not the
        // lowest dose.
        $this->assertSame(3, $case->dispensingRecords()->where('is_initial', true)->firstOrFail()->dose);
    }

    /* ── Follow-up diagnostic tests ───────────────────────────────────────── */

    public function test_a_followup_result_can_be_recorded_against_its_schedule(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));
        $followup = $case->followups()->where('month', 2)->firstOrFail();

        $this->assertSame('Upcoming', $followup->status());

        $this->actingAs($rhu)
            ->patch(route('rhu.treatment.followups.update', [$case, $followup]), [
                'collection_date' => now()->toDateString(),
                'result_date' => now()->toDateString(),
                'smear_result' => 'Negative',
                // Carried only for a scanty result, so this must be dropped.
                'afb_count' => '3 AFB / 100 fields',
            ])
            ->assertSessionHasNoErrors();

        $followup->refresh();

        $this->assertTrue($followup->collected);
        $this->assertSame('Negative', $followup->smear_result);
        $this->assertNull($followup->afb_count);
        $this->assertSame('Completed', $followup->status());
        $this->assertFalse($followup->isPositive());
    }

    public function test_a_scanty_followup_requires_its_afb_count(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));
        $followup = $case->followups()->where('month', 2)->firstOrFail();

        $this->actingAs($rhu)
            ->patch(route('rhu.treatment.followups.update', [$case, $followup]), [
                'collection_date' => now()->toDateString(),
                'result_date' => now()->toDateString(),
                'smear_result' => 'Scanty (+n)',
            ])
            ->assertSessionHasErrors('afb_count');
    }

    public function test_another_rhus_followup_cannot_be_recorded(): void
    {
        $banga = $this->rhu('Banga');
        $case = $this->enroll($banga, $this->diagnosedPatient($this->program()));
        $followup = $case->followups()->firstOrFail();

        $this->actingAs($this->rhu('Kalibo'))
            ->patch(route('rhu.treatment.followups.update', [$case, $followup]), [
                'collection_date' => now()->toDateString(),
                'result_date' => now()->toDateString(),
                'smear_result' => 'Negative',
            ])
            ->assertNotFound();

        $this->assertFalse($followup->fresh()->collected);
    }

    /* ── ACF contact tracing ───────────────────────────────────────────── */

    public function test_contact_tracing_is_saved_then_updated_in_place(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));

        $payload = [
            'patient_address' => 'Torralba, Banga, Aklan',
            'acf_date' => now()->toDateString(),
            'province' => 'Aklan',
            'municipality' => 'Banga',
            'visit_type' => 'Home Visit',
            'rhu_contacted' => 'Yes',
            'household_total' => 5,
            'household_symptoms' => 1,
            'tpt_reason' => 'Negative CXR',
            'enumerator' => 'Nurse Maria',
        ];

        $this->actingAs($rhu)
            ->put(route('rhu.treatment.contact-tracing.save', $case), $payload)
            ->assertSessionHasNoErrors();

        $tracing = $case->contactTracing()->firstOrFail();
        $this->assertSame('Home Visit', $tracing->visit_type);
        $this->assertSame(5, $tracing->household_total);

        // A second save updates the one report rather than filing a duplicate.
        $this->actingAs($rhu)
            ->put(route('rhu.treatment.contact-tracing.save', $case), [
                ...$payload,
                'household_total' => 6,
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame(1, $case->contactTracing()->count());
        $this->assertSame(6, $case->contactTracing()->firstOrFail()->household_total);
    }

    public function test_contact_tracing_rejects_values_outside_the_acf_form(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));

        $this->actingAs($rhu)
            ->put(route('rhu.treatment.contact-tracing.save', $case), [
                'visit_type' => 'Telepathy',
                'tpt_reason' => 'Because',
            ])
            ->assertSessionHasErrors(['visit_type', 'tpt_reason']);
    }

    public function test_another_rhu_cannot_file_contact_tracing(): void
    {
        $banga = $this->rhu('Banga');
        $case = $this->enroll($banga, $this->diagnosedPatient($this->program()));

        $this->actingAs($this->rhu('Kalibo'))
            ->put(route('rhu.treatment.contact-tracing.save', $case), [
                'enumerator' => 'Not mine',
            ])
            ->assertNotFound();

        $this->assertDatabaseCount('treatment_contact_tracings', 0);
    }

    /* ── Medication dispensing ─────────────────────────────────────────── */

    /* ── Follow-up diagnostic tests ───────────────────────────────────────── */

    /* ── ACF contact tracing ───────────────────────────────────────────── */

    public function test_an_unrecognised_outcome_is_refused(): void
    {
        $rhu = $this->rhu();
        $case = $this->enroll($rhu, $this->diagnosedPatient($this->program()));

        $this->actingAs($rhu)
            ->patch(route('rhu.treatment.outcome.update', $case), [
                'outcome' => 'Recovered',
                'outcome_date' => now()->toDateString(),
            ])
            ->assertSessionHasErrors('outcome');
    }

    public function test_another_rhu_cannot_read_or_write_a_case_by_changing_the_id(): void
    {
        $banga = $this->rhu('Banga');
        $case = $this->enroll($banga, $this->diagnosedPatient($this->program()));

        $kalibo = $this->rhu('Kalibo');

        $this->actingAs($kalibo)->get(route('rhu.treatment.show', $case))->assertNotFound();

        $this->actingAs($kalibo)
            ->patch(
                route('rhu.treatment.monitoring.update', $case),
                $this->review(['weight_kg' => 99]),
            )
            ->assertNotFound();

        $this->actingAs($kalibo)
            ->patch(route('rhu.treatment.outcome.update', $case), [
                'outcome' => 'Treatment Failed',
                'outcome_date' => now()->toDateString(),
            ])
            ->assertNotFound();

        $this->assertDatabaseCount('treatment_monitoring_entries', 0);
        $this->assertNull($case->fresh()->outcome);
    }

    public function test_the_case_list_shows_only_the_accounts_own_cases(): void
    {
        $banga = $this->rhu('Banga');
        $this->enroll($banga, $this->diagnosedPatient($this->program()));

        $kalibo = $this->rhu('Kalibo');
        $this->enroll(
            $kalibo,
            $this->diagnosedPatient($this->program('Andagao, Kalibo, Aklan'), 'Andagao, Kalibo, Aklan'),
        );

        $this->actingAs($banga)
            ->get(route('rhu.treatment.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Rhu/Treatment/Index')
                ->where('stats.total', 1)
                ->count('cases.data', 1));
    }

    /* ── SMS log ───────────────────────────────────────────────────────── */

    public function test_logging_an_alert_records_it_against_the_patient(): void
    {
        $rhu = $this->rhu();
        $patient = $this->diagnosedPatient($this->program());

        $this->actingAs($rhu)
            ->post(route('rhu.sms.store'), [
                'patients' => [$patient->id],
                'message' => 'Please return to the RHU for your follow-up.',
            ])
            ->assertSessionHasNoErrors();

        $this->assertNotNull($patient->fresh()->notified_at);
        $this->assertDatabaseHas('activities', [
            'user_id' => $rhu->id,
            'type' => 'program.patient_notified',
        ]);
    }

    public function test_an_alert_cannot_be_logged_against_another_municipalitys_patient(): void
    {
        $patient = $this->diagnosedPatient($this->program(), 'Andagao, Kalibo, Aklan');

        $this->actingAs($this->rhu('Banga'))
            ->post(route('rhu.sms.store'), [
                'patients' => [$patient->id],
                'message' => 'Please return to the RHU.',
            ])
            ->assertNotFound();

        $this->assertNull($patient->fresh()->notified_at);
    }
}
