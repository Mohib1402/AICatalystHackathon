FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Copy Google credentials if exists
COPY google-credentials.json* ./

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Set dummy env vars for build (real values from Secret Manager at runtime)
ENV GOOGLE_GENERATIVE_AI_API_KEY=build-time-placeholder
ENV GOOGLE_CLOUD_PROJECT_ID=build-time-placeholder
ENV DD_API_KEY=build-time-placeholder
ENV DD_APP_KEY=build-time-placeholder
ENV ADMIN_PASSWORD=build-time-placeholder
ENV JWT_SECRET=build-time-placeholder

# Build Next.js app
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Google credentials if exists
COPY --from=builder --chown=nextjs:nodejs /app/google-credentials.json* ./

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
