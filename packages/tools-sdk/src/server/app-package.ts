import { AppPackage, AppPackageScope, AppWidgetInfo, CatalogInteractionRef, InCodeTypeDefinition } from "@vertesia/common";
import { Context, Hono } from "hono";
import { ToolUseContext } from "../types.js";
import { ToolServerConfig } from "./types.js";

function getRequestPayload<T>(c: Context): Promise<T | undefined> {
    return c.req.method === "POST" ? c.req.json<T>() : Promise.resolve(undefined);
}

const builders: Record<Exclude<AppPackageScope, 'all'>, (pkg: AppPackage, config: ToolServerConfig, c: Context) => Promise<void>> = {
    async tools(pkg: AppPackage, config: ToolServerConfig, c: Context) {
        const { tools: toolCollections = [], skills: skillCollections = [] } = config;

        const filterContext = await getRequestPayload<ToolUseContext>(c);

        // Aggregate all tools from all collections
        const allTools = toolCollections.flatMap(collection =>
            collection.getToolDefinitions(filterContext)
        );

        // same for skills
        const allSkills = skillCollections.flatMap(collection =>
            collection.getToolDefinitions(filterContext)
        );

        // Deduplicate by tool name (skills listed first take priority)
        const seen = new Set<string>();
        const combined = allSkills.concat(allTools);
        pkg.tools = combined.filter(tool => {
            if (seen.has(tool.name)) {
                console.warn(`[app-package] Duplicate tool name "${tool.name}", skipping`);
                return false;
            }
            seen.add(tool.name);
            return true;
        });
    },
    async interactions(pkg: AppPackage, config: ToolServerConfig) {
        const allInteractions: CatalogInteractionRef[] = [];
        for (const coll of (config.interactions || [])) {
            for (const inter of coll.interactions) {
                allInteractions.push({
                    type: "app",
                    id: coll.name + ":" + inter.name,
                    name: inter.name,
                    title: inter.title || inter.name,
                    description: inter.description,
                    tags: inter.tags || [],
                });
            }
        }
        pkg.interactions = allInteractions;
    },
    async types(pkg: AppPackage, config: ToolServerConfig) {
        const allTypes: InCodeTypeDefinition[] = [];
        for (const coll of config.types || []) {
            for (const type of coll.types) {
                allTypes.push({
                    ...type,
                    id: coll.name + ":" + type.name
                });
            }
        }
        pkg.types = allTypes;
    },
    async templates(pkg: AppPackage, config: ToolServerConfig) {
        pkg.templates = (config.templates || []).flatMap(coll => coll.templates);
    },
    async widgets(pkg: AppPackage, config: ToolServerConfig) {
        const { skills: skillCollections = [] } = config;
        const widgets: Record<string, AppWidgetInfo> = {};
        for (const coll of skillCollections) {
            for (const skill of coll.getSkillDefinitions()) {
                if (skill.widgets && skill.widgets.length > 0) {
                    widgets[skill.name] = {
                        skill: skill.name,
                        collection: coll.name,
                        url: `/widgets/${skill.widgets[0]}.js`
                    } satisfies AppWidgetInfo;
                }
            }
        }
        pkg.widgets = widgets;
    },
    async ui(pkg: AppPackage, config: ToolServerConfig, c: Context) {
        if (config.uiConfig) {
            pkg.ui = { ...config.uiConfig };
            const origin = new URL(c.req.url).origin;
            pkg.ui.src = new URL(pkg.ui.src, origin).toString();
            if (!pkg.ui.isolation) {
                pkg.ui.isolation = "shadow";
            }
        }
    },
    async settings(pkg: AppPackage, config: ToolServerConfig) {
        if (config.settings) {
            pkg.settings_schema = { ...config.settings };
        }
    },
}


async function handlePackageRequest(c: Context, config: ToolServerConfig) {
    const scope = c.req.query('scope') || 'all';
    const pkg: AppPackage = {};

    const scopes = new Set<AppPackageScope>(scope.split(',') as AppPackageScope[]);
    // TODO build pkg based on the query param scope
    if (scopes.has('all')) {
        await builders.tools(pkg, config, c);
        await builders.interactions(pkg, config, c);
        await builders.types(pkg, config, c);
        await builders.templates(pkg, config, c);
        await builders.widgets(pkg, config, c);
        await builders.ui(pkg, config, c);
        await builders.settings(pkg, config, c);
    } else {
        if (scopes.has('tools')) {
            await builders.tools(pkg, config, c);
        }
        if (scopes.has('interactions')) {
            await builders.interactions(pkg, config, c);
        }
        if (scopes.has('types')) {
            await builders.types(pkg, config, c);
        }
        if (scopes.has('templates')) {
            await builders.templates(pkg, config, c);
        }
        if (scopes.has('widgets')) {
            await builders.widgets(pkg, config, c);
        }
        if (scopes.has('ui')) {
            await builders.ui(pkg, config, c);
        }
        if (scopes.has('settings')) {
            builders.settings(pkg, config, c);
        }
    }

    return c.json(pkg);
}

export function createPackageRoute(app: Hono, basePath: string, config: ToolServerConfig) {

    app.get(basePath, (c: Context) => {
        return handlePackageRequest(c, config);
    });

    app.post(basePath, (c: Context) => {
        return handlePackageRequest(c, config);
    });

}