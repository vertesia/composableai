import { AppPackage, AppPackageScope, CatalogInteractionRef } from "@vertesia/common";
import { Context, Hono } from "hono";
import { ToolServerConfig } from "./types.js";


const builders: Record<Exclude<AppPackageScope, 'all'>, (pkg: AppPackage, config: ToolServerConfig, c: Context) => void> = {
    tools(pkg: AppPackage, config: ToolServerConfig) {
        const { tools: toolCollections = [], skills: skillCollections = [] } = config;

        // Aggregate all tools from all collections
        const allTools = toolCollections.flatMap(collection =>
            collection.getToolDefinitions()
        );

        // same for skills
        const allSkills = skillCollections.flatMap(collection =>
            collection.getToolDefinitions()
        );

        pkg.tools = allSkills.concat(allTools);
    },
    interactions(pkg: AppPackage, config: ToolServerConfig) {
        const allInteractions: CatalogInteractionRef[] = [];
        for (const coll of (config.interactions || [])) {
            for (const inter of coll.interactions) {
                allInteractions.push({
                    type: "app",
                    id: inter.name,
                    name: inter.name,
                    title: inter.title || inter.name,
                    description: inter.description,
                    tags: inter.tags || [],
                });
            }
        }
        pkg.interactions = allInteractions;
    },
    types(_pkg: AppPackage, _config: ToolServerConfig) {
        //console.warn("Package types is not yet supported");
    },
    ui(pkg: AppPackage, config: ToolServerConfig, c: Context) {
        if (config.uiConfig) {
            pkg.ui = { ...config.uiConfig };
            const origin = new URL(c.req.url).origin;
            pkg.ui.src = new URL(pkg.ui.src, origin).toString();
            if (!pkg.ui.isolation) {
                pkg.ui.isolation = "shadow";
            }
        }
    },
    settings(pkg: AppPackage, config: ToolServerConfig) {
        if (config.settings) {
            pkg.settings_schema = { ...config.settings };
        }
    },
}


export function createPackageRoute(app: Hono, basePath: string, config: ToolServerConfig) {
    const { interactions = [], tools: toolCollections = [], mcpProviders = [] } = config;

    app.get(basePath, (c: Context) => {
        const scope = c.req.query('scope') || 'all';
        const pkg: AppPackage = {};
        interactions; toolCollections; mcpProviders;

        const scopes = new Set<AppPackageScope>(scope.split(',') as AppPackageScope[]);
        // TODO build pkg based on the query param scope
        if (scopes.has('all')) {
            builders.tools(pkg, config, c);
            builders.interactions(pkg, config, c);
            builders.types(pkg, config, c);
            builders.ui(pkg, config, c);
            builders.settings(pkg, config, c);
        } else {
            if (scopes.has('tools')) {
                builders.tools(pkg, config, c);
            }
            if (scopes.has('interactions')) {
                builders.interactions(pkg, config, c);
            }
            if (scopes.has('types')) {
                builders.types(pkg, config, c);
            }
            if (scopes.has('ui')) {
                builders.ui(pkg, config, c);
            }
            if (scopes.has('settings')) {
                builders.settings(pkg, config, c);
            }
        }

        return c.json(pkg);
    });
}

