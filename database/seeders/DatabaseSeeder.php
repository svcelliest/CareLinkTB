<?php

namespace Database\Seeders;

use App\Models\Message;
use App\Models\Patient;
use App\Models\Program;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // updateOrCreate keeps the demo credentials repeatable when the seeder
        // is run more than once on a developer's existing database.
        $icm = User::updateOrCreate(
            ['email' => 'icm.demo@carelink.test'],
            [
                'name' => 'ICM Demo Coordinator',
                'password' => 'password',
                'role' => 'icm',
                'email_verified_at' => now(),
            ],
        );

        // An RHU account covers one municipality — IcmAccountController already
        // requires it when a coordinator creates one, and RhuScope treats an
        // account without one as having no catchment at all. The demo account
        // predates that rule, so it is given the municipality most of the
        // seeded patients below live in; without it the RHU portal would
        // correctly, but confusingly, show nothing on a fresh install.
        $rhu = User::updateOrCreate(
            ['email' => 'rhu.demo@carelink.test'],
            [
                'name' => 'RHU Demo Staff',
                'password' => 'password',
                'role' => 'rhu',
                'municipality' => 'Banga',
                'organization' => 'RHU Banga',
                'email_verified_at' => now(),
            ],
        );

        $provider = User::updateOrCreate(
            ['email' => 'provider.demo@carelink.test'],
            [
                'name' => 'Provider Demo Staff',
                'password' => 'password',
                'role' => 'provider',
                'email_verified_at' => now(),
            ],
        );

        // Create active programs for testing registration and screening
        $screeningProgram = Program::firstOrCreate(
            [
                'name' => 'TB Screening Program',
                'location' => 'City Health Center',
            ],
            [
                'created_by' => $icm->id,
                'scheduled_at' => now()->subDays(5),
                'status' => 'active',
            ],
        );

        $this->seedScreeningPatients($screeningProgram, $provider);

        Program::firstOrCreate(
            [
                'name' => 'Community Health Outreach',
                'location' => 'Barangay Clinic',
            ],
            [
                'created_by' => $rhu->id,
                'scheduled_at' => now()->subDays(2),
                'status' => 'active',
            ],
        );

        // One of each remaining status so the dashboard's program counters and
        // the Programs page tabs are not empty on a fresh install. Times are
        // inside the 8:00 AM – 5:00 PM window the app enforces.
        Program::firstOrCreate(
            [
                'name' => 'ACF TB Program – Kalibo',
                'location' => 'Andagao, Kalibo, Aklan',
            ],
            [
                'created_by' => $icm->id,
                'scheduled_at' => now()->subMonths(3)->setTime(9, 0),
                'status' => 'completed',
            ],
        );

        Program::firstOrCreate(
            [
                'name' => 'ACF TB Program – Malinao',
                'location' => 'Poblacion, Malinao, Aklan',
            ],
            [
                'created_by' => $icm->id,
                'scheduled_at' => now()->addWeeks(2)->setTime(13, 30),
                'status' => 'upcoming',
            ],
        );

        // A small starter thread makes it easy to inspect previews, unread
        // badges, and read receipts immediately after seeding.
        Message::firstOrCreate(
            [
                'sender_id' => $icm->id,
                'recipient_id' => $rhu->id,
                'body' => 'Good morning! Please send the latest patient referral update when ready.',
            ],
            [
                'created_at' => now()->subMinutes(18),
                'updated_at' => now()->subMinutes(18),
            ],
        );

        Message::firstOrCreate(
            [
                'sender_id' => $rhu->id,
                'recipient_id' => $icm->id,
                'body' => 'Received. I will send the completed referral details this afternoon.',
            ],
            [
                'created_at' => now()->subMinutes(12),
                'updated_at' => now()->subMinutes(12),
            ],
        );

        Message::firstOrCreate(
            [
                'sender_id' => $provider->id,
                'recipient_id' => $icm->id,
                'body' => 'The diagnostic results are available for review.',
            ],
            [
                'created_at' => now()->subMinutes(5),
                'updated_at' => now()->subMinutes(5),
            ],
        );
    }

    /**
     * Fifteen screened patients so the provider screening table has realistic
     * content to page, search, sort and flag against.
     *
     * These are written exactly the way ProviderController::storePatient()
     * writes a real registration — same form_type, same `responses` shape —
     * so Patient::isPresumptive() derives status from the data rather than
     * from a hardcoded column. Addresses come from the ACF scope
     * (see resources/js/data/aklanAddresses.js).
     */
    private function seedScreeningPatients(Program $program, User $provider): void
    {
        // [name, age, sex, contact, address, presumptive, follow-up]
        //
        // The trailing follow-up array is the clinical answer set the RHU
        // sputum-collection form and the ICM Diagnostic Assessment tab write
        // back onto the same record. Seeding it means the dashboard analytics
        // have something real to aggregate on a fresh install — the charts
        // read these rows, they do not carry sample values of their own.
        $patients = [
            ['Juan A. Dela Cruz', 45, 'male', '09998134769', 'Agbanawan, Banga, Aklan', false, []],
            ['Maria D. Santos', 32, 'female', '09456732458', 'Badiangan, Banga, Aklan', true, [
                'sputum_collected' => '1',
                'tested_gene_xpert' => '1',
                'diagnostic_result' => 'positive',
                'positive_classification' => 'rr',
                'tb_case_classification' => 'rr_tb',
                'enrolled_tb_treatment' => '1',
            ]],
            ['Pedro R. Villanueva', 58, 'male', '09171234567', 'Torralba, Banga, Aklan', false, []],
            ['Ana L. Bautista', 27, 'female', '09283456712', 'Andagao, Kalibo, Aklan', false, []],
            ['Ramon T. Gonzales', 63, 'male', '09395512340', 'Poblacion, Kalibo, Aklan', true, [
                'sputum_collected' => '1',
                'tested_dssm' => '1',
                'diagnostic_result' => 'positive',
                'positive_classification' => 'dssm',
                'tb_case_classification' => 'bc_ds_tb',
                'enrolled_tb_treatment' => '1',
            ]],
            ['Luisa M. Fernandez', 41, 'female', '09061234598', 'Cayangwan, Makato, Aklan', false, []],
            ['Carlos B. Reyes', 36, 'male', '09774451209', 'Tugas, Makato, Aklan', false, [
                'sputum_collected' => '1',
                'tested_gene_xpert' => '1',
                'diagnostic_result' => 'negative',
                'tb_case_classification' => 'none',
            ]],
            ['Elena P. Navarro', 52, 'female', '09182234455', 'Poblacion, Numancia, Aklan', true, [
                'sputum_collected' => '1',
                'tested_gene_xpert' => '1',
                'diagnostic_result' => 'positive',
                'positive_classification' => 't',
                'tb_case_classification' => 'cd_ds_tb',
                'enrolled_tb_treatment' => '0',
            ]],
            ['Miguel S. Ortega', 24, 'male', '09228876543', 'Camanci Norte, Numancia, Aklan', false, []],
            ['Rosa V. Aquino', 47, 'female', '09339912874', 'Poblacion, Lezo, Aklan', false, []],
            ['Andres C. Mendoza', 39, 'male', '09054433221', 'Carugdog, Lezo, Aklan', false, []],
            ['Teresa G. Salazar', 55, 'female', '09667788990', 'Poblacion, Malinao, Aklan', true, [
                // Flagged but not yet tested — the "awaiting confirmation" case.
                'sputum_collected' => '0',
                'not_collected_reason' => 'Patient Absent',
            ]],
            ['Ricardo F. Domingo', 30, 'male', '09199988776', 'Cabayugan, Malinao, Aklan', false, []],
            ['Corazon H. Lazaro', 61, 'female', '09477766554', 'Poblacion, Batan, Aklan', false, []],
            ['Fernando J. Castillo', 43, 'male', '09088123456', 'Camaligan, Batan, Aklan', false, [
                'sputum_collected' => '1',
                'tested_dssm' => '1',
                'diagnostic_result' => 'positive',
                'positive_classification' => 'tt',
                'tb_case_classification' => 'bc_ds_tb',
                'enrolled_tb_treatment' => '1',
            ]],
        ];

        foreach ($patients as $index => [$name, $age, $sex, $contact, $address, $presumptive, $followUp]) {
            $program->patients()->firstOrCreate(
                [
                    'name' => $name,
                    'form_type' => Patient::FORM_TYPE_PROVIDER_SCREENING,
                ],
                [
                    'created_by' => $provider->id,
                    'age' => $age,
                    'sex' => $sex,
                    'contact_number' => $contact,
                    'address' => $address,
                    'status' => 'completed',
                    // A couple are marked notified so the bell's sent state is
                    // visible without having to click through first.
                    'notified_at' => $index % 5 === 0 ? now()->subHours(3) : null,
                    'responses' => [
                        'birthday' => now()->subYears($age)->format('Y-m-d'),
                        'presumptive' => $presumptive,
                        ...$followUp,
                    ],
                    // Spread across the past year so the quarterly comparison
                    // and the patient trend have more than one point.
                    'created_at' => now()->subDays(30 * ($index % 12))->subMinutes(60 - $index),
                    'updated_at' => now()->subDays(30 * ($index % 12))->subMinutes(60 - $index),
                ],
            );
        }
    }
}
