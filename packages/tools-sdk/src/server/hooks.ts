import type { Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authorize } from '../auth.js';
import type {
    AppLifecycleHookContext,
    AppLifecycleHookName,
    AppLifecycleHookPayload,
    AppLifecycleHookResult,
} from '../types.js';
import type { ToolContext, ToolServerConfig } from './types.js';

const HOOK_NAMES = new Set<AppLifecycleHookName>(['install', 'uninstall']);

export function createHooksRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    app.post(`${basePath}/:name`, async (c: Context) => {
        const name = c.req.param('name') as AppLifecycleHookName;
        if (!HOOK_NAMES.has(name)) {
            throw new HTTPException(404, { message: `Unknown app lifecycle hook: ${name}` });
        }

        const hook = config.hooks?.[name];
        if (!hook) {
            throw new HTTPException(404, { message: `App lifecycle hook is not registered: ${name}` });
        }

        const requestContext = c as unknown as ToolContext;
        const payload = parseHookPayload(requestContext.requestBody);
        const metadata = payload.metadata ?? {};
        const session = await authorize(c, metadata.endpoints, { toolName: `hook:${name}` });
        const context: AppLifecycleHookContext = {
            token: session.token,
            payload: session.payload,
            getClient: () => session.getClient(),
            metadata,
        };
        const result = await hook(context);

        return c.json({ ok: true, ...(result ?? {}) } satisfies { ok: true } & AppLifecycleHookResult);
    });
}

function parseHookPayload(body: unknown): AppLifecycleHookPayload {
    if (body === undefined) return {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new HTTPException(400, { message: 'Invalid lifecycle hook payload' });
    }
    const metadata = (body as AppLifecycleHookPayload).metadata;
    if (metadata !== undefined && (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))) {
        throw new HTTPException(400, { message: 'Invalid lifecycle hook metadata' });
    }
    return { metadata };
}
