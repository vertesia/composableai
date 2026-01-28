import { ToolServerConfig } from "@vertesia/tools-sdk";
import { interactions } from "./interactions/index.js";
import { mcpProviders } from "./mcp/index.js";
import { skills } from "./skills/index.js";
import { tools } from "./tools/index.js";

const CONFIG__SERVER_TITLE = "Tool Server Template";
export const ServerConfig = {
    disableHtml: true,
    title: CONFIG__SERVER_TITLE,
    prefix: '/api',
    tools,
    interactions,
    skills,
    mcpProviders
} satisfies ToolServerConfig;
