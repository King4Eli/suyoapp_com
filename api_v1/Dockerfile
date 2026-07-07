FROM node:20-alpine

WORKDIR /app

# Copy only dependency manifests first (cache-friendly)
COPY package*.json ./

# Install production dependencies INSIDE the container
RUN npm ci --only=production

# Copy application source (node_modules NOT included)
COPY . .

EXPOSE 80
CMD ["npm","run","http-prod"]
