# @vertesia/api-fetch-client

A lightweight HTTP client that wraps the Fetch API and simplifies building REST API clients. Works in both browser and Node.js environments.

## Features

- Fluent API for building HTTP clients
- Works in browser and Node.js
- Server-Sent Events (SSE) support out of the box
- Customizable authentication via callbacks
- Request/response interceptors
- Custom error handling
- TypeScript support with full type definitions

## Installation

```bash
npm install @vertesia/api-fetch-client
# or
pnpm add @vertesia/api-fetch-client
```

## Basic Usage

```typescript
import { FetchClient } from '@vertesia/api-fetch-client';

const client = new FetchClient('https://api.example.com/v1');

// GET request
const data = await client.get('/users');

// POST request with payload
const newUser = await client.post('/users', {
  payload: { name: 'John', email: 'john@example.com' }
});

// PUT request
await client.put('/users/123', {
  payload: { name: 'John Updated' }
});

// DELETE request
await client.delete('/users/123');
```

## Authentication

Use the `withAuthCallback` method to set up dynamic authentication:

```typescript
const client = new FetchClient('https://api.example.com')
  .withAuthCallback(async () => {
    const token = await getAccessToken();
    return `Bearer ${token}`;
  });
```

Or set headers directly:

```typescript
const client = new FetchClient('https://api.example.com')
  .withHeaders({
    'Authorization': 'Bearer my-token'
  });
```

## Query Parameters

Pass query parameters using the `query` option:

```typescript
const results = await client.get('/search', {
  query: { q: 'search term', page: 1, limit: 10 }
});
// Request: GET /search?q=search%20term&page=1&limit=10
```

## Custom Headers

Add headers per-request or globally:

```typescript
// Global headers
const client = new FetchClient('https://api.example.com')
  .withHeaders({ 'X-Custom-Header': 'value' });

// Per-request headers
await client.get('/endpoint', {
  headers: { 'X-Request-Id': '12345' }
});
```

## Server-Sent Events (SSE)

Stream server-sent events using the built-in SSE reader:

```typescript
const stream = await client.get('/events', { reader: 'sse' });

for await (const event of stream) {
  if (event.type === 'event') {
    console.log('Event:', event.event, event.data);
  }
}
```

## Custom Response Readers

Provide a custom reader function for non-JSON responses:

```typescript
// Read as text
const text = await client.get('/file.txt', {
  reader: (response) => response.text()
});

// Read as blob
const blob = await client.get('/image.png', {
  reader: (response) => response.blob()
});
```

## Error Handling

The client throws typed errors for different failure scenarios:

```typescript
import { RequestError, ServerError, ConnectionError } from '@vertesia/api-fetch-client';

try {
  await client.get('/protected');
} catch (error) {
  if (error instanceof ServerError) {
    console.log('Server error:', error.status, error.message);
    console.log('Response payload:', error.payload);
  } else if (error instanceof ConnectionError) {
    console.log('Connection failed:', error.message);
  }
}
```

## Retries

Retries are disabled by default. Enable them explicitly on a client or a single request:

```typescript
const client = new FetchClient('https://api.example.com')
  .withRetryPolicy({
    attempts: 3,
    methods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'],
    statuses: [502, 503, 504],
    baseDelayMs: 250,
    maxDelayMs: 4000
  });

// POST requests are not retried by the default method list. Opt in only when
// the operation is safe to replay.
await client.post('/workflow/execute', {
  payload,
  retryPolicy: { methods: ['POST'] }
});

// Disable a client-level retry policy for one request.
await client.get('/no-retry', { retryPolicy: false });
```

## Timeouts

No request timeout is applied by default. Set a default on the client (applies to every request) and/or override it per request. The timeout aborts the **whole** request — connection, response headers, **and** body consumption (JSON parse) — using a browser-standard `AbortSignal`, so it behaves the same in the browser and in Node (no `undici`-specific configuration).

```typescript
// Default timeout (ms) for every request on this client.
const client = new FetchClient('https://api.example.com').withTimeout(60_000);

// Override for a single slow request (e.g. one that blocks on an LLM).
await client.post('/long-running', { payload, timeoutMs: 30 * 60_000 });

// Disable the client default for one request.
await client.get('/no-timeout', { timeoutMs: false });

// Combine with a caller-supplied AbortSignal — whichever aborts first wins.
await client.get('/data', { signal: controller.signal, timeoutMs: 5_000 });
```

