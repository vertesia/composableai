# Vertesia Plugin Template

This is a unified template for building custom UI plugins and tool servers for the Vertesia platform.

## What's Inside

This template combines:

- **UI Plugin**: Custom React-based UI components that extend the Vertesia interface
- **Tool Server**: Backend services that provide custom tools, skills, and interactions for AI agents

## Documentation

Choose the documentation for what you want to build:

### 📱 [UI Plugin Documentation →](./README-ui.md)

Build custom UI components and pages that integrate with Vertesia's interface.

**Use cases:**

- Custom dashboards and visualizations
- Specialized UI workflows
- Interactive data exploration interfaces
- Custom settings panels

### 🔧 [Tool Server Documentation →](./README-tools.md)

Build backend services that provide custom capabilities for AI agents.

**Use cases:**

- Custom tools (e.g., API integrations, data processing)
- Skills (instructions packed as tools that inject runtime context and enable additional tools)
- Interactions (reusable agent instructions for specialized workflows)
- MCP server integrations

### 📋 [Tool Server Testing Guide →](./TESTING-tools.md)

Learn how to test your tool server locally and in development.

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Vertesia platform access

### Installation

```bash
# Install dependencies
pnpm install

# Development (runs both UI and tool server)
pnpm dev

# Or run separately:
pnpm dev:ui           # Only UI plugin
pnpm dev:tool-server  # Only tool server
```

### Building

```bash
# Build everything
pnpm build

# Or build separately:
pnpm build:ui           # UI plugin (outputs to dist/lib/plugin.js and dist/ui/)
pnpm build:tool-server  # Tool server (outputs to dist/ with static site)
```

## Project Structure

```
plugin-template/
├── src/
│   ├── ui/                    # UI plugin source code
│   │   ├── plugin.tsx         # Plugin entry point (library build)
│   │   ├── main.tsx           # App entry point (dev/app build)
│   │   ├── app.tsx, routes.tsx, pages.tsx
│   │   └── index.css          # UI styles
│   ├── tool-server/           # Tool server source code
│   │   ├── server.ts          # Hono server definition
│   │   ├── server-node.ts     # Node.js server entry
│   │   ├── build-site.ts      # Static site generator
│   │   ├── tools/             # Tool definitions
│   │   ├── skills/            # Skill definitions (SKILL.md)
│   │   └── interactions/      # Interaction definitions
│   └── index.css              # CSS forwarder for plugin builder
├── api/                       # Vercel serverless functions
├── dist/                      # Build outputs
│   ├── index.html             # Tool server HTML (with link to /ui/)
│   ├── ui/index.html          # UI plugin dev build
│   └── lib/plugin.js          # UI plugin library build
├── vite.config.ts             # UI build configuration
├── rollup.config.js           # Tool server build configuration
├── tsconfig.ui.json           # TypeScript config for UI
├── tsconfig.tool-server.json  # TypeScript config for tool server
├── package.json               # Unified dependencies and scripts
└── vercel.json                # Vercel deployment config
```

## Development Workflow

### UI Plugin Development

1. Run `pnpm dev:ui` to start Vite dev server
2. Edit files in `src/ui/`
3. View at `https://localhost:5173` (with SSL)
4. Build with `pnpm build:ui:lib` to create the plugin library

### Tool Server Development

1. Run `pnpm dev:tool-server` to start tool server with watch mode
2. Edit files in `src/tool-server/`
3. View at `http://localhost:3000` (or configured port)
4. Test tools, skills, and interactions via the web interface

### Combined Development

- Run `pnpm dev` to run both UI and tool server concurrently
- Access tool server at `http://localhost:3000`
- Access UI at `https://localhost:5173`
- Tool server's index.html includes a link to the UI dev build

## Deployment

Both UI plugin and tool server deploy as a single Vercel project:

- Static files (UI builds, tool server HTML) are served from `dist/`
- Serverless functions are served from `api/`
- See `vercel.json` for routing configuration

## Need Help?

- **UI Plugin**: See [README-ui.md](./README-ui.md) for detailed UI development guide
- **Tool Server**: See [README-tools.md](./README-tools.md) for tool/skill/interaction development
- **Testing**: See [TESTING-tools.md](./TESTING-tools.md) for testing your tool server
- **Vertesia Docs**: Visit the Vertesia documentation for platform-specific guides

## License

Apache-2.0
