import { Hono } from "hono";
import {
    indexPage,
    interactionCollectionPage,
    skillCollectionPage,
    toolCollectionPage
} from "../site/templates.js";
import { ToolServerConfig } from "./types.js";


export function createSitePages(app: Hono, basePath: string, config: ToolServerConfig) {
    const {
        title = 'Tools Server',
        tools = [],
        interactions = [],
        skills = [],
        mcpProviders = [],
    } = config;

    // Index page
    app.get(`${basePath}/`, (c) => {
        return c.html(indexPage(tools, skills, interactions, mcpProviders, title));
    });

    // Tool collection pages
    for (const coll of tools) {
        app.get(`${basePath}/tools/${coll.name}`, (c) => {
            return c.html(toolCollectionPage(coll));
        });
    }

    // Skill collection pages
    for (const coll of skills) {
        app.get(`${basePath}/skills/${coll.name}`, (c) => {
            return c.html(skillCollectionPage(coll));
        });
    }

    // Interaction collection pages
    for (const coll of interactions) {
        app.get(`${basePath}/interactions/${coll.name}`, (c) => {
            return c.html(interactionCollectionPage(coll));
        });
    }

}

