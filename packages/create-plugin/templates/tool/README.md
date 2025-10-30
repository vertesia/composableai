# Tool Collections

This project contains custom tool collections for Vertesia.

## Project Structure

```
src/
├── collections/           # Tool collections
│   ├── example/          # Example collection
│   │   ├── icon.svg.ts   # Collection icon
│   │   ├── index.ts      # Collection definition
│   │   └── weather/      # Weather tool
│   │       ├── manifest.ts     # Tool schema/metadata
│   │       └── WeatherTool.ts  # Tool implementation
│   └── index.ts          # Export all collections
├── server.ts             # Hono server with collection endpoints
└── index.ts              # Main exports
```

## Development

Start the development server:

```bash
pnpm install
pnpm dev
```

The server will be available at `http://localhost:5174/api`

### API Endpoints

- `GET /api` - List all collections
- `GET /api/{collection}` - Get collection metadata and tool definitions
- `POST /api/{collection}` - Execute a tool in the collection

### Testing the API

Get the example collection tools:
```bash
curl http://localhost:5174/api/example
```

Execute the weather tool:
```bash
curl -X POST http://localhost:5174/api/example \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "tool_use": {
      "id": "test-123",
      "tool_name": "weather",
      "tool_input": {
        "location": "New York, NY"
      }
    }
  }'
```

## Creating New Tools

### 1. Create a new tool in an existing collection

1. Create a new directory under `src/collections/example/` (e.g., `my-tool/`)
2. Create `manifest.ts` with your tool's schema
3. Create `MyTool.ts` with the implementation
4. Add the tool to `src/collections/example/index.ts`

### 2. Create a new collection

1. Create a new directory under `src/collections/` (e.g., `my-collection/`)
2. Create `icon.svg.ts` with an SVG icon
3. Create `index.ts` to define the collection
4. Add your tools in subdirectories
5. Export the collection in `src/collections/index.ts`

## Building for Production

Build the project:

```bash
pnpm build
```

This creates an optimized build in the `dist/` directory.

## Authentication

Tools receive authentication context through the `ToolExecutionContext` parameter:

```typescript
export async function myTool(
    payload: ToolExecutionPayload<MyToolParams>,
    context: ToolExecutionContext
) {
    // Access the decoded JWT token
    const userId = context.payload.sub;
    
    // Get a Vertesia client instance
    const client = await context.getClient();
    
    // Your tool logic here
    return {
        is_error: false,
        content: "Tool result"
    };
}
```

## Learn More

- [Vertesia Documentation](https://docs.vertesiahq.com)
- [Tool SDK Reference](https://github.com/vertesia/composableai/tree/main/packages/tools-sdk)
