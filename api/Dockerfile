FROM node:20-alpine

WORKDIR /app

# Production mode: disables IAP pseudo-verification (global/iapVerify.js) and
# hides internal details on /s. The dev compose override sets development.
ENV NODE_ENV=production

# Copy only dependency manifests first (cache-friendly)
COPY package*.json ./

# Install production dependencies INSIDE the container
RUN npm ci --omit=dev

# Copy application source (node_modules NOT included)
COPY . .

# Commit sha of this build (CI passes --build-arg BUILD_HASH=<sha>); read by
# global/buildInfo.js and stamped on every log row. Declared late so a new sha
# doesn't bust the npm ci layer cache.
ARG BUILD_HASH=dev
ENV BUILD_HASH=$BUILD_HASH

EXPOSE 80
CMD ["node","index.js"]
