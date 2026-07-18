import type { InCodeViewDefinition } from '@vertesia/common';
import type { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ToolServerConfig } from './types.js';

export function createViewsRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const { views = [] } = config;

    app.get(basePath, (c) => {
        return c.json({
            title: 'All Views',
            description: 'All available View Experience definitions',
            views,
        });
    });

    app.get(`${basePath}/:name`, (c) => {
        const name = c.req.param('name');
        const view = findView(views, name);
        if (!view) {
            throw new HTTPException(404, {
                message: `No View found with name: ${name}`,
            });
        }
        return c.json(view);
    });
}

function findView(views: InCodeViewDefinition[], name: string): InCodeViewDefinition | undefined {
    return views.find((view) => view.id === name || view.name === name);
}
