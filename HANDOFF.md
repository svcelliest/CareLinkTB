# CareLink TB — AI handoff

Last updated: 2026-08-17 (Asia/Manila)

## Resume from here

The immediate user request was to create durable context so the next AI does not have to start over. No unfinished feature request was supplied in the available conversation. The state below was reconstructed from the application, routes, migrations, and tests; it does not claim knowledge of decisions made in an unavailable earlier chat.

When resuming, first ask what feature or issue the user wants next, then work from the existing implementation. Do not re-scaffold the application.

## Product summary

CareLink TB is a responsive role-based coordination portal for community tuberculosis programs. It connects ICM coordinators, Rural Health Unit staff, and diagnostic providers. The intended workflow shown on the landing page is screening, patient registration, presumptive-case flagging, diagnostic assessment, TB confirmation, treatment monitoring, and program monitoring.

### Role boundaries

| Role            | Implemented scope                                                                                                                                                              | Current gaps                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| ICM coordinator | Dashboard statistics; create/list/view/export programs; create/search/filter/disable/enable RHU and provider accounts; inbox; notifications; profile; recent activity          | Program patient monitoring is still placeholder data; no program edit/delete/status workflow; the sidebar `Forms` item has no route |
| RHU staff       | Dashboard statistics; view all ICM programs; create sputum-collection and contact-tracing records as drafts or completed forms; inbox; notifications; profile; recent activity | Existing form entries are displayed but there is no edit/update route; broader patient/treatment workflow is not modeled            |
| Provider staff  | Dashboard shell; inbox; notifications; profile; recent activity                                                                                                                | `Referrals` and `Forms` sidebar items have no routes or pages; dashboard has no domain statistics                                   |

Public registration is intentionally disabled. Login requires a selected role matching the account. Disabled accounts cannot sign in and an existing disabled session is logged out by middleware.

## Implemented features

### Authentication and accounts

- Roles are `icm`, `rhu`, and `provider`.
- ICM can create only RHU/provider accounts, search/filter them, and enable or disable them.
- User profiles support name, email, phone, organization, position, address, bio, a private avatar, and password changes requiring the current password.
- Shared Inertia props expose the signed-in user, flash messages, unread counts, and six recent notifications.

### Programs and RHU forms

- ICM can create programs with name, location, date, and time. New programs start as `upcoming`; valid statuses in the database are `upcoming`, `active`, and `completed`.
- ICM program detail currently returns an empty `patients` array and zero patient counts. Its CSV export contains program metadata and patient column headings but no patient rows.
- RHU can view program summaries and create `sputum_collection` or `contact_tracing` entries.
- Form entries store common patient fields plus a JSON `responses` object and a `draft`/`completed` status.
- Completed sputum forms require `responses.sputum_collected`. Completed contact-tracing forms require `responses.visit_date` and `responses.contact_method`; drafts may be incomplete.
- The ICM dashboard derives registered-patient count from distinct `patient_name` values. The RHU dashboard currently treats sputum-entry count as suspicious patients and draft-entry count as active cases; these are simple proxy metrics, not a dedicated patient/case model.

### Messaging, notifications, and activity

- Any active authenticated user can message users in other roles.
- A compose action can target up to 50 recipients. The backend creates a private message copy per recipient so recipients cannot see each other.
- Messages support up to five attachments, 10 MB each, limited to common image, PDF, Office, CSV, and text formats.
- Attachments are stored privately on Laravel's `local` disk and downloaded/viewed only through participant-authorized routes.
- Sending a message creates a database notification. Opening a conversation marks received messages and their related message notifications read.
- Security, profile, account, program, form, and message actions are recorded as user-scoped recent activity where supported.

## Important code map

- `routes/web.php`: all role and shared application routes.
- `bootstrap/app.php`: `role` and `active` middleware aliases plus Inertia middleware registration.
- `app/Http/Controllers`: server behavior and Inertia page props.
- `app/Http/Requests`: validation for login, profiles, programs, forms, and messages.
- `app/Models`: `User`, `Program`, `ProgramFormEntry`, `Message`, `MessageAttachment`, and `Activity`.
- `app/Support`: activity and notification logging/presentation.
- `resources/js/Pages`: Inertia pages organized by role and feature.
- `resources/js/Layouts/DashboardLayout.jsx`: shared authenticated shell.
- `resources/js/data/navConfig.jsx`: role-specific navigation, including the known placeholder links.
- `resources/css/app.css`: one large application stylesheet containing landing, dashboard, inbox, program, profile, account, and RHU-form styles.
- `database/migrations`: authoritative schema history.
- `database/seeders/DatabaseSeeder.php`: repeatable demo users and starter messages.
- `tests/Feature`: behavioral coverage for auth, role access, account management, programs/forms, messaging, notifications, profiles, activities, and dashboard counts.
- `Dockerfile`: shared PHP base plus development and production image targets; the production target uses Apache and compiled frontend assets.
- `compose.yaml`: local app, queue, Vite, and MySQL services with named dependency/database volumes.
- `docker/entrypoint.sh`: dependency bootstrap, app-key guard, database wait, and optional migration startup behavior.

