# Stage 1: Build Rust server
FROM rust:1-alpine AS rust-builder

RUN apk add --no-cache musl-dev

WORKDIR /app
COPY packages/server-rs/Cargo.toml packages/server-rs/Cargo.lock* ./
# Create dummy src to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release 2>/dev/null || true
# Now copy real source and build
COPY packages/server-rs/src/ src/
RUN touch src/main.rs && cargo build --release

# Stage 2: Build client static files
FROM node:22-alpine AS client-builder

RUN apk add --no-cache git

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/client/package.json packages/client/

RUN npm ci

COPY .git/ .git/
COPY packages/shared/ packages/shared/
COPY packages/client/ packages/client/
COPY assets/ assets/

# Compute version from git
RUN echo "0.$(git rev-list --count HEAD).0" > /tmp/app_version

# Build client
RUN cd packages/client && npx vite build --outDir dist

# Stage 3: Minimal runtime
FROM alpine:3.21

RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --from=rust-builder /app/target/release/trenchwars-server .
COPY --from=client-builder /app/packages/client/dist ./public
COPY --from=client-builder /app/assets ./assets
COPY --from=client-builder /tmp/app_version /tmp/app_version

ENV PORT=8080
ENV STATIC_DIR=/app/public

EXPOSE 8080
EXPOSE 4433/udp

CMD ["sh", "-c", "APP_VERSION=$(cat /tmp/app_version) ./trenchwars-server"]
