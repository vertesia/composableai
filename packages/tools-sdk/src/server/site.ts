import { Hono } from "hono";
import {
    activityCollectionPage,
    contentTypeCollectionPage,
    indexPage,
    interactionCollectionPage,
    skillCollectionPage,
    templateCollectionPage,
    toolCollectionPage
} from "../site/templates.js";
import { ToolServerConfig } from "./types.js";


export function createSiteRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const {
        tools = [],
        activities = [],
        interactions = [],
        types = [],
        skills = [],
        templates = [],
    } = config;

    // Index page
    app.get(`${basePath}/`, (c) => {
        return c.html(indexPage(config));
    });

    // Tool collection pages
    for (const coll of tools) {
        app.get(`${basePath}/tools/${coll.name}`, (c) => {
            return c.html(toolCollectionPage(coll));
        });
    }

    // Activity collection pages
    for (const coll of activities) {
        app.get(`${basePath}/activities/${coll.name}`, (c) => {
            return c.html(activityCollectionPage(coll));
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

    // Template collection pages
    for (const coll of templates) {
        app.get(`${basePath}/templates/${coll.name}`, (c) => {
            return c.html(templateCollectionPage(coll));
        });
    }

    // Content type collection pages
    for (const coll of types) {
        app.get(`${basePath}/types/${coll.name}`, (c) => {
            return c.html(contentTypeCollectionPage(coll));
        });
    }

}