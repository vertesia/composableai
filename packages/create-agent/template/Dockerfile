FROM node:23.5-slim AS base
WORKDIR /app


FROM base AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY . /app

# Authenticate with Google Artifact Registry
RUN --mount=type=secret,id=gcp,target=/tmp/credentials.json \
    export GOOGLE_APPLICATION_CREDENTIALS=/tmp/credentials.json && \
    pnpm add -g google-artifactregistry-auth && \
    pnpm run registry-login && \
    pnpm install --frozen-lockfile && \
    pnpm run -r build


FROM base AS app
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates

COPY --from=datadog/serverless-init:1 /datadog-init /app/datadog-init
COPY --from=build /app /app

ENV SERVICE_NAME=github-agent

ENTRYPOINT ["/app/datadog-init"]
CMD ["node", "/app/apps/github-agent/lib/main.js"]
