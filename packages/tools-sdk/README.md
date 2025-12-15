# @vertesia/tools-sdk

SDK for building remote tools, interactions, and skills that integrate with the Vertesia platform. Built on top of [Hono](https://hono.dev/) for lightweight, high-performance HTTP servers.

## Installation

```bash
npm install @vertesia/tools-sdk hono
# or
pnpm add @vertesia/tools-sdk hono
```

## Quick Start

```typescript
import { createToolServer, ToolCollection } from "@vertesia/tools-sdk";

// Define a tool collection
const myTools = new ToolCollection({
  name: "my-tools",
  description: "My custom tools",
  tools: [
    {
      name: "hello",
      description: "Says hello",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name to greet" },
        },
        required: ["name"],
      },
      execute: async ({ name }) => {
        return { message: `Hello, ${name}!` };
      },
    },
  ],
});

// Create the server
const server = createToolServer({
  title: "My Tools Server",
  tools: [myTools],
});

export default server;
```

## Features

### Tool Collections

Define collections of tools that can be called remotely:

```typescript
import { ToolCollection } from "@vertesia/tools-sdk";

const tools = new ToolCollection({
  name: "utilities",
  description: "Utility tools",
  tools: [/* tool definitions */],
});
```

### Skill Collections

Define skills that can be executed by agents:

```typescript
import { SkillCollection } from "@vertesia/tools-sdk";

const skills = new SkillCollection({
  name: "my-skills",
  description: "Custom skills",
  skills: [/* skill definitions */],
});
```

### Interaction Collections

Expose interactions for execution:

```typescript
import { InteractionCollection } from "@vertesia/tools-sdk";

const interactions = new InteractionCollection({
  name: "my-interactions",
  interactions: [/* interaction refs */],
});
```

### Server Configuration

```typescript
const server = createToolServer({
  title: "My Server",           // HTML page title
  prefix: "/api",               // API route prefix (default: '/api')
  tools: [toolCollection],      // Tool collections
  skills: [skillCollection],    // Skill collections
  interactions: [interactionCollection], // Interaction collections
  disableHtml: false,           // Disable HTML documentation pages
});
```

### Authentication

The SDK includes built-in JWT authentication:

```typescript
import { authorize } from "@vertesia/tools-sdk";

// In your route handler
const session = await authorize(request);
```

## API Reference

For detailed API documentation, visit [docs.vertesiahq.com](https://docs.vertesiahq.com).

## License

Apache-2.0
