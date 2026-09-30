# syntax=docker/dockerfile:1

# ---- build stage -----------------------------------------------------------
# Built with the full dependency tree. Do not rely on `npm ci --omit=dev` here:
# the build needs vite, which only reaches a production install transitively
# through @remix-run/dev.
FROM node:22-alpine AS build

WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

# ---- runtime stage ---------------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /app
# openssl is required by Prisma's query engine at runtime.
RUN apk add --no-cache openssl

ENV NODE_ENV=production
EXPOSE 3000

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY prisma ./prisma
COPY --from=build /app/build ./build
COPY --from=build /app/public ./public

# `setup` runs `prisma generate && prisma migrate deploy` on boot, so the
# container needs DATABASE_URL pointing at the PostgreSQL instance.
CMD ["npm", "run", "docker-start"]