- `timeoutMs`: a positive number sets the timeout; `false`/`null`/`0` disables it for that request (overriding the client default); omitted falls back to the client default (`withTimeout` / `defaultTimeoutMs`).
- On timeout the request rejects as a connection failure. When a retry policy is enabled, a timed-out attempt is retried like any other connection error, with a **fresh deadline per attempt**.
- SSE requests (`reader: 'sse'`) are never given a total-request timeout — they are long-lived by design; apply your own idle/close handling to the stream.
- `ApiTopic` sub-clients inherit the parent client's default timeout, so setting it once on the root client covers all topics.

### Custom Error Factory

Transform errors before they're thrown:

```typescript
const client = new FetchClient('https://api.example.com')
  .withErrorFactory((err) => {
    if (err.status === 401) {
      return new UnauthorizedError('Please log in');
    }
    return err;
  });
```

## Request/Response Interceptors

Hook into requests and responses for logging or modification:

```typescript
const client = new FetchClient('https://api.example.com');

client.onRequest = (request) => {
  console.log('Sending:', request.method, request.url);
};

client.onResponse = (response, request) => {
  console.log('Received:', response.status, 'for', request.url);
};
```

## Building API Clients with ApiTopic

Create organized API clients by extending `ApiTopic`:

```typescript
import { AbstractFetchClient, ApiTopic } from '@vertesia/api-fetch-client';

class UsersApi extends ApiTopic {
  list() {
    return this.get('/');
  }

  getById(id: string) {
    return this.get(`/${id}`);
  }

  create(data: CreateUserInput) {
    return this.post('/', { payload: data });
  }
}

class MyApiClient extends AbstractFetchClient<MyApiClient> {
  readonly users: UsersApi;

  constructor(baseUrl: string) {
    super(baseUrl);
    this.users = new UsersApi(this, '/users');
  }
}

// Usage
const api = new MyApiClient('https://api.example.com');
const users = await api.users.list();
const user = await api.users.getById('123');
```

## Non-JSON Payloads

Disable automatic JSON serialization for form data or other formats:

```typescript
const formData = new FormData();
formData.append('file', fileBlob);

await client.post('/upload', {
  payload: formData,
  jsonPayload: false
});
```

## Access Last Response

Inspect the last response for headers or status:

```typescript
await client.get('/endpoint');
console.log('Status:', client.response?.status);
console.log('Headers:', client.response?.headers.get('X-Custom-Header'));
```

## API Reference

### FetchClient

The main client class for making HTTP requests.

| Method | Description |
|--------|-------------|
| `get(path, params?)` | Make a GET request |
| `post(path, params?)` | Make a POST request |
| `put(path, params?)` | Make a PUT request |
| `delete(path, params?)` | Make a DELETE request |
| `withAuthCallback(cb)` | Set authentication callback |
| `withHeaders(headers)` | Add default headers |
| `withLang(locale)` | Set Accept-Language header |
| `withErrorFactory(factory)` | Set custom error factory |

### Request Parameters

| Option | Type | Description |
|--------|------|-------------|
| `query` | `Record<string, primitive>` | Query string parameters |
| `headers` | `Record<string, string>` | Request headers |
| `payload` | `object \| BodyInit` | Request body |
| `reader` | `'sse' \| function` | Custom response reader |
| `jsonPayload` | `boolean` | Auto-serialize payload as JSON (default: true) |
| `retryPolicy` | `IRequestRetryPolicy \| false` | Per-request retry policy; `false` disables the client default |
| `timeoutMs` | `number \| false \| null` | Per-request timeout (ms). Positive sets it; `false`/`null`/`0` disables; omitted uses the client default |
| `signal` | `AbortSignal` | Caller abort signal, merged with the timeout signal |

### Error Classes

| Class | Description |
|-------|-------------|
| `RequestError` | Base class for all request errors |
| `ServerError` | HTTP error responses (4xx, 5xx) |
| `ConnectionError` | Network/connection failures |

## License

Apache-2.0
