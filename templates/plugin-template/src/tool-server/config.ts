import { ToolServerConfig } from "@vertesia/tools-sdk";
import { interactions } from "./interactions/index.js";
import { mcpProviders } from "./mcp/index.js";
import { skills } from "./skills/index.js";
import { templates } from "./templates/index.js";
import { tools } from "./tools/index.js";
import { types } from "./types/index.js";
import settingsSchema from "./settings.js";

const CONFIG__SERVER_TITLE = "Tool Server Template";
export const ServerConfig = {
    disableHtml: true,
    title: CONFIG__SERVER_TITLE,
    prefix: '/api',
    tools,
    interactions,
    types,
    skills,
    templates,
    mcpProviders,
    uiConfig: {
        isolation: "shadow",
        src: "/lib//plugin.js",
    },
    settings: settingsSchema, // change this to point to your settings JSON schema
} satisfies ToolServerConfig;
