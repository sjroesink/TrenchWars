# Stage 1: Build client static files
FROM node:22-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/client/package.json packages/client/
COPY packages/server/package.json packages/server/

RUN npm ci

COPY .git/ .git/
COPY packages/shared/ packages/shared/
COPY packages/client/ packages/client/
COPY packages/server/ packages/server/
COPY assets/ assets/

# Compute version from git
RUN echo "0.$(git rev-list --count HEAD).0" > /tmp/app_version

# Build client → packages/client/dist (must run from client root where index.html lives)
RUN cd packages/client && npx vite build --outDir dist

# Stage 2: Production image
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

RUN npm ci

# Install tsx globally for running TypeScript
RUN npm install -g tsx

# Shared source (consumed via workspace)
COPY packages/shared/ packages/shared/
# Server source
COPY packages/server/ packages/server/
# Built client static files
COPY --from=builder /app/packages/client/dist /app/public
# Assets (maps)
COPY --from=builder /app/assets /app/assets

COPY --from=builder /tmp/app_version /tmp/app_version

ENV NODE_ENV=production
ENV PORT=8080
ENV STATIC_DIR=/app/public

EXPOSE 8080

CMD sh -c "APP_VERSION=$(cat /tmp/app_version) exec tsx packages/server/src/main.ts"
