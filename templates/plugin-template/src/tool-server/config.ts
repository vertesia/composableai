import type { ToolServerConfig } from '@vertesia/tools-sdk';
import {
    activities,
    dashboards,
    interactions,
    processes,
    skills,
    templates,
    tools,
    types,
} from './app-server-modules.js';
import { mcpProviders } from './mcp/index.js';
import settingsSchema from './settings.js';
import uiNavItems from './ui-nav-items.js';

const CONFIG__SERVER_TITLE = 'Tool Server Template';
export const ServerConfig = {
    disableHtml: true,
    title: CONFIG__SERVER_TITLE,
    prefix: '/api',
    tools,
    activities,
    interactions,
    types,
    processes,
    dashboards,
    skills,
    templates,
    mcpProviders,
    uiConfig: {
        isolation: 'shadow',
        src: '/lib/plugin.js',
        available_in: ['app_portal', 'composite_app'],
        navigation: uiNavItems, // optional navigation configuration for the Composite App sidebar
    },
    settings: settingsSchema, // change this to point to your settings JSON schema
} satisfies ToolServerConfig;
