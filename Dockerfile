# syntax=docker/dockerfile:1.7
# Production image for the complete pnpm workspace. It contains PostgreSQL tools
# because the same immutable image runs the verified backup and restore jobs.
FROM node:22.20.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends ca-certificates curl postgresql-client tini && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/i18n/package.json packages/i18n/package.json
COPY packages/integrations/package.json packages/integrations/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
COPY . .
RUN pnpm --filter web build

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app /app
RUN groupadd --system empleado24 && useradd --system --gid empleado24 --home /app empleado24 && mkdir -p /var/lib/empleado24/backups && chown -R empleado24:empleado24 /app /var/lib/empleado24
USER empleado24
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
# Use Next directly at runtime. This keeps the read-only production container
# from invoking Corepack (which otherwise attempts to create a cache directory).
CMD ["/bin/sh", "-c", "cd /app/apps/web && node node_modules/next/dist/bin/next start"]
