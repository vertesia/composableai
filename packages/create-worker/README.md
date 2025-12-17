# @vertesia/create-worker

This package scaffolds a Vertesia custom Temporal worker project.
Custom workers allow you to deploy your own Temporal workflows and activities to the Vertesia cloud platform.

Visit https://vertesiahq.com for more information about Vertesia.

## Requirements

1. Docker (with buildx support) installed locally.
2. Vertesia CLI application. The CLI will be automatically installed when initializing the worker project if you didn't install it previously.

## Initialize a Vertesia worker project

Run the following command:

```bash
npm init @vertesia/worker
```

Follow the instructions on screen. You need to define an organization and a name for your worker. The organization must be unique inside Vertesia and is usually the name of your Vertesia organization account. The worker name identifies the project within your organization.

The generated project is a TypeScript project using [Temporal](https://temporal.io/) as the workflow system.

## Project Structure

The generated project includes:

```
├── src/
│   ├── activities.ts      # Activity implementations (API calls, I/O operations)
│   ├── workflows.ts       # Workflow definitions (orchestration logic)
│   ├── main.ts            # Worker entry point
│   ├── debug-replayer.ts  # Debugging tool for workflow replay
│   ├── activities.test.ts # Unit tests for activities
│   └── test/
│       └── utils.ts       # Test utilities
├── bin/
│   └── bundle-workflows.mjs # Workflow bundler script
├── vitest.config.ts       # Test configuration
├── tsconfig.json          # TypeScript configuration
├── tsconfig.test.json     # TypeScript configuration for tests
├── Dockerfile             # Container build configuration
└── package.json           # Project configuration
```

## Development

### Building

```bash
pnpm install
pnpm run build
```

The build process:

1. Compiles TypeScript to JavaScript
2. Bundles workflows into a single file (required by Temporal)

### Testing

The project uses Vitest with Temporal's `MockActivityEnvironment` for testing activities.

```bash
pnpm test
```

Tests are located in `*.test.ts` files alongside the source code.

### Developing workflows and activities

**Activities** (`src/activities.ts`):

- Activities are functions that perform I/O operations (API calls, file access, etc.)
- They run outside the Temporal workflow sandbox
- Use `getVertesiaClient(payload)` to get an authenticated Vertesia client
- Activities can be retried automatically on failure

**Workflows** (`src/workflows.ts`):

- Workflows orchestrate activities and define the business logic
- They must be deterministic (no direct I/O, random, or time operations)
- Use `proxyActivities` to call activities from workflows
- Workflows receive `WorkflowExecutionPayload` with `objectIds` and `vars`

Export your workflows and activities from these files to make them available to the worker.

## Run with a local Temporal server

Running with a local Temporal server is useful for integration testing before deployment.

### 1. Install and start Temporal

Install the [Temporal CLI](https://docs.temporal.io/cli), then start the dev server:

```bash
temporal server start-dev
```

### 2. Start the worker

In another terminal:

```bash
pnpm run start
```

### 3. Execute a workflow

Using the Temporal CLI:

```bash
temporal workflow start --name exampleWorkflow -t agents/your-org/your-worker --input-file INPUT.json
```

Where `INPUT.json` contains the workflow parameters:

```json
{
  "objectIds": ["content-object-id"],
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

## Debugging workflows

You can debug workflows by replaying them locally using the Temporal replayer in `src/debug-replayer.ts`.

See https://docs.temporal.io/develop/typescript/debugging for more information.

## Configuration

Worker configuration is defined in `package.json` under the `vertesia` section:

```json
{
  "vertesia": {
    "pm": "pnpm",
    "image": {
      "repository": "us-docker.pkg.dev/dengenlabs/us.gcr.io",
      "organization": "your-org",
      "name": "your-worker"
    }
  }
}
```

The worker domain (task queue) is automatically constructed as: `agents/{organization}/{name}`

## Deployment

### Build the Docker image

```bash
vertesia worker build
```

This builds a Docker image tagged as `your-organization/your-worker:latest`.
This image is only for local testing.

### Create a release version

```bash
vertesia worker release <version>
```

The version must be in `major.minor.patch[-modifier]` format (e.g., `1.0.0`, `1.0.0-rc1`).

This creates a new Docker tag `your-organization/your-worker:version` from the `latest` image.

### Publish to Vertesia

```bash
vertesia worker publish <version>
```

This pushes the image to Vertesia and deploys the worker.

Options:

- `--push-only`: Only push the image without deploying
- `--deploy-only`: Deploy a previously uploaded version

### View versions

```bash
vertesia worker versions
```

## Running deployed workflows

Once deployed, workflows can be triggered via:

**SDK:**

```javascript
const run = await client.workflows.execute("exampleWorkflow", {
  task_queue: "agents/your-org/your-worker",
  objectIds: ["content-object-id"],
  vars: {
    dryRun: false,
  },
});
```

**CLI:**

```bash
vertesia workflows execute exampleWorkflow -o <OBJECT_ID> --queue "agents/your-org/your-worker" -f vars.json
```

**API:**

```bash
curl --location 'https://api.vertesia.io/api/v1/workflows/execute/exampleWorkflow' \
--header 'Authorization: Bearer <YOUR_JWT_TOKEN>' \
--header 'Content-Type: application/json' \
--data '{
  "vars": { "dryRun": false },
  "task_queue": "agents/your-org/your-worker",
  "objectIds": ["content-object-id"]
}'
```

## Dependencies

Built with:

- **Temporal**: Workflow orchestration
- **Vertesia SDK**: Platform integration
- **TypeScript**: Type-safe development
- **Vitest**: Testing framework
