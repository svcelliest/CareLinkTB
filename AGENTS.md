# CareLink TB agent instructions

## Start here

Before changing code, read `HANDOFF.md` from top to bottom. It is the living source of truth for the product scope, implemented features, known gaps, environment status, and the last completed work.

Do not restart, re-scaffold, or replace working features merely because the original chat is unavailable. Reconstruct intent from `HANDOFF.md`, the routes, tests, and existing UI before proposing a different structure.

## Preserve continuity

- Treat all existing files as user work. This checkout currently has an empty `.git` directory and is not recognized as a Git repository, so there is no reliable history or clean-tree signal.
- Inspect the relevant controller, request, model, page, and tests before editing a feature.
- Keep `HANDOFF.md` current after every meaningful task. Add a short dated entry describing the request, decisions, files changed, verification performed, and any unresolved issue.
- If a feature is only a placeholder, preserve that distinction in the handoff. Do not describe placeholder UI as implemented.
- Never copy secrets or database credentials from `.env` into documentation, code, output, or commits.

## Product and roles

CareLink TB is a role-based tuberculosis program coordination portal for:

- `icm`: International Care Ministries coordinators who manage programs and RHU/provider accounts.
- `rhu`: Rural Health Unit staff who view programs and complete sputum-collection and contact-tracing forms.
- `provider`: diagnostic provider staff; this portal is currently much less complete than the ICM and RHU portals.

All authenticated dashboard routes must also use the `active` middleware. Role-specific routes must use `role:icm`, `role:rhu`, or `role:provider`. Public self-registration is intentionally disabled; ICM creates RHU and provider accounts.

## Architecture and conventions

- Backend: Laravel 13, PHP 8.3+ declared, Eloquent, MySQL in the current local environment. The present lockfile effectively requires PHP 8.4.1+; Docker is pinned to PHP 8.5.8.
- Frontend: Inertia.js 2, React 18, Tailwind CSS 4, Vite 8, and Ziggy named routes.
- Routes live in `routes/web.php` and `routes/auth.php`.
- Controllers pass serialized props to pages under `resources/js/Pages`.
- Shared authenticated UI is in `resources/js/Layouts/DashboardLayout.jsx` and `resources/js/Components/dashboard`.
- Role navigation is declared in `resources/js/data/navConfig.jsx`.
- Put reusable validation in Form Request classes. Keep authorization enforced server-side even when the UI hides an action.
- Use migrations for schema changes, Eloquent relationships for ownership, and feature tests for auth/role/data-boundary behavior.
- Message attachments and profile avatars are private on the `local` disk and are served through authorized controller actions. Do not expose them through `public/storage`.
- Activity entries are user-scoped. Notifications and messages must never leak across users or conversations.

## Useful commands

```powershell
composer run dev
composer test
npm run build
docker compose up --build
docker compose run --rm --build test
php artisan route:list --except-vendor
php artisan migrate:status
php artisan db:seed
```

The test configuration uses in-memory SQLite. On the machine inspected on 2026-08-06, host PHP lacked the `pdo_sqlite` driver, so most feature tests could not start. The Docker PHP image includes `pdo_sqlite` and GD; prefer the isolated `docker compose run --rm --build test` service. Do not run tests through the live `app` service because its MySQL/session environment overrides test isolation. Read the latest verification section in `HANDOFF.md` before treating a host environment failure as a code regression.

## Definition of done

For a code change:

1. Verify the smallest relevant test set, then the full suite when possible.
2. Build the frontend when JSX, CSS, or frontend dependencies change.
3. Check role authorization and data ownership for any new endpoint.
4. Update `HANDOFF.md` with what actually changed and what remains.
