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

### Error Classes

| Class | Description |
|-------|-------------|
| `RequestError` | Base class for all request errors |
| `ServerError` | HTTP error responses (4xx, 5xx) |
| `ConnectionError` | Network/connection failures |

## License

MIT