## Data model at a glance

- `users`: identity, role, profile fields, private avatar path, and `disabled_at`.
- `programs`: creator, name, location, schedule, and lifecycle status.
- `program_form_entries`: program, RHU creator, form type, common patient fields, status, and JSON responses.
- `messages`: one sender, one recipient, body, and `read_at`.
- `message_attachments`: private disk/path metadata belonging to one message.
- `notifications`: Laravel database notifications.
- `activities`: user-owned audit feed with optional polymorphic subject and JSON metadata.

There is no separate `patients`, `referrals`, diagnostics, treatment, or program-assignment table yet.

## Known gaps and traps

1. `resources/js/data/navConfig.jsx` contains `icm.forms`, `provider.referrals`, and `provider.forms`, but those named routes do not exist. `Sidebar.jsx` catches Ziggy's error and renders these as `href="#"` placeholders.
2. ICM program monitoring is visually present but backend patient data/counts are hard-coded empty/zero in `ProgramController`. CSV exports consequently contain no patients.
3. Provider domain features have not been built beyond the dashboard shell and shared features.
4. RHU form records can be created and viewed, but not edited or deleted.
5. Program lifecycle status exists in the schema but there is no endpoint for changing it.
6. `RhuProgramController` contains a mojibake separator (`Â·`) in `updated_at_label`; replace it with a normal middle dot when that area is next edited.
7. The root `.git` directory is empty, and Git reports that this is not a repository. Do not rely on `git status`, `git diff`, or commit history until repository metadata is restored.
8. The current local `.env` uses MySQL, the database is reachable, and every migration was marked `Ran` on 2026-08-06. Never document its credentials.
9. PHPUnit is configured for in-memory SQLite, but the inspected PHP runtime lacks `pdo_sqlite`. This causes database-backed tests to fail before exercising application code.
10. The built frontend manifest exists but was last generated on 2026-08-05 when inspected; rebuild after frontend changes.
11. The current local `APP_NAME` is still `Laravel`, so Blade's browser title may not show CareLink TB until the environment/default is updated.
12. Laravel's configured application timezone is currently UTC, while the project is being developed in Asia/Manila. Program schedules are created and formatted without explicit timezone conversion, so settle the intended storage/display timezone before relying on times in production.
13. The production frontend stage's `npm ci` reported three high-severity dependency advisories on 2026-08-06. The build still succeeds, but review `npm audit` and test any dependency upgrades before a real deployment.

## Local setup

Requirements: PHP 8.3+, Composer, Node/npm, and MySQL (or another configured Laravel database). For tests, enable PHP's SQLite and `pdo_sqlite` extensions.

```powershell
composer install
npm install
Copy-Item .env.example .env
php artisan key:generate
# Configure the database in .env, then:
php artisan migrate --seed
composer run dev
```

Use `npm run build` for a production frontend bundle.

### Docker setup

`docker compose up --build -d` starts the Laravel development server, MySQL 8.4, Vite with hot reload, and the database queue worker. The app is served at `http://localhost:8000`; MySQL is exposed on host port `3307` to avoid the usual local MySQL port.

The Docker PHP image includes `pdo_mysql`, `pdo_sqlite`, and GD. It automatically applies migrations but intentionally does not seed. Run `docker compose exec app php artisan db:seed` once demo users are wanted. Composer/npm dependencies and MySQL data live in named volumes, while application source is bind-mounted for live development.

The development/test entrypoint clears Laravel's configuration cache before startup because a bind-mounted host cache can freeze host settings. More importantly, the development server uses `php artisan serve --no-reload`: Laravel 13's serve command otherwise strips most parent environment variables when a project `.env` exists, causing web requests to lose Compose's `DB_HOST=db` and fall back to host database settings. Production startup intentionally leaves deployment-managed caches alone.

Run tests with `docker compose run --rm --build test`. The dedicated service supplies in-memory SQLite, array sessions/cache, synchronous queues, and the testing application environment. Do not use `docker compose exec app php artisan test`: the live app service intentionally supplies MySQL and database sessions, which override PHPUnit's environment and cause CSRF 419 responses in request tests.

The Docker base is pinned to PHP 8.5.8. Although `composer.json` declares PHP `^8.3`, the current lockfile contains Symfony 8.1 packages requiring PHP 8.4.1+, so PHP 8.3 cannot install the locked dependency set. Do not downgrade the image without also deliberately resolving and testing the Composer dependency versions.

For a deployable Apache image with production dependencies and built assets, use `docker build --target production -t carelink-tb .`. Production runtime configuration, especially `APP_KEY` and database credentials, must be supplied externally.

