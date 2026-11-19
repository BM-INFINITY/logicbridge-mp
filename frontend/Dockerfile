# ─── Stage 1: Build Frontend Assets ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies using package lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and configuration
COPY . .

# Optional build argument for API URL; defaults to relative /api proxy
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Compile production bundle to /app/dist
RUN npm run build

# ─── Stage 2: Production Nginx Runner (Unprivileged) ─────────────────────────
FROM nginxinc/nginx-unprivileged:alpine AS runner

# Replace default Nginx configuration with custom SPA reverse-proxy config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
