import type { ToolServerConfig } from '@vertesia/tools-sdk';
import {
    activities,
    dashboards,
    hooks,
    interactions,
    mcpProviders,
    processes,
    skills,
    subscriptions,
    templates,
    tools,
    types,
    views,
} from './app-server-modules.js';
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
    // In-code View Experiences. Studio contributes each as `app:<app-name>:<view-id>`
    // and renders it via the `/view/<id>` route or the `<ViewExperience>` component.
    views,
    hooks,
    subscriptions,
    mcpProviders,
    uiConfig: {
        isolation: 'iframe',
        src: '/app/',
        // Where this app's UI can be shown: the standalone App Portal, the Composite App shell, or both.
        available_in: ['app_portal', 'composite_app'],
        // Sidebar entries contributed to the Composite App shell. Keep in sync with the app's routes.
        navigation: uiNavItems,
    },
    settings: settingsSchema, // change this to point to your settings JSON schema
} satisfies ToolServerConfig;