### Seeded local demo accounts

`php artisan db:seed` creates or updates these development-only accounts. All three use the password `password`.

- `icm.demo@carelink.test`
- `rhu.demo@carelink.test`
- `provider.demo@carelink.test`

## Latest verification

Performed on 2026-08-06:

- Laravel boots successfully in the local environment: Laravel 13.18.1, PHP 8.5.7.
- `php artisan route:list --except-vendor` succeeds and reports 36 application routes.
- `php artisan migrate:status` succeeds against the configured MySQL database; all migrations are applied.
- `php artisan test` discovered 57 tests. Two non-database example tests passed; 55 feature tests errored at database setup because the PHP runtime could not find the SQLite driver. This run does not show application assertion failures.
- The earlier host-only PHPUnit run remains limited by the missing local SQLite driver; use the dedicated Docker test service for the verified full-suite result below.
- Docker Compose configuration validates successfully. The PHP 8.5.8 development image and all four services build and start; `app` and `db` report healthy, while `queue` and `vite` are running.
- The Docker MySQL database migrated and seeded successfully. It is isolated in the `carelink-tb_mysql-data` named volume.
- `docker compose run --rm --build test` passes all 57 tests with 464 assertions (19.49 seconds in the final verified run).
- `npm run build` succeeds on the host with 799 modules transformed.
- `docker build --target production -t carelink-tb:production .` succeeds. A disposable container made from that exact image returned HTTP 200 from `/up` with migrations disabled, then was stopped and removed.
- The running development stack returns HTTP 200 from both `/` and `/up` on `http://localhost:8000`.

## Handoff log

### 2026-08-06 — durable AI context

- Request: preserve enough context that a future AI can continue without restarting discovery.
- Changes: added `AGENTS.md`, added this handoff, and replaced the generic Laravel README with a CareLink-specific overview and setup guide.
- Production code: unchanged.
- Verification: application boot, routes, migration status, and PHPUnit discovery as described above.
- Unresolved: no active feature request was provided; test execution remains blocked by the missing local SQLite driver.

### 2026-08-06 — Docker development and production setup

- Request: add Docker support to the existing CareLink TB application.
- Decisions: use a development-first Compose stack with Laravel, MySQL, Vite, and a queue worker; keep seeding manual; provide a separate production Apache image target.
- Changes: added `Dockerfile`, `compose.yaml`, `.dockerignore`, and `docker/entrypoint.sh`; made Vite host/HMR/polling container-aware; documented Docker usage in `README.md` and `AGENTS.md`.
- Data safety: Compose uses its own MySQL named volume and does not connect to or replace the host-configured database. Startup runs only forward migrations, not destructive resets or seeders.
- Verification: Compose validates; the development images build; app/MySQL are healthy; Vite/queue run; migrations and seeding succeed; the live landing and health endpoints return HTTP 200; the isolated test service passes 57 tests with 464 assertions; the host frontend build succeeds; the production image builds and returns HTTP 200 from `/up` in a disposable smoke container.
- Problems found and resolved: aligned Docker with the lockfile by moving from PHP 8.3 to 8.5.8; added GD for upload tests; isolated test environment variables from the live app service; excluded transient Laravel package caches from the no-dev production image; clear bind-mounted host configuration caches; use `artisan serve --no-reload` so Laravel passes Compose environment variables to its PHP server child process.
- Current state: the development stack is intentionally left running at `http://localhost:8000`, with Vite on `5173` and MySQL exposed on `3307`. Docker Desktop is running.
- Optional follow-up: inspect the three high-severity advisories reported by `npm ci` before production deployment. No dependency versions were changed during this Docker task.

### 2026-08-13 — AWS deployment cleanup

- Request: remove the local files and configuration created for the cancelled AWS deployment.
- Changes: removed the AWS-specific Compose file, production environment template, source archive, database export, private-upload archive, and the related Dockerfile/HANDOFF changes.
- Verification: confirmed all five generated deployment artifacts are absent and no AWS-specific deployment references remain in `Dockerfile` or this handoff.
- Note: this local cleanup does not cancel or delete any AWS resources.

### Template for the next completed task

Add a new dated section containing:

- Request and intended outcome.
- Decisions or assumptions that should survive the chat.
- Files/features changed.
- Tests/build/manual verification and their exact result.
- Remaining work, known regressions, or the best next step.

### 2026-08-17 — ICM Programs backend rebuild

- Rebuilt the ICM Programs database/backend: creation, owner-scoped list/detail, CSV export, validation, activity logging, protected routes, and feature tests. Frontend remains intentionally deferred.
- Verification: full Docker suite passed — 51 tests, 406 assertions.
- Remaining: Program frontend pages plus edit/delete/status, patient monitoring, and RHU program/form workflows.
