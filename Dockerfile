# Step 1: Base image
FROM node:20-alpine AS base

# Install libc6-compat & openssl for Prisma compatibility on alpine
RUN apk add --no-cache libc6-compat openssl
ENV PRISMA_CLI_BINARY_TARGETS="linux-musl-openssl-3.0.x"
WORKDIR /app

# Step 2: Dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

# Step 3: Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client & Build Next.js app in Standalone mode
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production
ARG BUILD_TIME=1
RUN npx prisma generate
RUN npm run build
RUN cp -r node_modules/.prisma .next/standalone/node_modules/.prisma

# Step 4: Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set correct permissions for Next.js static files and uploads
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
