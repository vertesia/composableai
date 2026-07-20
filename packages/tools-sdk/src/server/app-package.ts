import type {
    AppDashboardDefinition,
    AppPackage,
    AppPackageScope,
    AppWidgetInfo,
    CatalogInteractionRef,
    InCodeProcessDefinition,
    InCodeTypeDefinition,
    RemoteActivityDefinition,
} from '@vertesia/common';
import type { Context, Hono } from 'hono';
import type { ToolUseContext } from '../types.js';
import type { ToolServerConfig } from './types.js';

function getRequestPayload<T>(c: Context): Promise<T | undefined> {
    return c.req.method === 'POST' ? c.req.json<T>() : Promise.resolve(undefined);
}

export interface BuildAppPackageOptions {
    scope?: AppPackageScope | AppPackageScope[] | string;
    origin?: string;
    toolUseContext?: ToolUseContext;
}

type AppPackageBuilder = (pkg: AppPackage, config: ToolServerConfig, options: BuildAppPackageOptions) => Promise<void>;

const builders: Record<Exclude<AppPackageScope, 'all'>, AppPackageBuilder> = {
    async tools(pkg: AppPackage, config: ToolServerConfig, options: BuildAppPackageOptions) {
        const { tools: toolCollections = [], skills: skillCollections = [] } = config;

        const filterContext = options.toolUseContext;

        // Aggregate all tools from all collections
        const allTools = toolCollections.flatMap((collection) => collection.getToolDefinitions(filterContext));

        // same for skills
        const allSkills = skillCollections.flatMap((collection) => collection.getToolDefinitions(filterContext));

        // Deduplicate by tool name (skills listed first take priority)
        const seen = new Set<string>();
        const combined = allSkills.concat(allTools);
        pkg.tools = combined.filter((tool) => {
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
        for (const coll of config.interactions || []) {
            for (const inter of coll.interactions) {
                allInteractions.push({
                    type: 'app',
                    id: `${coll.name}:${inter.name}`,
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
        // A type's public id is its BARE name: stored objects reference it as the portable
        // `app:<app>:<type>` string, so the in-code collection (a code-organization grouping,
        // unlike tool/skill collections which are semantic) must NOT leak into the id.
        // Names must therefore be unique across collections — fail the package build otherwise.
        const allTypes: InCodeTypeDefinition[] = [];
        const seen = new Map<string, string>();
        for (const coll of config.types || []) {
            for (const type of coll.types) {
                const existing = seen.get(type.name);
                if (existing) {
                    throw new Error(
                        `Duplicate content type name '${type.name}' (collections '${existing}' and '${coll.name}'). ` +
                            `Type names must be unique across collections so the portable 'app:<app>:${type.name}' ref resolves.`,
                    );
                }
                seen.set(type.name, coll.name);
                allTypes.push({ ...type, id: type.name });
            }
        }
        pkg.types = allTypes;
    },
    async processes(pkg: AppPackage, config: ToolServerConfig) {
        const allProcesses: InCodeProcessDefinition[] = [];
        for (const process of config.processes || []) {
            allProcesses.push(process);
        }
        pkg.processes = allProcesses;
    },
    async views(pkg: AppPackage, config: ToolServerConfig) {
        pkg.views = [...(config.views ?? [])];
    },
    async templates(pkg: AppPackage, config: ToolServerConfig) {
        const basePath = `${config.prefix || '/api'}/templates`;
        pkg.templates = (config.templates || []).flatMap((coll) =>
            coll.templates.map(({ instructions: _, ...ref }) => ({
                ...ref,
                path: `${basePath}/${coll.name}/${ref.name}`,
            })),
        );
    },
    async dashboards(pkg: AppPackage, config: ToolServerConfig) {
        const seen = new Set<string>();
        const dashboards: AppDashboardDefinition[] = [];
        for (const dashboard of config.dashboards || []) {
            if (seen.has(dashboard.id)) {
                console.warn(`[app-package] Duplicate dashboard id "${dashboard.id}", skipping`);
                continue;
            }
            seen.add(dashboard.id);
            dashboards.push(dashboard);
        }
        pkg.dashboards = dashboards;
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
                        url: `/widgets/${skill.widgets[0]}.js`,
                    } satisfies AppWidgetInfo;
                }
            }
        }
        pkg.widgets = widgets;
    },
    async ui(pkg: AppPackage, config: ToolServerConfig, options: BuildAppPackageOptions) {
        if (config.uiConfig) {
            pkg.ui = { ...config.uiConfig };
            const origin = options.origin || 'http://localhost';
            pkg.ui.src = new URL(pkg.ui.src, origin).toString();
            if (!pkg.ui.isolation) {
                pkg.ui.isolation = 'shadow';
            }
        }
    },
    async settings(pkg: AppPackage, config: ToolServerConfig) {
        if (config.settings) {
            pkg.settings_schema = { ...config.settings };
        }
    },
    async activities(pkg: AppPackage, config: ToolServerConfig) {
        const allActivities: RemoteActivityDefinition[] = [];
        for (const coll of config.activities || []) {
            for (const def of coll.getActivityDefinitions()) {
                allActivities.push({ ...def, collection: coll.name });
            }
        }
        pkg.activities = allActivities;
    },
};

function normalizeScopes(scope: BuildAppPackageOptions['scope']): Set<AppPackageScope> {
    const values = Array.isArray(scope) ? scope : typeof scope === 'string' ? scope.split(',') : [scope || 'all'];
    return new Set(values.filter(Boolean) as AppPackageScope[]);
}

export async function buildAppPackage(
    config: ToolServerConfig,
    options: BuildAppPackageOptions = {},
): Promise<AppPackage> {
    const pkg: AppPackage = {};

    const scopes = normalizeScopes(options.scope);
    if (scopes.has('all')) {
        await builders.tools(pkg, config, options);
        await builders.interactions(pkg, config, options);
        await builders.types(pkg, config, options);
        await builders.processes(pkg, config, options);
        await builders.views(pkg, config, options);
        await builders.templates(pkg, config, options);
        await builders.dashboards(pkg, config, options);
        await builders.widgets(pkg, config, options);
        await builders.ui(pkg, config, options);
        await builders.settings(pkg, config, options);
        await builders.activities(pkg, config, options);
    } else {
        if (scopes.has('tools')) {
            await builders.tools(pkg, config, options);
        }
        if (scopes.has('interactions')) {
            await builders.interactions(pkg, config, options);
        }
        if (scopes.has('types')) {
            await builders.types(pkg, config, options);
        }
        if (scopes.has('processes')) {
            await builders.processes(pkg, config, options);
        }
        if (scopes.has('views')) {
            await builders.views(pkg, config, options);
        }
        if (scopes.has('templates')) {
            await builders.templates(pkg, config, options);
        }
        if (scopes.has('dashboards')) {
            await builders.dashboards(pkg, config, options);
        }
        if (scopes.has('widgets')) {
            await builders.widgets(pkg, config, options);
        }
        if (scopes.has('ui')) {
            await builders.ui(pkg, config, options);
        }
        if (scopes.has('settings')) {
            await builders.settings(pkg, config, options);
        }
        if (scopes.has('activities')) {
            await builders.activities(pkg, config, options);
        }
    }

    return pkg;
}

async function handlePackageRequest(c: Context, config: ToolServerConfig) {
    const pkg = await buildAppPackage(config, {
        scope: c.req.query('scope') || 'all',
        origin: new URL(c.req.url).origin,
        toolUseContext: await getRequestPayload<ToolUseContext>(c),
    });
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
