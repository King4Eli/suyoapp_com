FROM php:8.3-apache

WORKDIR /var/www/html
RUN docker-php-ext-install pdo pdo_mysql

RUN curl -L https://dl.min.io/client/mc/release/linux-amd64/mc \
    -o /usr/local/bin/mc \
 && chmod +x /usr/local/bin/mc
RUN mkdir -p /var/www/.mc && chown -R www-data:www-data /var/www/.mc

COPY . .

EXPOSE 80
