# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy certs and seed data (to /app/seed so volume doesn't hide it)
COPY certs ./certs
COPY data/files ./seed/files

# Copy entrypoint script and fix Windows line endings
COPY entrypoint.sh ./entrypoint.sh
RUN sed -i 's/\r$//' ./entrypoint.sh && chmod +x ./entrypoint.sh

# Set environment variables (non-sensitive defaults)
ENV NODE_ENV=production
ENV PORT=4004
ENV CERT_DIR=/app/certs
ENV FILE_STORAGE_PATH=/app/data/files
ENV API_KEY_LOCATION=/app/data/config

# Expose the port
EXPOSE 4004

# Run the application via entrypoint
ENTRYPOINT ["./entrypoint.sh"]
