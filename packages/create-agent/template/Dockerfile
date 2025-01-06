FROM node:23.5-bookworm-slim

WORKDIR /app

RUN apt-get update -y && \
    apt-get install -y curl

COPY --from=datadog/serverless-init:1 /datadog-init /app/datadog-init
COPY . .

ENTRYPOINT ["/app/datadog-init"]
CMD ["node", "/app/lib/main.js"]
