import { AppDashboardDefinition } from "@vertesia/common";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { ToolServerConfig } from "./types.js";

export function createDashboardsRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const { dashboards = [] } = config;

    app.get(basePath, (c) => {
        return c.json({
            title: 'All Dashboards',
            description: 'All available dashboard definitions',
            dashboards,
        });
    });

    app.get(`${basePath}/:id`, (c) => {
        const id = c.req.param('id');
        const dashboard = findDashboard(dashboards, id);
        if (!dashboard) {
            throw new HTTPException(404, {
                message: "No dashboard found with id: " + id,
            });
        }
        return c.json(dashboard);
    });
}

function findDashboard(dashboards: AppDashboardDefinition[], id: string): AppDashboardDefinition | undefined {
    return dashboards.find(dashboard =>
        dashboard.id === id
        || dashboard.name === id
        || dashboard.title === id
    );
}
