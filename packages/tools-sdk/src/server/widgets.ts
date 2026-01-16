import { Hono } from "hono";
import { ToolServerConfig } from "./types.js";

export interface WidgetInfo {
    collection: string;
    skill: string;
    url: string;
}

export function createWidgetsRoute(app: Hono, basePath: string, config: ToolServerConfig) {

    const { skills = [] } = config;

    // GET /api/widgets - Returns all widgets from all skill collections
    app.get(basePath, (c) => {
        const url = new URL(c.req.url);

        const widgets: Record<string, WidgetInfo> = {};
        for (const coll of skills) {
            const collWidgets = coll.getWidgets();
            for (const widget of collWidgets) {
                widgets[widget.name] = {
                    collection: coll.name,
                    skill: widget.skill,
                    url: `${url.origin}/widgets/${widget.name}.js`,
                }
            }
        }

        return c.json({
            title: 'All Widgets',
            description: 'All available widgets across all skill collections',
            widgets,
        });

    });

}