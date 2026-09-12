# syntax=docker/dockerfile:1.7

FROM php:8.5.8-apache-bookworm AS php-base

ENV COMPOSER_ALLOW_SUPERUSER=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        git \
        libfreetype6-dev \
        libicu-dev \
        libjpeg62-turbo-dev \
        libonig-dev \
        libpng-dev \
        libsqlite3-dev \
        libzip-dev \
        unzip \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        bcmath \
        gd \
        intl \
        mbstring \
        pcntl \
        pdo_mysql \
        pdo_sqlite \
        zip \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY docker/entrypoint.sh /usr/local/bin/carelink-entrypoint

RUN chmod +x /usr/local/bin/carelink-entrypoint

WORKDIR /var/www/html

ENTRYPOINT ["carelink-entrypoint"]

FROM php-base AS development

ENV APP_ENV=local \
    APP_DEBUG=true

# `artisan serve` and `queue:work` both run on the CLI SAPI, where OPcache is
# off by default. See the file for why that matters so much on a bind mount.
COPY docker/opcache-dev.ini /usr/local/etc/php/conf.d/zz-opcache-dev.ini

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000", "--no-reload"]

FROM node:22-alpine AS frontend-build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY resources ./resources
COPY public ./public
COPY jsconfig.json vite.config.js ./

RUN npm run build

FROM composer:2 AS vendor-build

WORKDIR /app

COPY composer.json composer.lock ./

RUN composer install \
    --no-dev \
    --no-interaction \
    --no-progress \
    --no-scripts \
    --optimize-autoloader \
    --prefer-dist

FROM php-base AS production

ENV APP_ENV=production \
    APP_DEBUG=false

COPY --chown=www-data:www-data . .
COPY --from=vendor-build --chown=www-data:www-data /app/vendor ./vendor
COPY --from=frontend-build --chown=www-data:www-data /app/public/build ./public/build

RUN sed -ri -e 's!/var/www/html!/var/www/html/public!g' \
        /etc/apache2/sites-available/*.conf \
        /etc/apache2/apache2.conf \
        /etc/apache2/conf-available/*.conf \
    && mkdir -p \
        storage/app/private \
        storage/app/public \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/testing \
        storage/framework/views \
        storage/logs \
        bootstrap/cache \
    && rm -f bootstrap/cache/*.php \
    && composer dump-autoload --no-dev --classmap-authoritative --no-scripts \
    && php artisan package:discover --ansi \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R ug+rwX storage bootstrap/cache

EXPOSE 80

CMD ["apache2-foreground"]
