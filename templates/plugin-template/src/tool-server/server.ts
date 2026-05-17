import type { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { createToolServer } from "@vertesia/tools-sdk";
import { ServerConfig } from "./config.js";

// Create server using tools-sdk
const server: Hono = createToolServer(ServerConfig);

const staticFile = serveStatic({ root: "./dist" });
const appShell = serveStatic({ root: "./dist", path: "app/index.html" });

function shouldServeAppShell(path: string, method: string): boolean {
    if (method !== "GET" && method !== "HEAD") {
        return false;
    }
    if (path.startsWith("/api")) {
        return false;
    }
    return !/\.[^/]+$/.test(path);
}

server.all("*", async (c, next) => {
    if (c.req.path.startsWith("/api")) {
        return next();
    }

    const response = await staticFile(c, async () => undefined);
    if (response) {
        return response;
    }

    if (shouldServeAppShell(c.req.path, c.req.method)) {
        return appShell(c, next);
    }

    return next();
});

export default server;
