# @vertesia/common

Shared TypeScript types and utilities for the Vertesia platform. This package contains common type definitions, interfaces, and helper functions used across Vertesia client and server.

## Installation

```bash
npm install @vertesia/common
# or
pnpm add @vertesia/common
```

## Contents

This package exports types and utilities for:

- **Access Control** - Permission and role definitions
- **Analytics** - Analytics event types
- **API Keys** - API key types and validation
- **Apps** - Application configuration types
- **Environments** - Environment configuration
- **Groups** - User group types
- **Integrations** - Third-party integration types
- **Interactions** - Interaction definitions and execution types
- **JSON Schema** - JSON Schema utilities and types
- **Projects** - Project configuration types
- **Prompts** - Prompt template types
- **Queries** - Query builder types
- **Runs** - Execution run types
- **Skills** - Skill definition types
- **Store** - Object store types (documents, files, workflows)
- **Users** - User and tenant types
- **Authentication** - Token types and auth utilities

## Usage

```typescript
import {
  Interaction,
  Project,
  ContentObject,
  Workflow,
  // ... and many more
} from "@vertesia/common";
```

## Schema ownership

Public host request/response schemas live in `src/api-schemas`. The registry supplies OpenAPI and
runtime JSON Schema validation. Run `pnpm --filter @vertesia/common gen:schemas` after schema changes;
public aliases use `wire-types.generated.ts`, whose parity tests compare them with the Zod schemas.

Shared conversation records are owned by `@llumiverse/conversation`: documents, turns, content blocks,
assets, tools, generations and receipts. Their authoritative Zod schemas and inferred TypeScript types
live in `llumiverse/conversation`. Import schema values from `@llumiverse/conversation/schemas` into
host envelopes; do not duplicate their fields or interfaces here. The existing compositions in
`src/api-schemas/canonical-conversation.ts` and `canonical-interaction-execution.ts` show this boundary.
Host-specific IDs, access policy and execution envelopes remain common API contracts.

Use type-only imports for ordinary consumers. Browser code uses the existing standalone validators
and runtime entry points, including `@vertesia/common/canonical-stream-runtime`, rather than loading
`@vertesia/common/api-schemas`. Persisted conversation input also requires the conversation package's
bounded document parser and semantic checks; a leaf schema alone cannot validate references between
records. Native provider formats are interpreted by driver adapters.

## API Reference

For detailed API documentation, visit [docs.vertesiahq.com](https://docs.vertesiahq.com).

## License

Apache-2.0
