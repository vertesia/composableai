# {{SERVICE_NAME}}

{{PROJECT_DESCRIPTION}}

## Overview

This is a Vertesia custom worker built on Temporal workflows. It provides a starting point for building workflow-based automation that integrates with the Vertesia platform.

## Architecture

### Core Components

- **Workflows** (`src/workflows.ts`): Workflow definitions that orchestrate activities
  - `exampleWorkflow`: Processes content objects with support for dry-run mode
  - `inspectObjectsWorkflow`: Retrieves metadata from content objects without modifications
- **Activities** (`src/activities.ts`): Core processing activities that perform actual work
  - `processObjectActivity`: Retrieves and processes a content object
  - `getObjectMetadataActivity`: Fetches object metadata for inspection
- **Types**: Activity parameters and results are defined with proper TypeScript interfaces
- **Main Entry** (`src/main.ts`): Worker runner that loads workflow bundle and activities
- **Debug Replayer** (`src/debug-replayer.ts`): Temporal debug tooling for workflow replay and testing
- **Test Utils** (`src/test/utils.ts`): Shared testing utilities and helpers

### Processing Flow

1. Workflow receives a payload with `objectIds` to process
2. Each object is processed through activities
3. Activities use the Vertesia client to interact with the platform
4. Results are aggregated and returned

## Development

### Prerequisites

- Node.js 22+
- pnpm package manager
- Vertesia CLI (`@vertesia/cli`)

### Setup

Connect to your Vertesia project (this sets up npm registry authentication):

```bash
vertesia worker connect
```

Install dependencies:

```bash
pnpm install
```

### Build

```bash
pnpm run build
```

### Testing

Uses Vitest with Temporal testing utilities. Test files use `.test.ts` extension.

```bash
pnpm test
```

Run tests in watch mode:

```bash
pnpm test -- --watch
```

## Configuration

### Package Configuration

Worker configuration is defined in `package.json` under the `vertesia` section:

```json
{
  "vertesia": {
    "image": {
      "repository": "us-docker.pkg.dev/dengenlabs/us.gcr.io",
      "organization": "{{WORKER_ORG}}",
      "name": "{{WORKER_NAME}}"
    }
  }
}
```

## Run with a Local Temporal Server

Running with a local Temporal server is useful for integration testing before deployment.

### 1. Install the Temporal CLI

```bash
# macOS
brew install temporal

# Other platforms: https://docs.temporal.io/cli
```

### 2. Start the Dev Server

```bash
temporal server start-dev
```

### 3. Start the Worker

In another terminal:

```bash
pnpm run start
```

### 4. Start a Workflow

Using the Temporal CLI:

```bash
temporal workflow start --name exampleWorkflow -t {{SERVICE_NAME}} --input-file input.json
```

Where `input.json` contains the workflow parameters:

```json
{
  "objectIds": ["object-id-1", "object-id-2"],
  "event": "workflow_execution_request",
  "auth_token": "your-auth-token",
  "account_id": "your-account-id",
  "project_id": "your-project-id",
  "config": {
    "store_url": "https://zeno-server.api.vertesia.io",
    "studio_url": "https://studio-server.api.vertesia.io"
  },
  "vars": {
    "dryRun": true
  }
}
```

## Deployment

### Build Docker Image

```bash
vertesia worker build
```

### Create a Release

```bash
vertesia worker release X.Y.Z
```

### Publish and Deploy

```bash
vertesia worker publish X.Y.Z
```

**Note:** Deployments are per environment based on your current CLI profile.

## Running in Production

Once deployed, the workflow can be started using the API, CLI, SDK, or Workflow rules.

### Using the SDK

```javascript
const run = await client.workflows.execute("exampleWorkflow", {
  task_queue: "workers/{{WORKER_ORG}}/{{WORKER_NAME}}",
  objectIds: ["object-id-1"],
  vars: {
    dryRun: false,
  },
});
```

### Using the CLI

```bash
vertesia workflows execute exampleWorkflow \
  -o <OBJECT_ID> \
  --queue "workers/{{WORKER_ORG}}/{{WORKER_NAME}}" \
  -f workflow_vars.json
```

### Using curl

```bash
curl --location 'https://api.vertesia.io/api/v1/workflows/execute/exampleWorkflow' \
  --header 'Authorization: Bearer <YOUR_JWT_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "vars": { "dryRun": false },
    "task_queue": "workers/{{WORKER_ORG}}/{{WORKER_NAME}}",
    "objectIds": ["object-id-1"]
  }'
```

## Workflow Variables

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dryRun` | boolean | `false` | If true, simulates processing without making changes |

## Dependencies

Built with:

- **Temporal**: Workflow orchestration
- **Vertesia SDK**: Platform integration (`@vertesia/client`, `@vertesia/workflow`)
- **TypeScript**: Type-safe development
- **Vitest**: Testing framework
