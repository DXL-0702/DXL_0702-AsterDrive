# Stage 1: Build frontend
FROM node:24-alpine AS frontend

RUN npm install -g bun@latest

WORKDIR /build/frontend-panel
COPY frontend-panel/package.json frontend-panel/bun.lock* ./
RUN bun install --frozen-lockfile

COPY frontend-panel/ ./
RUN bun run build

# Stage 2: Build Rust binary (static musl)
FROM rust:1-slim AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends musl-tools musl-dev && \
    rm -rf /var/lib/apt/lists/* && \
    rustup target add x86_64-unknown-linux-musl

WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY migration/ migration/

# Pre-build dependencies (cache layer)
RUN mkdir src && echo 'fn main() {}' > src/main.rs && \
    cargo build --release --target x86_64-unknown-linux-musl 2>/dev/null || true && \
    rm -rf src

COPY src/ src/
COPY build.rs ./
COPY --from=frontend /build/frontend-panel/dist/ frontend-panel/dist/

ARG CARGO_FEATURES="server"
ENV RUSTFLAGS="-C target-feature=+crt-static -C link-arg=-s"

RUN cargo build --release --target x86_64-unknown-linux-musl --features "${CARGO_FEATURES}"

# Stage 3: scratch
FROM scratch

LABEL maintainer="AptS:1547 <apts-1547@esaps.net>"
LABEL org.opencontainers.image.title="AsterDrive"
LABEL org.opencontainers.image.description="Self-hosted cloud storage system built with Rust"
LABEL org.opencontainers.image.source="https://github.com/AptS-1547/AsterDrive"
LABEL org.opencontainers.image.license="MIT"

COPY --from=builder /build/target/x86_64-unknown-linux-musl/release/aster_drive /aster_drive

VOLUME ["/data"]
EXPOSE 3000

ENV ASTER__SERVER__HOST=0.0.0.0

ENTRYPOINT ["/aster_drive"]
