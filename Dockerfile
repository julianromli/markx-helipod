# syntax=docker/dockerfile:1

# --- Build stage: install all deps and build the app -------------------------
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# --- Prod deps stage: production node_modules only ---------------------------
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# --- Runtime stage -----------------------------------------------------------
FROM oven/bun:1-slim
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Asset store (image uploads + OG mirrors). Point this at a persistent volume.
ENV MARKX_ASSETS_DIR=/app/data/assets

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

RUN mkdir -p /app/data/assets

EXPOSE 3000

CMD ["bun", "run", "start"]
