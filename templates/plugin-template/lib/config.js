import { interactions } from './interactions/index.js';
import { mcpProviders } from './mcp/index.js';
import { skills } from './skills/index.js';
import { tools } from './tools/index.js';
import { types } from './types/index.js';
import settingsSchema from './settings.js';

const CONFIG__SERVER_TITLE = "Tool Server Template";
const ServerConfig = {
    disableHtml: true,
    title: CONFIG__SERVER_TITLE,
    prefix: '/api',
    tools,
    interactions,
    types,
    skills,
    mcpProviders,
    uiConfig: {
        isolation: "shadow",
        src: "/lib//plugin.js",
    },
    settings: settingsSchema,
};

export { ServerConfig };
//# sourceMappingURL=config.js.map
