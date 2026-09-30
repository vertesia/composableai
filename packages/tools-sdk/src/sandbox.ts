import type { AuthTokenPayload } from '@vertesia/common';
import { Hono } from 'hono';
import { AuthSession } from './auth.js';
import type { ToolServerConfig } from './server/types.js';
import { createToolServer as createBaseToolServer } from './server.js';

/** Browser-bundle entrypoint. Collections take bundled data; directory loaders are Node-only. */
export * from './ActivityCollection.js';
export { AuthSession, authorize } from './auth.js';
export * from './ContentTypesCollection.js';
export * from './InteractionCollection.js';
export * from './RenderingTemplateCollection.js';
export * from './SkillCollection.js';
export type { BuildAppPackageOptions } from './server/app-package.js';
export { buildAppPackage } from './server/app-package.js';
export * from './server/types.js';
/** The host supplies non-secret claims; SDK HTTP goes through the sandbox's host-mediated fetch. */
export function createToolServer(config: ToolServerConfig) {
    const app = new Hono<{
        Bindings: { sandboxSession?: AuthTokenPayload };
        Variables: { toolAuthSession: AuthSession };
    }>();
    app.use('*', async (ctx, next) => {
        const payload = ctx.env?.sandboxSession;
        if (payload) {
            ctx.set(
                'toolAuthSession',
                new AuthSession('sandbox', payload, {
                    studio: 'https://platform.invalid/studio',
                    store: 'https://platform.invalid/store',
                    token: 'https://platform.invalid/token',
                }),
            );
        }
        await next();
    });
    app.route('/', createBaseToolServer(config));
    return app;
}
export * from './site/templates.js';
export * from './ToolCollection.js';
export * from './ToolRegistry.js';
export * from './types.js';
