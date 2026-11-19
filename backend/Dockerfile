# ─── Stage 1: Dependency Installation ──────────────────────────────────────────
FROM node:20-alpine AS dependencies

WORKDIR /app

# Install package manifests
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# ─── Stage 2: Production Runner ───────────────────────────────────────────────
FROM node:20-alpine AS runner

# Install dumb-init for PID 1 signal forwarding (SIGTERM / SIGINT)
RUN apk add --no-cache dumb-init

WORKDIR /app

# Create application directories with proper ownership for unprivileged node user
RUN mkdir -p /app/data /app/storage /app/logs \
    && chown -R node:node /app

# Switch to non-root user
USER node

# Copy production node_modules from dependencies stage
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules

# Copy package definition and application source
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

# Set default production environment
ENV NODE_ENV=production \
    PORT=3001 \
    LOGICBRIDGE_STORAGE_PATH=/app/storage

EXPOSE 3001

# Use dumb-init as init process for reliable signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/index.js"]
