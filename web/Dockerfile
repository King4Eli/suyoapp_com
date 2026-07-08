FROM node:20-slim AS build

WORKDIR /var/www/html

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /var/www/html/dist /var/www/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
