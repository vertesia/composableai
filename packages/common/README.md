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

## API Reference

For detailed API documentation, visit [docs.vertesiahq.com](https://docs.vertesiahq.com).

## License

Apache-2.0
