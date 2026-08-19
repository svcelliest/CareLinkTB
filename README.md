# CareLink TB

CareLink TB is a role-based web portal for coordinating community tuberculosis programs across International Care Ministries (ICM), Rural Health Units (RHU), and diagnostic providers.

The application currently includes role-aware authentication, ICM account and program management, RHU sputum/contact-tracing forms, cross-role private messaging and attachments, database notifications, profiles, and recent activity. Provider referrals/forms and full patient-level program monitoring are not implemented yet.

For the detailed implementation state, known gaps, and the last completed work, read [HANDOFF.md](HANDOFF.md). Coding AIs should also follow [AGENTS.md](AGENTS.md).

## Stack

- Laravel 13; PHP 8.3+ is declared, while the current lockfile requires PHP 8.4.1+
- Inertia.js 2 and React 18
- Tailwind CSS 4
- Vite 8
- MySQL for the current local application database
- PHPUnit with in-memory SQLite for tests

## Local setup

```powershell
composer install
npm install
Copy-Item .env.example .env
php artisan key:generate
```

Configure the database values in `.env`, then run:

```powershell
php artisan migrate --seed
composer run dev
```

`composer run dev` starts the Laravel server, queue listener, application log viewer, and Vite development server together.

To create a production frontend bundle:

```powershell
npm run build
```

## Docker development

Docker is the easiest way to run the complete local stack without installing PHP, Composer, Node, or MySQL directly. Docker Desktop must be running.

The PHP image is pinned to PHP 8.5 because the current `composer.lock` contains Symfony 8.1 packages that require PHP 8.4.1 or newer.

```powershell
docker compose up --build -d
docker compose exec app php artisan db:seed
```

Open [http://localhost:8000](http://localhost:8000). Vite hot reload is exposed on port `5173`, and the containerized MySQL database is available to host tools on port `3307`.

The first startup installs Composer and npm dependencies into named Docker volumes, clears stale host-generated development configuration caches, waits for MySQL, and applies migrations. Laravel's container server runs with `--no-reload` so Compose environment values such as `DB_HOST=db` reach web requests instead of falling back to the host `.env`. It does not seed automatically, so rerunning the stack never silently creates demo accounts.

Useful Docker commands:

```powershell
# Follow application and frontend logs
docker compose logs -f app vite

# Run the full suite in an isolated SQLite test container
docker compose run --rm --build test

# Stop the stack while preserving its database
docker compose down
```

The development database is isolated from the database configured in the host `.env`. You may override the exposed ports and local-only passwords with `CARELINK_APP_PORT`, `CARELINK_VITE_PORT`, `CARELINK_DB_PORT`, `CARELINK_DB_PASSWORD`, and `CARELINK_DB_ROOT_PASSWORD` before running Compose.

Always use the dedicated `test` service for containerized tests. It supplies the testing environment, in-memory SQLite, array sessions/cache, synchronous queues, and PHP GD without inheriting the running app's MySQL/session settings. `--build` is safe to leave in the command because Docker reuses cached image layers after the first run.

### Production image

The `production` target bundles Composer dependencies and compiled frontend assets into an Apache image:

```powershell
docker build --target production -t carelink-tb .
```

A deployed production container must receive `APP_KEY`, database settings, and other environment-specific configuration. Set `AUTO_MIGRATE=true` only when that deployment should apply migrations during startup.

## Demo accounts

After `php artisan db:seed`, these development accounts are available with the password `password`:

| Role | Email |
| --- | --- |
| ICM coordinator | `icm.demo@carelink.test` |
| RHU staff | `rhu.demo@carelink.test` |
| Provider staff | `provider.demo@carelink.test` |

Public self-registration is intentionally disabled. ICM coordinators create RHU and provider accounts from the Accounts page.

## Checks

```powershell
composer test
npm run build
php artisan route:list --except-vendor
php artisan migrate:status
```

The test suite requires PHP's SQLite and `pdo_sqlite` extensions because `phpunit.xml` uses an in-memory SQLite database.
