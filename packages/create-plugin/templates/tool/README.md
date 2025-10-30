# Vertesia tools plugin

This plugin is exposing tools to vertesia. The tools as exposed on an external web server providing two endpoints:
1. `GET /` - show tool descriptions
2. `POST /` - execute a tool given an execution payload.

Note that when deployed on vercel the endpoints are:

1. `GET /api`
2. `POST /api`

The payload used when executing a tool must conform to the following interface:

```ts
interface ToolExecutionPayload<ParamsT extends Record<string, any>> {
    context: {
        serverUrl: string,
        storeUrl: string,
        apikey: string
    }
    vars: Record<string, any>,
    tool_input: ParamsT,
    tool_name: string,
}
```

To launch the tools server you can start the vite dev server using `pnpm dev`.

If you want to **debug** and add breakpoints in the code you must run the vite dev server from VSCode by running the `Debug Tools Server` launch configuration.

Vercel deployment is supported by wrapping the `hono` server using a vercel adapter.
