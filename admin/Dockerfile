FROM php:8.3-apache

WORKDIR /var/www/html
RUN docker-php-ext-install pdo pdo_mysql
# Production PHP settings: errors are logged, never shown to the browser, and
# the PHP version isn't advertised in headers.
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
    && echo "expose_php = Off" > "$PHP_INI_DIR/conf.d/zz-hardening.ini"

COPY . .

EXPOSE 80
