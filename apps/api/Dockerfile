# ==========================================
# STAGE 1: Build Stage
# ==========================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install dependencies needed for compiling native modules if required
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package*.json tsconfig.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy application source code
COPY src ./src

# Build TypeScript to Javascript (dist/)
RUN npm run build

# ==========================================
# STAGE 2: Production Runner
# ==========================================
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy package manifests
COPY package*.json ./

# Install production-only dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled files from the builder stage
COPY --from=builder /app/dist ./dist

# Create a non-root user for security
USER node

EXPOSE 5000

CMD ["node", "dist/server.js"]
