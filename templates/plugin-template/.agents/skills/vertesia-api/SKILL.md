---
name: vertesia-api
description: Reference for the Vertesia client API (@vertesia/client). Covers available APIs, common operations (objects, workflows, interactions, files), authentication helpers, and query patterns. Use when building tools or UI that call the Vertesia platform.
---

# Vertesia Client API

The `@vertesia/client` package provides a typed client for the Vertesia platform.

## Getting the Client

```typescript
// In tool server code (inside tool run())
const client = await context.getClient();

// In UI code (React component)
import { useUserSession } from "@vertesia/ui/session";
const { client, user, project } = useUserSession();
```

## Available APIs

### Studio APIs

| API | Description |
|-----|-------------|
| `client.projects` | Project management |
| `client.environments` | Environment configuration |
| `client.interactions` | Interaction execution and management |
| `client.prompts` | Prompt templates |
| `client.runs` | Run history and analytics |
| `client.account` | Current account operations |
| `client.analytics` | Analytics data |
| `client.apps` | Application management |
| `client.iam` | Identity and access management |
| `client.users` | User management |
| `client.apikeys` | API key management |
| `client.refs` | Reference management |
| `client.commands` | Command execution |

### Store APIs

Accessible via `client.store.*` or shortcuts:

| API | Shortcut | Description |
|-----|----------|-------------|
| `client.store.objects` | `client.objects` | Content object CRUD, search, upload |
| `client.store.files` | `client.files` | File operations |
| `client.store.types` | `client.types` | Content type definitions |
| `client.store.workflows` | `client.workflows` | Workflow management, conversations |
| `client.store.collections` | — | Collection management |
| `client.store.embeddings` | — | Embedding operations |
| `client.store.agents` | — | Agent operations |

## Object Operations

```typescript
// Retrieve by ID
const object = await client.objects.retrieve(objectId);

// List with pagination
const objects = await client.objects.list({ limit: 100, offset: 0 });

// Search by text
const results = await client.objects.search({ query: 'search terms' });

// Find with MongoDB-style queries
const objects = await client.objects.find({
    where: { status: 'active', type: 'article' },
    limit: 50,
});

// Count
const { count } = await client.objects.count({ where: { status: 'active' } });

// Upload content
await client.objects.upload(payload);

// Get download URL
const { url } = await client.objects.getDownloadUrl(fileUri);

// Analyze document
const analysis = await client.objects.analyze(objectId);
```

## Workflow / Conversation Operations

```typescript
// List conversations for an interaction
const { runs } = await client.store.workflows.listConversations({
    interaction: 'app:my-app:collection:interaction-name',
    page_size: 20,
});
// Returns: { runs: WorkflowRun[], next_page_token?, has_more? }
// WorkflowRun has: run_id, workflow_id, started_at, status, topic
// NOTE: listConversations does NOT return input field — use getRunDetails for that

// Get full run details (includes input, history)
const run = await client.store.workflows.getRunDetails(runId, workflowId);

// Search runs with filters
const results = await client.store.workflows.searchRuns({
    interaction: 'interaction-name',
    status: 'completed',
    page_size: 10,
});

// Send signal to active workflow
await client.store.workflows.sendSignal(workflowId, runId, 'signal-name', payload);
```

## Interaction Execution

```typescript
// Synchronous execution (wait for result)
const result = await client.interactions.execute({
    interaction: 'app:my-app:collection:interaction-name',
    data: { input: 'some data' },
});

// Asynchronous execution (start and get run IDs)
const result = await client.interactions.executeAsync({
    type: 'conversation',
    interaction: 'app:my-app:collection:interaction-name',
    interactive: true,
    data: { user_prompt: 'Hello' },
});
// result: { runId: string, workflowId: string }
```

### Interaction naming convention

Interactions registered by plugins follow this pattern:
```
app:<plugin-name>:<collection-name>:<interaction-name>
```

## Authentication Helpers

```typescript
// Get raw JWT token
const jwt = await client.getRawJWT();

// Get decoded JWT payload
const payload = await client.getDecodedJWT();

// Get current project from JWT
const project = await client.getProject();

// Get current account from JWT
const account = await client.getAccount();
```

## Client Initialization (standalone)

When creating the client directly (outside Vertesia host):

```typescript
import { VertesiaClient } from "@vertesia/client";

const client = new VertesiaClient({
    site: 'api.vertesia.io',  // or 'api-preview.vertesia.io'
    apikey: 'your-api-key',
    sessionTags: ['your-session-tag'],
});

// Or from an auth token:
const client = await VertesiaClient.fromAuthToken(jwtToken);
```

## Query Patterns

Use MongoDB-style query operators in `find()` and `count()`:

```typescript
// Equality
{ where: { status: 'active' } }

// Comparison
{ where: { score: { $gt: 80, $lte: 100 } } }

// Logical
{ where: { $and: [{ status: 'active' }, { type: 'article' }] } }
{ where: { $or: [{ status: 'draft' }, { status: 'review' }] } }

// In set
{ where: { category: { $in: ['news', 'blog'] } } }
```

**Security:** Never pass user input directly as query operators. Validate and whitelist allowed operators to prevent injection.

## Security

### Input Validation

Always validate user inputs before passing to API calls:

```typescript
// Validate ID format before querying
if (typeof objectId !== 'string' || !objectId.match(/^[0-9a-f]{24}$/)) {
    throw new Error('Invalid object ID');
}
const object = await client.objects.retrieve(objectId);
```

### Query Injection Prevention

Never construct queries from raw user input:

```typescript
// ❌ BAD — user could inject operators like $where, $regex
const filter = JSON.parse(userInput);
await client.objects.find({ where: filter });

// ✅ GOOD — whitelist allowed fields and values
await client.objects.find({
    where: { status: { $eq: validatedStatus }, type: { $eq: validatedType } }
});
```

### Authorization

Check authentication state before accessing protected resources:

```typescript
const { client, user } = useUserSession();

// Verify user has access before performing actions
if (!user) {
    throw new Error('Not authenticated');
}
```

In tool server code, the SDK handles JWT validation automatically. Access the authenticated client:

```typescript
async run(payload, context) {
    const client = await context.getClient();
    // client is pre-authenticated — org/project scoped from the JWT
}
```

### Error Handling

Never expose internal API details to users:

```typescript
try {
    await client.objects.delete(objectId);
} catch (error) {
    console.error('Delete failed:', error);  // Log full error server-side
    throw new Error('Unable to delete item');  // Generic user-facing message
}
```

### Sensitive Data

- Never log JWT tokens, API keys, or user credentials
- Use `VERTESIA_ALLOWED_ORGS` to restrict tool server access to specific organizations
- Store secrets in environment variables, never in code
