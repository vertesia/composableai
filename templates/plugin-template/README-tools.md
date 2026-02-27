# Tool Server

A template for building custom tool servers that expose LLM tools, skills, interactions, and MCP providers. Built with [Hono](https://hono.dev/) for flexible deployment to Vercel Functions or Node.js HTTP servers.

## Features

- 🛠️ **Tools**: Executable functions that can be invoked via API (e.g., calculator, API integrations)
- 🎯 **Skills**: AI capabilities defined as markdown prompts with optional helper scripts
- 🔄 **Interactions**: Multi-step agent workflows with templated prompts
- 🔌 **MCP Providers**: Model Context Protocol integrations (optional)
- 📄 **Auto-generated HTML**: Browse and explore resources with automatically generated pages
- 🚀 **Flexible Deployment**: Deploy to Vercel Functions, Cloud Run, Railway, or any Node.js host
- 📦 **Browser Bundles**: Standalone browser-ready bundles for client-side usage
- 🔧 **Simple Build**: Single Rollup config handles TypeScript, raw imports, and bundling

## Project Structure

```
plugin-template/
├── src/
│   ├── tool-server/        # Tool server code
│   │   ├── tools/          # Tool collections
│   │   │   └── examples/   # Example: calculator tool
│   │   │       ├── calculator/
│   │   │       │   ├── schema.ts
│   │   │       │   ├── calculator.ts
│   │   │       │   └── index.ts
│   │   │       ├── icon.svg.ts
│   │   │       └── index.ts
│   │   ├── skills/         # Skill collections
│   │   │   └── examples/   # Example: user-select skill
│   │   │       └── user-select/
│   │   │           ├── SKILL.md
│   │   │           └── user-select.tsx
│   │   ├── interactions/   # Interaction collections
│   │   │   └── examples/   # Example: what_color interaction
│   │   │       └── what_color/
│   │   │           ├── prompt.hbs
│   │   │           ├── prompt_schema.ts
│   │   │           ├── result_schema.ts
│   │   │           └── index.ts
│   │   ├── server.ts       # Hono server entry point
│   │   ├── server-node.ts  # Node.js HTTP server
│   │   └── build-site.ts   # Static HTML generator
│   └── ui/                 # UI plugin code (see README-ui.md)
├── api/
│   └── index.js            # Vercel adapter
├── lib/                    # Compiled code (TypeScript → JavaScript)
│   ├── server.js
│   ├── server-node.js
│   ├── tools/
│   └── ...
├── dist/                   # Static HTML pages (public files)
│   ├── index.html
│   ├── tools/
│   ├── skills/
│   └── interactions/
├── public/                 # Static assets
├── package.json
├── rollup.config.js        # Unified build configuration (TypeScript + bundles)
├── vercel.json             # Vercel deployment config
└── tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install
# or
pnpm install
```

### Development

Start the development server with automatic rebuild and restart:

```bash
npm run dev
```

This will:
1. **Initial build** - Compiles TypeScript and generates HTML pages
2. **Rollup watch mode** - Rebuilds TypeScript on file changes
3. **Node.js with --watch** - Restarts server when lib/ changes

The server will be available at:
- API: http://localhost:3000/api
- Web UI: http://localhost:3000

To use a different port:
```bash
PORT=8080 npm run dev
```

**Manual control (advanced):**
```bash
# Terminal 1: Build on changes
npm run build:watch

# Terminal 2: Server with auto-restart
npm run start:watch
```

### Building

Build the project for production:

```bash
npm run build
```

This will:
1. **Rollup**: Compile TypeScript to JavaScript in `lib/` (ESM with preserveModules)
2. **Copy assets**: Copy skill assets (.md, .py files) to `lib/`
3. **Generate HTML**: Create static HTML pages in `dist/`
4. **Rollup**: Create browser bundles in `dist/libs/`

The build uses a single **rollup.config.js** that handles:
- TypeScript compilation with `@rollup/plugin-typescript` → `lib/`
- `?raw` imports for template files (via custom rawPlugin)
- Browser bundles with tree-shaking and minification → `dist/libs/`

**Output structure:**
- `lib/` = Compiled code (what you run)
- `dist/` = Static HTML + browser bundles (what you serve)

## Creating Resources

### 1. Creating a Tool

Tools are executable functions that can be invoked via API.

**Structure:**
```
src/tool-server/tools/my-tool/
├── manifest.ts      # Tool metadata and schema
├── my-tool.ts       # Implementation
├── icon.svg.ts      # SVG icon
└── index.ts         # Collection export
```

**Example: manifest.ts**
```typescript
import { ToolDefinition } from "@vertesia/tools-sdk";

export default {
    name: "my-tool",
    description: "Description of what this tool does",
    input_schema: {
        type: "object",
        properties: {
            param1: {
                type: "string",
                description: "First parameter"
            }
        },
        required: ["param1"]
    }
} satisfies ToolDefinition;
```

**Example: my-tool.ts**
```typescript
import { Tool, ToolExecutionContext } from "@vertesia/tools-sdk";
import manifest from "./manifest.js";

interface MyToolParams {
    param1: string;
}

async function execute(
    params: MyToolParams,
    context: ToolExecutionContext
): Promise<string> {
    // Tool implementation
    return `Processed: ${params.param1}`;
}

export const MyTool = {
    ...manifest,
    run: execute
} satisfies Tool<MyToolParams>;
```

**Example: index.ts**
```typescript
import { ToolCollection } from "@vertesia/tools-sdk";
import { MyTool } from "./my-tool.js";
import icon from "./icon.svg.js";

export const MyTools = new ToolCollection({
    name: "my-tool",
    title: "My Tools",
    description: "Description of the tool collection",
    icon,
    tools: [MyTool]
});
```

**Register the collection:**

Add to `src/tool-server/tools/index.ts`:
```typescript
import { MyTools } from "./my-tool/index.js";

export const tools = [
    MyTools,
    // ... other collections
];
```

### 2. Creating a Skill

Skills are AI capabilities defined as markdown prompts.

**Structure:**
```
src/tool-server/skills/my-skill/
├── SKILL.md         # Skill definition
└── helper.py        # Optional helper script
```

**Example: SKILL.md**
```markdown
---
name: my-skill
title: My Skill
keywords: keyword1, keyword2, keyword3
tools: tool1, tool2
packages: package1==1.0.0
---

# My Skill

You are an AI assistant with expertise in [domain].

## Instructions

1. First instruction
2. Second instruction
3. Third instruction

## Guidelines

- Guideline 1
- Guideline 2
```

**Register the collection:**

Create `src/tool-server/skills/my-skill/index.ts`:
```typescript
import { SkillCollection, loadSkillsFromDirectory } from "@vertesia/tools-sdk";

export const MySkills = new SkillCollection({
    name: "my-skill",
    title: "My Skills",
    description: "Description of the skill collection",
    skills: loadSkillsFromDirectory(new URL(".", import.meta.url).pathname)
});
```

Add to `src/tool-server/skills/index.ts`:
```typescript
import { MySkills } from "./my-skill/index.js";

export const skills = [
    MySkills,
    // ... other collections
];
```

### 3. Creating an Interaction

Interactions are multi-step workflows with templated prompts.

**Structure:**
```
src/tool-server/interactions/my-interaction/
└── my_workflow/
    ├── prompt.jst   # JavaScript template string
    └── index.ts     # Interaction spec
```

**Example: prompt.jst**
```javascript
return `
# Task: ${taskName}

## Parameters
- **Input**: ${input}
- **Options**: ${JSON.stringify(options)}

## Instructions

Please process the following according to the parameters above.

${additionalInstructions || 'No additional instructions.'}
`;
```

**Example: index.ts**
```typescript
import { PromptRole } from "@llumiverse/common";
import { InteractionSpec, TemplateType } from "@vertesia/common";
import PROMPT_CONTENT from "./prompt.jst?raw";

export default {
    name: "my_workflow",
    title: "My Workflow",
    description: "Description of what this interaction does",
    result_schema: {
        type: "object",
        properties: {
            result: {
                type: "string",
                description: "The workflow result"
            }
        },
        required: ["result"]
    },
    prompts: [{
        role: PromptRole.user,
        content: PROMPT_CONTENT,
        content_type: TemplateType.jst,
        schema: {
            type: "object",
            properties: {
                taskName: { type: "string" },
                input: { type: "string" },
                options: { type: "object" },
                additionalInstructions: { type: "string" }
            },
            required: ["taskName", "input"]
        }
    }],
    tags: ["tag1", "tag2"]
} satisfies InteractionSpec;
```

**Register the collection:**

Create `src/tool-server/interactions/my-interaction/index.ts`:
```typescript
import { InteractionCollection } from "@vertesia/tools-sdk";
import myWorkflow from "./my_workflow/index.js";
import icon from "./icon.svg.js";

export const MyInteractions = new InteractionCollection({
    name: "my-interaction",
    title: "My Interactions",
    description: "Description of the interaction collection",
    icon,
    interactions: [myWorkflow]
});
```

Add to `src/tool-server/interactions/index.ts`:
```typescript
import { MyInteractions } from "./my-interaction/index.js";

export async function loadInteractions() {
    return [
        MyInteractions,
        // ... other collections
    ];
}
```

## API Reference

### Endpoints

#### `GET /api`
Returns descriptions of all available tools, skills, and interactions.

**Response:**
```json
{
  "tools": [...],
  "skills": [...],
  "interactions": [...]
}
```

#### `POST /api`
Executes a tool with the provided payload.

**Request Body:**
```json
{
  "tool_name": "calculator",
  "tool_input": {
    "expression": "2 + 2"
  },
  "context": {
    "serverUrl": "http://localhost:5174",
    "storeUrl": "http://store.example.com",
    "apikey": "your-api-key"
  },
  "vars": {}
}
```

**Response:**
```json
{
  "is_error": false,
  "content": "Result: 2 + 2 = 4"
}
```

## Deployment

The template supports **two deployment modes**:

### 1. Vercel Functions (Serverless)

Best for: Auto-scaling, zero-config deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

The `api/index.js` adapter automatically converts your Hono server to Vercel Functions format.

### 2. Node.js HTTP Server

Best for: Cloud Run, Railway, Fly.io, Docker, VPS

The template includes `src/tool-server/server-node.ts` which creates a standalone HTTP server.

**Deploy to Cloud Run:**
```bash
gcloud run deploy tool-server \
  --source . \
  --platform managed \
  --region us-central1
```

**Deploy to Railway:**
1. Connect your repo
2. Railway auto-detects Node.js
3. Uses `npm start` automatically

**Deploy to Docker:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

**Deploy to VPS:**
```bash
# On your server
git clone <your-repo>
cd plugin-template
npm install
npm run build
npm start

# Or use PM2 for process management
npm i -g pm2
pm2 start lib/server-node.js --name tool-server
```

### Other Platforms

Hono's flexibility allows deployment to:
- Cloudflare Workers
- Deno Deploy
- AWS Lambda (with adapter)
- Bun
- Azure Functions

See [Hono documentation](https://hono.dev/getting-started/basic) for platform-specific guides.

## Configuration

### Customization

Edit `src/tool-server/server.ts` to customize:

```typescript
const server = createToolServer({
    title: 'Your Server Name',
    description: 'Your server description',
    prefix: '/api',
    tools,
    interactions,
    skills,
    mcpProviders: [] // Add MCP providers here
});
```

### Environment Variables

For GitHub integration or other sensitive config, use environment variables:

1. Create `.env` file:
```bash
GITHUB_APP_ID=your-app-id
GITHUB_APP_PRIVATE_KEY_FILE=path/to/key.pem
```

2. Access in code:
```typescript
const githubAppId = process.env.GITHUB_APP_ID;
```

#### Organization Access Restriction

To restrict the tool server to specific Vertesia organizations, set the `VERTESIA_ALLOWED_ORGS` environment variable:

```bash
VERTESIA_ALLOWED_ORGS=org_abc123,org_def456
```

| Behavior | Description |
|----------|-------------|
| **Set** | Only listed organization IDs can access the server. Others receive `403 Forbidden`. |
| **Not set** | All authenticated organizations are allowed (default). |

The check is handled automatically by the `authorize()` middleware in `@vertesia/tools-sdk`. The organization ID is extracted from the JWT token's `account.id` field. No code changes are needed in your plugin.

**Setting on Vercel:** Use Project Settings > Environment Variables, or `vercel env add VERTESIA_ALLOWED_ORGS`.
**Setting on Docker/Node.js:** Pass as a standard environment variable (e.g., in `.env` or `docker run -e`).

## Browser Bundles

After building, browser-ready bundles are available at:
```
dist/libs/tool-server-{collection-name}.js
```

Use them in the browser:
```html
<script type="module">
  import { CalculatorTools } from './libs/tool-server-calculator.js';
  // Use the tools
</script>
```

## Debugging

This template includes full VSCode debugging support with breakpoints, watch expressions, and call stack inspection.

**Quick start:**
1. Press **F5** in VSCode
2. Select "Debug Server"
3. Set breakpoints in your TypeScript files
4. Make API requests to trigger breakpoints

For complete debugging workflows, configurations, and troubleshooting, see **[.vscode/README.md](.vscode/README.md)**.

## Development Tips

1. **Watch Mode**: `npm run dev` automatically rebuilds and restarts on file changes
2. **Type Safety**: Use `satisfies` to ensure type correctness while preserving inference
3. **Raw Imports**: Use `import content from './file.jst?raw'` for large template strings
4. **Debugging**: See [.vscode/README.md](.vscode/README.md) for VSCode debugging setup
5. **Testing Tools**: Use `POST /api` with curl or Postman to test tools

### Testing with curl

**Test a tool:**
```bash
curl -H "Authorization: Bearer {{VERTESIA_JWT}}" \
  -H "Content-Type: application/json" \
  -X POST "http://localhost:3000/api/tools/calculator" \
  -d '{
    "tool_use": {
      "id": "run1",
      "tool_name": "calculator",
      "tool_input": {"expression": "10 * 5"}
    }
  }'
```

**Get interaction details:**
```bash
curl -H "Authorization: Bearer {{VERTESIA_JWT}}" \
  "http://localhost:3000/api/interactions/summarize/text_summarizer"
```

**Get skill details:**
```bash
curl -H "Authorization: Bearer {{VERTESIA_JWT}}" \
  "http://localhost:3000/api/skills/code-review/skill_code-review"
```

Replace `{{VERTESIA_JWT}}` with a valid Vertesia JWT token.

## Troubleshooting

### Build fails with module errors
- Ensure all imports use `.js` extensions (ESM requirement)
- Check that `tsconfig.json` has `"module": "ES2022"`
- Verify `@rollup/plugin-typescript` is installed

### Dev server not starting
- Make sure `concurrently` is installed
- Check that dependencies are installed (`npm install`)
- If still having issues, try `npm run build` manually first

### Tool execution errors
- Check tool implementation returns a string
- Verify input_schema matches the parameters
- Check console for detailed error messages

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

---

Built with ❤️ using [Hono](https://hono.dev/) and [@vertesia/tools-sdk](https://github.com/vertesia/tools-sdk)
