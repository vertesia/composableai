FROM node:23.11-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM base
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates

COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/lib /app/lib
COPY --from=build /app/bin /app/bin

COPY --from=datadog/serverless-init:1 /datadog-init /app/datadog-init

ENV SERVICE_NAME={{SERVICE_NAME}}

ENTRYPOINT ["/app/datadog-init"]
CMD [ "pnpm", "start" ]
