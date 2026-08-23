<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use App\Support\ActivityLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class IcmRecordController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['all', 'normal', 'presumptive'])],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $status = $filters['status'] ?? 'all';
        $search = trim($filters['search'] ?? '');

        $paginated = $this->filteredQuery($status, $search)
            ->latest()
            ->paginate(15)
            ->withQueryString();

        $offset = ($paginated->currentPage() - 1) * $paginated->perPage();

        $patients = $paginated->through(
            fn (Patient $patient, int $index) => $this->mapPatient($patient, $offset + $index + 1),
        );

        return Inertia::render('Icm/Records/Index', [
            'patients' => $patients,
            'filters' => compact('status', 'search'),
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['all', 'normal', 'presumptive'])],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $status = $filters['status'] ?? 'all';
        $search = trim($filters['search'] ?? '');

        $patients = $this->filteredQuery($status, $search)->latest()->get();

        return response()->streamDownload(function () use ($patients): void {
            $file = fopen('php://output', 'w');

            fputcsv($file, [
                '#', 'Name', 'Age', 'Sex', 'Address', 'Contact', 'Program', 'Status', 'Date Registered',
            ]);

            foreach ($patients as $index => $patient) {
                $row = $this->mapPatient($patient, $index + 1);
                $escapeForSpreadsheet = static fn($value): string => preg_match(
                    '/^[=+\-@]/',
                    (string) $value,
                ) ? "'{$value}" : (string) $value;

                fputcsv($file, [
                    $row['number'],
                    $escapeForSpreadsheet($row['name']),
                    $row['age'],
                    $row['sex'],
                    $escapeForSpreadsheet($row['address']),
                    $row['contact'],
                    $escapeForSpreadsheet($row['program_name']),
                    $row['status'],
                    $row['date_registered'],
                ]);
            }

            fclose($file);
        }, 'patient-records.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function show(Patient $patient): Response
    {
        $patient->load(['program', 'creator']);

        return Inertia::render('Icm/Records/FormDetail', [
            'patient' => [
                'id' => $patient->id,
                'name' => $patient->name,
                'form_type' => $patient->form_type,
                'patient_code' => $patient->patient_code,
                'age' => $patient->age,
                'sex' => $patient->sex,
                'contact_number' => $patient->contact_number,
                'address' => $patient->address,
                'status' => $patient->status,
                'responses' => $patient->responses,
                'program_name' => $patient->program->name,
                'rhu_name' => $patient->creator->name ?? 'Unknown',
                'created_at' => $patient->created_at->format('M j, Y g:i A'),
            ],
        ]);
    }

    public function update(Request $request, Patient $patient): RedirectResponse
    {
        $validated = $request->validate([
            'sputum_collected' => ['nullable', 'string'],
            'not_collected_reason' => ['nullable', 'string', 'max:255'],
        ]);

        $patient->update([
            'responses' => [
                ...$patient->responses,
                ...$validated,
            ],
        ]);

        ActivityLogger::record(
            $request->user(),
            'record.updated',
            'Updated patient record',
            "{$patient->name}'s sputum collection details were updated.",
            ['patient_id' => $patient->id],
            $patient,
        );

        return back()->with('success', "{$patient->name}'s record was updated.");
    }

    private function filteredQuery(string $status, string $search): Builder
    {
        return Patient::query()
            ->with('program')
            ->when($status === 'presumptive', fn (Builder $query) => $query->where(
                fn (Builder $query) => $query
                    ->where('responses->diagnostic_result', 'positive')
                    ->orWhere('responses->tb_case_identified', '1'),
            ))
            ->when($status === 'normal', fn (Builder $query) => $query->where(
                fn (Builder $query) => $query
                    ->where(fn (Builder $q) => $q->whereNull('responses->diagnostic_result')
                        ->orWhere('responses->diagnostic_result', '!=', 'positive'))
                    ->where(fn (Builder $q) => $q->whereNull('responses->tb_case_identified')
                        ->orWhere('responses->tb_case_identified', '!=', '1')),
            ))
            ->when($search !== '', function (Builder $query) use ($search) {
                $escapedSearch = addcslashes($search, '%_\\');

                $query->where(function (Builder $query) use ($escapedSearch) {
                    $query->where('name', 'like', '%'.$escapedSearch.'%')
                        ->orWhere('address', 'like', '%'.$escapedSearch.'%')
                        ->orWhere('contact_number', 'like', '%'.$escapedSearch.'%');
                });
            });
    }

    /**
     * @return array<string, mixed>
     */
    private function mapPatient(Patient $patient, ?int $number = null): array
    {
        return [
            'id' => $patient->id,
            'number' => $number,
            'name' => $patient->name,
            'age' => $patient->age,
            'sex' => $patient->sex,
            'address' => $patient->address,
            'contact' => $patient->contact_number,
            'program_name' => $patient->program->name,
            'status' => $patient->isPresumptive() ? 'Presumptive TB' : 'Normal',
            'date_registered' => $patient->created_at->format('M j, Y'),
        ];
    }
}
