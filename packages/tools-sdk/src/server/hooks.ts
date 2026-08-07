import { AppEventHookPayloadSchema } from '@vertesia/common/api-schemas';
import type { Context, Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { authorize } from '../auth.js';
import type {
    AppEventHookDefinition,
    AppEventHookPayload,
    AppLifecycleHookContext,
    AppLifecycleHookDefinition,
    AppLifecycleHookName,
    AppLifecycleHookPayload,
    AppLifecycleHookResult,
} from '../types.js';
import type { ToolContext, ToolServerConfig } from './types.js';

const HOOK_NAMES = new Set<AppLifecycleHookName>(['install', 'uninstall']);
const EVENT_HOOK_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function createHooksRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const hooks = new Map<string, AppLifecycleHookDefinition | AppEventHookDefinition>();
    for (const hook of config.hooks ?? []) {
        if (hook.kind === 'lifecycle' && !HOOK_NAMES.has(hook.name)) {
            throw new Error(`Unknown app lifecycle hook: ${hook.name}`);
        }
        if (hook.kind === 'event' && !EVENT_HOOK_NAME_PATTERN.test(hook.name)) {
            throw new Error(`Invalid app event hook name: ${hook.name}`);
        }
        if (hook.kind === 'event' && HOOK_NAMES.has(hook.name as AppLifecycleHookName)) {
            throw new Error(`App event hook name is reserved: ${hook.name}`);
        }
        if (hooks.has(hook.name)) {
            throw new Error(`Duplicate app hook: ${hook.name}`);
        }
        hooks.set(hook.name, hook);
    }

    app.post(`${basePath}/:name`, async (c: Context) => {
        const name = c.req.param('name') ?? '';
        const hook = hooks.get(name);
        if (!hook) {
            throw new HTTPException(404, { message: `App hook is not registered: ${name}` });
        }

        const requestContext = c as unknown as ToolContext;
        if (hook.kind === 'event') {
            return executeEventHook(c, requestContext, hook);
        }

        const payload = parseHookPayload(requestContext.requestBody);
        const metadata = payload.metadata ?? {};
        const session = await authorize(c, metadata.endpoints, { toolName: `hook:${name}` });
        const context: AppLifecycleHookContext = {
            token: session.token,
            payload: session.payload,
            getClient: () => session.getClient(),
            metadata,
        };
        const result = await hook.handler(context);

        return c.json({ ok: true, ...(result ?? {}) } satisfies { ok: true } & AppLifecycleHookResult);
    });
}

async function executeEventHook(c: Context, requestContext: ToolContext, hook: AppEventHookDefinition) {
    const eventPayload = parseEventHookPayload(requestContext.requestBody);
    const session = await authorize(c, undefined, { toolName: `hook:${hook.name}` });
    const context = {
        token: session.token,
        payload: session.payload,
        getClient: () => session.getClient(),
    };
    const result = await hook.handler(eventPayload, context);

    return c.json({ ok: true, ...(result ?? {}) } satisfies { ok: true } & AppLifecycleHookResult);
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

function parseEventHookPayload(body: unknown): AppEventHookPayload {
    const result = AppEventHookPayloadSchema.safeParse(body);
    if (!result.success) {
        throw new HTTPException(400, { message: 'Invalid event hook payload' });
    }
    return result.data;
}
