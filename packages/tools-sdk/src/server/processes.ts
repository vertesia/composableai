// ================== Process Definition Endpoints ==================

import type { InCodeProcessDefinition } from "@vertesia/common";
import type { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ToolServerConfig } from "./types.js";

export function createProcessesRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const { processes = [] } = config;

    app.get(basePath, (c) => {
        return c.json({
            title: 'All Processes',
            description: 'All available process definitions',
            processes,
        });
    });

    app.get(`${basePath}/:name`, (c) => {
        const name = c.req.param('name');
        const process = findProcess(processes, name);
        if (!process) {
            throw new HTTPException(404, {
                message: `No process found with name: ${name}`,
            });
        }
        return c.json(process);
    });
}

function findProcess(processes: InCodeProcessDefinition[], name: string): InCodeProcessDefinition | undefined {
    return processes.find(process =>
        process.id === name
        || process.name === name
        || process.definition.process === name
    );
}
