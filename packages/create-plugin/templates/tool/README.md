# Tool Collections

This project contains custom tool collections for Vertesia.

## Project Structure

```txt
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

## Building for Production

Build the project:

```bash
pnpm build
```

This creates an optimized build in the `dist/` directory.

## Deployment

Your Agent Tool Server can be deployed to various platforms. The server is built with Hono, which supports multiple runtimes including Node.js, Vercel Edge Functions, Cloudflare Workers, AWS Lambda, and more.

For detailed guides on deploying to different platforms, visit the [Hono documentation](https://hono.dev/docs/). The documentation provides comprehensive examples for various deployment targets and runtimes.

### Deploying to Vercel (Example)

This section demonstrates deploying to Vercel as an example, since Vercel offers a generous free tier and simple deployment process. The project includes `api/index.ts` which serves as the entry point for Vercel deployment using the Hono Vercel adapter. Vercel automatically detects and configures the Edge Function.

#### Setup

Install the Vercel CLI globally:

```bash
npm i -g vercel
```

#### Deployment Steps

1. **Login to Vercel**:

    ```bash
    vercel login
    ```

2. **Deploy to preview**:

    ```bash
    vercel
    ```

    This will create a preview deployment and provide you with a URL to test your tool server.

3. **Deploy to production**:

    ```bash
    vercel --prod
    ```

Your tool server will be available at `https://your-project.vercel.app/api`

For more information, visit the [Vercel CLI documentation](https://vercel.com/docs/cli).

#### Verify Your Deployment

Test that your server is responding correctly:

```bash
curl https://your-project.vercel.app/api
```

You should see a JSON response with the API information and available endpoints.

#### Configure Your Tool Server in Vertesia

After deploying to Vercel, update your app manifest to point to the deployed URL using the vertesia CLI:

```bash
vertesia apps update <appId> --manifest '{
  "name": "my-app",
  "title": "My App",
  "description": "A sample app",
  "publisher": "your-org",
  "private": true,
  "status": "beta",
  "tool_collections": [
    "https://your-app.vercel.app/api/example"
  ],
}'
```

Replace `appId` by the actual ID and `https://your-app.vercel.app` with your actual Vercel deployment URL.

## Learn More

- [Vertesia Documentation](https://docs.vertesiahq.com)
- [Tool SDK Reference](https://github.com/vertesia/composableai/tree/main/packages/tools-sdk)
