import type { ToolServerConfig } from '@vertesia/tools-sdk';
import { activities } from './activities/index.js';
import { interactions } from './interactions/index.js';
import { mcpProviders } from './mcp/index.js';
import { processes } from './processes/index.js';
import settingsSchema from './settings.js';
import { skills } from './skills/index.js';
import { templates } from './templates/index.js';
import { tools } from './tools/index.js';
import { types } from './types/index.js';
import uiNavItems from './ui-nav-items.js';

const CONFIG__SERVER_TITLE = 'Content App Template';
export const ServerConfig = {
    disableHtml: true,
    title: CONFIG__SERVER_TITLE,
    prefix: '/api',
    tools,
    activities,
    interactions,
    types,
    processes,
    skills,
    templates,
    mcpProviders,
    uiConfig: {
        isolation: 'shadow',
        src: '/lib/plugin.js',
        available_in: ['app_portal', 'composite_app'],
        navigation: uiNavItems,
    },
    settings: settingsSchema,
} satisfies ToolServerConfig;
