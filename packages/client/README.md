# @vertesia/client

Official TypeScript/JavaScript client for the Vertesia API. Works in both Node.js and browser environments.

## Installation

```bash
npm install @vertesia/client
# or
pnpm add @vertesia/client
```

## Usage

### Basic Setup

```typescript
import { VertesiaClient } from "@vertesia/client";

// Using an API key
const client = new VertesiaClient({
  site: "api.vertesia.io",
    // API key for authentication
  apikey: "sk-your-api-key",
});
```

### Configuration Options

```typescript
const client = new VertesiaClient({
  // The Vertesia site to connect to
  site: "api.vertesia.io", // or "api-preview.vertesia.io", "api.us1.vertesia.io", "api-preview.eu1.vertesia.io"

  // Or use custom URLs
  serverUrl: "https://custom-api.example.com",
  storeUrl: "https://custom-store.example.com",

  // API key for authentication
  apikey: "sk-your-api-key",

  // Optional session tags
  sessionTags: ["tag1", "tag2"],

  // Optional default per-request HTTP timeout in milliseconds. Applies to every request
  // made by the client (studio API + content store). Omit for no timeout; pass `false`
  // or `0` to explicitly disable it. See "Request Timeouts" below.
  timeout: 60_000,
});
```

### Request Timeouts

By default the client applies no HTTP request timeout. Set a default for every request via the
`timeout` constructor option (or `client.withTimeout(ms)` at runtime); it propagates to both the
studio API and the content store, and to all of their sub-topics. The timeout is implemented with
a browser-standard `AbortSignal`, so it behaves the same in the browser and in Node:

```typescript
// A 60s default for every request on this client.
const client = new VertesiaClient({ apikey: "sk-***", timeout: 60_000 });

// Change (or disable) it later.
client.withTimeout(30_000);
client.withTimeout(false); // no timeout
```

**Interaction execution is exempt from a short default.** A synchronous (non-streaming) interaction
execution blocks on the server until the model finishes — and the LLM (e.g. image generation) can
legitimately take minutes — so `client.interactions.execute(...)` / `executeByName(...)` use their
own long per-request timeout (30 minutes by default, overridable via the
`VERTESIA_INTERACTION_TIMEOUT_MS` env var), which overrides any shorter client default. Streaming
executions return immediately and stream over a separate channel, so they are never given a
total-request timeout.

### Available APIs

The client provides access to several API endpoints:

```typescript
// Projects
const projects = await client.projects.list();

// Interactions
const interaction = await client.interactions.retrieve("interaction-id");

// Prompts
const prompts = await client.prompts.list();

// Runs
const runs = await client.runs.list();

// Store (Objects, Files, Types, Workflows)
const objects = await client.objects.list();
const files = await client.files.list();
const types = await client.types.list();
const workflows = await client.workflows.list();

// And more: accounts, apikeys, analytics, training, users, iam, refs, commands, apps
```

### Uploading Files

In browser environments, you can upload files directly using the `File` object:

```typescript
const file = new File([content], "document.pdf", { type: "application/pdf" });
const fileId = await client.files.uploadFile(file);
```

In Node.js, use `NodeStreamSource` from the `/node` subpath to upload from streams:

```typescript
import { NodeStreamSource } from "@vertesia/client/node";
import { createReadStream } from "fs";

// Upload a file from disk
const stream = createReadStream("/path/to/file.pdf");
const source = new NodeStreamSource(stream, "document.pdf", "application/pdf");
const fileId = await client.files.uploadFile(source);
```

You can also use `StreamSource` directly with web `ReadableStream`:

```typescript
import { StreamSource } from "@vertesia/client";

const webStream = /* your ReadableStream */;
const source = new StreamSource(webStream, "filename.txt", "text/plain");
const fileId = await client.files.uploadFile(source);
```

## API Reference

For detailed API documentation, visit [docs.vertesiahq.com](https://docs.vertesiahq.com).

## License

Apache-2.0
