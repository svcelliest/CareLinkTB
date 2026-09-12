<?php

namespace App\Support;

use App\Models\Patient;
use App\Models\Program;
use App\Models\TreatmentCase;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * The one definition of what an RHU account may see.
 *
 * An RHU covers a single municipality — `users.municipality`, which
 * IcmAccountController already requires when a coordinator creates an RHU
 * account. A patient belongs to that catchment when the municipality named in
 * their stored "Barangay, Municipality, Province" address matches, resolved by
 * {@see AklanAddresses::municipalityFromAddress()} — the same reader the ICM
 * analytics use, so the two screens can never disagree about who is whose.
 *
 * Every RHU query and every RHU authorization check goes through this class.
 * Nothing else in the portal decides scope, which is what stops one screen
 * from being tightened while another is left open.
 *
 * An account with no municipality assigned has no catchment and therefore sees
 * nothing. That is deliberate: falling back to "everything" would silently give
 * an unconfigured account province-wide access.
 */
class RhuScope
{
    public static function municipality(User $user): ?string
    {
        return $user->role === 'rhu' ? $user->municipality : null;
    }

    /**
     * Patients inside the RHU's catchment.
     *
     * The `like` narrows the read in SQL; the address is then re-parsed in PHP
     * by {@see self::coversPatient()} wherever a single record is authorized,
     * so a municipality that happens to appear as a substring of a barangay
     * name can never widen access on its own.
     */
    public static function patients(User $user): Builder
    {
        $municipality = self::municipality($user);

        if ($municipality === null) {
            return Patient::query()->whereRaw('1 = 0');
        }

        return Patient::query()->where('address', 'like', '%'.self::escapeLike($municipality).'%');
    }

    /**
     * The RHU's patients, already re-verified in PHP.
     *
     * Aggregated in memory for the same reason TbAnalytics does it: the answer
     * depends on parsing an address string and on a JSON `responses` document
     * whose shape differs per form type, and a community TB programme's roster
     * is in the thousands at most.
     *
     * @return \Illuminate\Support\Collection<int, Patient>
     */
    public static function patientRecords(User $user, ?callable $tap = null): \Illuminate\Support\Collection
    {
        $query = self::patients($user);

        if ($tap !== null) {
            $tap($query);
        }

        return $query->get()
            ->filter(fn (Patient $patient) => self::coversPatient($user, $patient))
            ->values();
    }

    /**
     * Whether this RHU covers the given patient. This is the authoritative
     * check — route-model-bound records are always tested against it before
     * anything is read or written.
     */
    public static function coversPatient(User $user, Patient $patient): bool
    {
        $municipality = self::municipality($user);

        return $municipality !== null
            && AklanAddresses::municipalityFromAddress($patient->address) === $municipality;
    }

    /**
     * Programs the RHU has a stake in: one held in their municipality, or one
     * that registered at least one patient from it.
     *
     * Programs are ICM-owned and the RHU has no Programs screen of its own —
     * this exists only so the Patient Tracker's program filter can offer, and
     * accept, the right subset.
     */
    public static function programs(User $user): Builder
    {
        $municipality = self::municipality($user);

        if ($municipality === null) {
            return Program::query()->whereRaw('1 = 0');
        }

        $escaped = self::escapeLike($municipality);

        return Program::query()->where(function (Builder $query) use ($escaped): void {
            $query->where('location', 'like', '%'.$escaped.'%')
                ->orWhereHas('patients', fn (Builder $patients) => $patients
                    ->where('address', 'like', '%'.$escaped.'%'));
        });
    }

    /** Treatment cases opened for this RHU's catchment. */
    public static function treatmentCases(User $user): Builder
    {
        return TreatmentCase::query()->whereMunicipality(self::municipality($user));
    }

    public static function coversTreatmentCase(User $user, TreatmentCase $case): bool
    {
        $municipality = self::municipality($user);

        return $municipality !== null && $case->municipality === $municipality;
    }

    /**
     * The RHU's address, derived from the municipality the coordinator picked
     * when the account was created.
     *
     * An RHU account already names its municipality — requiring the staff
     * member to retype it as a free-text address would let the two disagree,
     * and the municipality is the one the rest of the portal scopes on. So the
     * address is computed from it instead of stored independently, in the same
     * "…, Province" shape the Aklan dataset uses everywhere else.
     *
     * Returns null for any account that is not an RHU, or an RHU with no
     * municipality assigned — both of which keep their own typed address.
     */
    public static function address(User $user): ?string
    {
        $municipality = self::municipality($user);

        return $municipality === null
            ? null
            : $municipality.', '.AklanAddresses::province();
    }

    /**
     * The RHU's own facility name, used as the treatment facility on a case.
     * Falls back through the fields an account may have filled in rather than
     * hard-coding a name.
     */
    public static function facility(User $user): string
    {
        $municipality = self::municipality($user);

        return $user->organization
            ?: ($municipality !== null ? "RHU {$municipality}" : $user->name);
    }

    private static function escapeLike(string $value): string
    {
        return addcslashes($value, '%_\\');
    }
}
