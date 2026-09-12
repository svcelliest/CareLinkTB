<?php

/*
 * Test bootstrap.
 *
 * Docker passes the application's runtime environment into the container
 * (APP_ENV=local, the MySQL credentials, the database session driver), and PHP
 * exposes those in $_SERVER as well as $_ENV. PHPUnit's `<env force="true">`
 * entries overwrite putenv() and $_ENV but leave $_SERVER alone, and Laravel's
 * env repository reads $_SERVER first — so inside the container the suite ran
 * against the development database in the `local` environment, where CSRF is
 * enforced and every POST came back 419 instead of the assertion under test.
 *
 * Re-pointing $_SERVER at the values PHPUnit resolved makes `php artisan test`
 * behave the same inside the container as it does on the host.
 */

require __DIR__.'/../vendor/autoload.php';

foreach ($_ENV as $key => $value) {
    if (($_SERVER[$key] ?? null) !== $value) {
        $_SERVER[$key] = $value;
    }
}
