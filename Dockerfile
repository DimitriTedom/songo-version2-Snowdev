FROM php:8.2-apache

# Copy the project files to the Apache document root
COPY . /var/www/html/

# Ensure the games directory exists and is writable by the web server
RUN mkdir -p /var/www/html/games && chown -R www-data:www-data /var/www/html/games

# Enable Apache mod_rewrite for better URL handling (optional but recommended)
RUN a2enmod rewrite

# Render expects the app to listen on a port, which Apache does on 80 by default
EXPOSE 80