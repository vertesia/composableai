# Vertesia Plugin Template

A unified template for building Vertesia plugins with a **Hono tool server** (backend) and **React UI plugin** (frontend), built and deployed as a single unit.

## What You Can Build

- **Tools** -- executable functions invoked by AI agents (API integrations, data processing)
- **Skills** -- markdown-defined AI capabilities with optional widgets
- **Interactions** -- templated or agent-based prompts for workflows
- **Content Types** -- schema definitions for structured data in Vertesia's store
- **Templates** -- rendering templates for document generation
- **MCP Providers** -- Model Context Protocol integrations
- **UI Plugin** -- custom React pages integrated into the Vertesia platform

## Prerequisites

Your plugin must be registered as an app in Vertesia and installed in a project before users can access it. Use the CLI to create and install in one step:

```bash
vertesia apps create --install -f manifest.json
```

Where `manifest.json` describes your app:

```json
{
  "name": "my-plugin",
  "title": "My Plugin",
  "description": "What this plugin does",
  "publisher": "your-org",
  "visibility": "private",
  "status": "beta",
  "endpoint": "https://your-plugin.vercel.app/api"
}
```

The `--install` flag installs the app in the current project and grants permissions to the creator. The `endpoint` URL points to your deployed tool server — update it after deploying (see [Deployment](#deployment)).

Once created, set the app name in `.env.local` for local development:

```bash
VITE_APP_NAME=my-plugin
```

## Quick Start

```bash
pnpm install
pnpm dev          # Vite dev server with API middleware
```

Open <https://localhost:5173> -- the UI loads with HMR, and the tool server API is available at `/api` on the same port.

## Scripts

| Script | Runs | Description |
|--------|------|-------------|
| `pnpm dev` | `vite dev` | Dev server (HTTPS) with UI HMR + tool server API middleware |
| `pnpm build` | `build:server && build:ui` | Full production build (lint runs as prebuild) |
| `pnpm build:server` | `rollup -c` | Compile tool server to `lib/` |
| `pnpm build:ui` | `build:ui:app && build:ui:lib` | Build both UI targets |
| `pnpm build:ui:app` | `vite build --mode app` | Standalone app to `dist/app/` |
| `pnpm build:ui:lib` | `vite build --mode lib` | Plugin library to `dist/lib/plugin.js` |
| `pnpm start` | `build:server && vite preview` | Preview production build locally |
| `pnpm start:vercel` | `vercel dev` | Test Vercel deployment locally |

## Project Structure

```
plugin-template/
├── src/
│   ├── tool-server/
│   │   ├── server.ts              # Hono server (default export)
│   │   ├── server-node.ts         # Standalone Node.js HTTP entry
│   │   ├── config.ts              # Registers all collections
│   │   ├── settings.ts            # Plugin settings JSON Schema
│   │   ├── ui-nav-items.ts        # Sidebar navigation config
│   │   ├── tools/                 # Tool collections
│   │   ├── skills/                # Skill collections
│   │   ├── interactions/          # Interaction collections
│   │   ├── types/                 # Content type collections
│   │   ├── templates/             # Rendering template collections
│   │   └── mcp/                   # MCP provider definitions
│   └── ui/
│       ├── plugin.tsx             # Plugin entry (library build)
│       ├── main.tsx               # Standalone dev entry
│       ├── routes.tsx             # Route definitions
│       ├── pages.tsx              # Page components
│       └── index.css              # Tailwind CSS 4 entry
├── api/
│   └── index.js                   # Vercel serverless adapter
├── vite.config.ts                 # UI + dev server config
├── vite-api-server.ts             # Vite plugin: mounts Hono as middleware
├── rollup.config.js               # Tool server build config
├── vercel.json                    # Vercel deployment config
└── package.json
```

## Architecture

### Dev Mode (`pnpm dev`)

A single Vite dev server runs at `https://localhost:5173`. The `vite-api-server.ts` plugin mounts the Hono tool server as Connect middleware, so the API is served at `/api` on the same port. Tool server source is loaded via Vite's `ssrLoadModule` with hot reload. Import hooks (`?skill`, `?skills`, `?prompt`, `?raw`, `?template`, `?templates`) are handled by `vertesiaImportPlugin`. HTTPS is required for Firebase authentication.

### Preview Mode (`pnpm start`)

Builds the tool server first, then runs `vite preview` which loads the compiled server from `lib/` as middleware alongside the built UI. Useful for validating production output locally.

### Production Build

| Component | Bundler | Entry | Output |
|-----------|---------|-------|--------|
| Tool Server | Rollup | `src/tool-server/server.ts` | `lib/` |
| UI Plugin | Vite | `src/ui/plugin.tsx` | `dist/lib/plugin.js` |
| UI App | Vite | `src/ui/main.tsx` | `dist/app/` |
| Widgets | Rollup | `skills/**/*.tsx` | `dist/widgets/` |

## Creating Resources

Every resource type follows the same pattern: create source files, export from a collection, register the collection in `config.ts`.

### Tools

Tools are executable functions invoked via API. Three files per tool:

**`schema.ts`** -- interface + JSON Schema:

```typescript
import { JSONSchema } from "@llumiverse/common";

export interface MyToolParams {
    input: string;
}

export const Schema = {
    type: "object",
    properties: {
        input: { type: "string", description: "The input to process" }
    },
    required: ["input"]
} satisfies JSONSchema;
```

**`my-tool.ts`** -- implementation:

```typescript
import { ToolExecutionContext, ToolExecutionPayload } from "@vertesia/tools-sdk";
import { ToolResultContent } from "@vertesia/common";
import { type MyToolParams } from "./schema.js";

export async function execute(
    payload: ToolExecutionPayload<MyToolParams>,
    _context: ToolExecutionContext
): Promise<ToolResultContent> {
    const { input } = payload.tool_use.tool_input!;
    return { is_error: false, content: `Processed: ${input}` };
}
```

**`index.ts`** -- tool object:

```typescript
import { Tool } from "@vertesia/tools-sdk";
import { execute } from "./my-tool.js";
import { MyToolParams, Schema } from "./schema.js";

export const MyTool = {
    name: "my-tool",
    description: "Processes input",
    input_schema: Schema,
    run: execute
} satisfies Tool<MyToolParams>;
```

**Collection** (`tools/my-collection/index.ts`):

```typescript
import { ToolCollection } from "@vertesia/tools-sdk";
import { MyTool } from "./my-tool/index.js";
import icon from "./icon.svg.js";

export const MyTools = new ToolCollection({
    name: "my-collection",
    title: "My Tools",
    description: "A collection of tools",
    icon,
    tools: [MyTool]
});
```

### Skills

Skills are markdown prompts auto-discovered from the filesystem. Create a `SKILL.md` with frontmatter:

```markdown
---
name: my-skill
title: My Skill
description: Does something useful
keywords: keyword1, keyword2
---

You are an AI assistant specialized in ...

## Instructions

1. First instruction
2. Second instruction
```

**Collection** (`skills/my-collection/index.ts`):

```typescript
import { SkillCollection } from "@vertesia/tools-sdk";
import skills from "./all?skills";

export const MySkills = new SkillCollection({
    name: "my-collection",
    title: "My Skills",
    description: "Skill collection description",
    skills
});
```

The `?skills` import hook auto-discovers all `SKILL.md` files in the directory.

### Interactions

Two patterns are supported:

**Template-based** (Handlebars prompt in `.hbs` file):

```typescript
import { InteractionSpec } from "@vertesia/common";
import PROMPT from "./prompt.hbs?prompt";
import result_schema from "./result_schema";

export default {
    name: "my_interaction",
    title: "My Interaction",
    description: "What this interaction does",
    result_schema,
    prompts: [PROMPT],
    tags: ["tag1"]
} satisfies InteractionSpec;
```

**Code-based** (inline prompts, used for agents):

```typescript
import { InteractionSpec, TemplateType } from "@vertesia/common";
import { PromptRole } from "@llumiverse/common";

export default {
    name: "my_agent",
    title: "My Agent",
    description: "An agent interaction",
    prompts: [{
        role: PromptRole.user,
        content: "You are a helpful assistant...",
        content_type: TemplateType.text,
    }],
    agent_runner_options: { is_agent: true },
} satisfies InteractionSpec;
```

**Collection** (`interactions/my-collection/index.ts`):

```typescript
import { InteractionCollection } from "@vertesia/tools-sdk";
import myInteraction from "./my_interaction/index.js";
import icon from "./icon.svg.js";

export const MyInteractions = new InteractionCollection({
    name: "my-collection",
    title: "My Interactions",
    description: "Interaction collection",
    icon,
    interactions: [myInteraction]
});
```

### Content Types

Define schemas for structured data stored in Vertesia:

```typescript
import { InCodeTypeSpec } from "@vertesia/common";

export const MyType = {
    name: "my-type",
    description: "Description of this content type",
    object_schema: {
        type: "object",
        properties: {
            title: { type: "string", description: "Title" },
        },
        required: ["title"]
    },
    table_layout: [
        { field: "properties.title", name: "Title", type: "string" }
    ],
    is_chunkable: true,
    strict_mode: true
} satisfies InCodeTypeSpec;
```

### Templates

Rendering templates are auto-discovered from `TEMPLATE.md` files with frontmatter:

```markdown
---
title: My Report
description: Generates a formatted report
tags: [report, document]
type: document
---

## Instructions

Generate a report based on the provided data...
```

**Collection** (`templates/my-collection/index.ts`):

```typescript
import { RenderingTemplateCollection } from "@vertesia/tools-sdk";
import templates from "./all?templates";

export const MyTemplates = new RenderingTemplateCollection({
    name: "my-collection",
    title: "My Templates",
    description: "Template collection",
    templates
});
```

### Registering Collections

All collections must be added to `src/tool-server/config.ts`:

```typescript
import { ToolServerConfig } from "@vertesia/tools-sdk";
// import your collections...

export const ServerConfig = {
    title: "My Plugin",
    prefix: "/api",
    tools,
    interactions,
    types,
    skills,
    templates,
    mcpProviders,
    uiConfig: { /* ... */ },
    settings: settingsSchema,
} satisfies ToolServerConfig;
```

Each resource type has an index file (`tools/index.ts`, `skills/index.ts`, etc.) that exports an array of collections. Add your collection to the appropriate array.

## UI Plugin

The UI has two build modes:

- **App mode** (`build:ui:app`): standalone web application, deployable independently
- **Library mode** (`build:ui:lib`): plugin bundle that integrates into the Vertesia platform

In library mode, React and Vertesia dependencies are externalized (provided by the host app).

Key files:

- `src/ui/plugin.tsx` -- library entry point (exports the plugin component)
- `src/ui/main.tsx` -- standalone entry (wraps in `VertesiaShell` + `AdminApp`)
- `src/ui/routes.tsx` -- route definitions using `NestedRouterProvider`
- `src/ui/index.css` -- Tailwind CSS 4 with shared styles from `@vertesia/ui`

The Vertesia Composite App can show sub-items for your plugin in its sidebar. Configure these in `src/tool-server/ui-nav-items.ts` — it maps existing UI routes (from `routes.tsx`) as navigation entries. This file lives in `tool-server/` because the platform discovers UI navigation through the tool server's config endpoint, not from the UI bundle itself.

## API Reference

### `GET /api`

Returns metadata about available tools, skills, interactions, types, and templates.

### `POST /api/tools/<collection>`

Executes a tool.

```bash
curl -k -H "Authorization: Bearer $VERTESIA_JWT" \
  -H "Content-Type: application/json" \
  -X POST "https://localhost:5173/api/tools/examples" \
  -d '{
    "tool_use": {
      "id": "run1",
      "tool_name": "calculator",
      "tool_input": {"expression": "2 + 2"}
    }
  }'
```

### `GET /api/skills/<collection>/<name>`

Returns skill definition and instructions.

### `GET /api/interactions/<collection>/<name>`

Returns interaction definition, prompts, and schemas (requires authorization).

## Deployment

### Vercel (serverless)

```bash
npm i -g vercel
vercel --prod
```

The `api/index.js` adapter converts the Hono server to Vercel Functions. Static files are served from `dist/`. See `vercel.json` for routing.

After deploying, update the app manifest:

```bash
vertesia apps update <appId> --manifest '{
  "name": "my-plugin",
  "title": "My Plugin",
  "ui": {
    "src": "https://your-plugin.vercel.app/lib/plugin.js",
    "isolation": "shadow"
  }
}'
```

### Node.js (Cloud Run, Railway, Docker)

The template includes `src/tool-server/server-node.ts` as a standalone HTTP server entry.

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "lib/server-node.js"]
```

## Configuration

### Organization Restriction

Restrict access to specific Vertesia organizations via environment variables (set in `.env.local` or your deployment platform):

```bash
# Server-side: tool server authorize() middleware returns 403 for unlisted orgs
VERTESIA_ALLOWED_ORGS=org_abc123,org_def456

# Client-side: OrgGate component shows "Access Denied" for unlisted orgs
VITE_VERTESIA_ALLOWED_ORGS=org_abc123,org_def456
```

When unset, all authenticated organizations are allowed.

### Plugin Settings

Define a JSON Schema in `src/tool-server/settings.ts` to declare configurable settings for your plugin. The schema is served through the tool server's config endpoint and the Vertesia platform uses it to render a settings form for project administrators. This lets admins configure plugin behavior (API keys, feature flags, default parameters, etc.) without code changes. The current template ships with an empty schema — add properties as needed.

## Debugging with the Vertesia Platform

To test your local tool server with Vertesia agents (e.g. debug tool execution, inspect skill resolution), expose your dev server via a Cloudflare tunnel:

```bash
# 1. Start the dev server
pnpm dev

# 2. In a separate terminal, create a tunnel
npx cloudflared tunnel --url https://localhost:5173 --no-tls-verify
```

Cloudflare will print a public URL like `https://resorts-built-walnut-typical.trycloudflare.com`. Point your app's endpoint to it using the CLI:

```bash
# 3. Update the app manifest to use the tunnel URL
vertesia apps update <appId> --manifest '{
  "endpoint": "https://resorts-built-walnut-typical.trycloudflare.com/api"
}'
```

The platform will route agent tool calls and skill lookups to your local machine. The `--no-tls-verify` flag is needed because the Vite dev server uses a self-signed certificate.

This lets you set breakpoints, add logging, and iterate on tools/skills while running real agents on the platform. Remember to restore the production endpoint URL when you're done.

## Troubleshooting

**ESM `.js` extensions required**: All tool server imports must use `.js` extensions (`import { x } from "./foo.js"`). Missing extensions cause "Cannot find module" errors.

**Must register in `config.ts`**: Creating a collection file without adding it to the appropriate index and `config.ts` means it won't be served.

**Import hooks are Rollup-only**: `?skill`, `?skills`, `?prompt`, `?raw`, `?template`, `?templates` only work in tool server code (compiled by Rollup). They are not available in UI code (compiled by Vite).

**HTTPS required for dev**: `pnpm dev` uses HTTPS via `@vitejs/plugin-basic-ssl`. Use `-k` flag with curl to skip certificate verification.

**TypeScript verification**: Run `pnpm exec tsc --noEmit` to check for compilation errors without building.

## License

Apache-2.0
