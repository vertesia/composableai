function names(items, selector) {
    return (items || []).map(selector).filter(Boolean).sort();
}

function hookNames(hooks) {
    if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) return [];
    const lifecycle = ['install', 'uninstall'].filter((name) => typeof hooks[name] === 'string');
    const events = names(hooks.events, (hook) => hook.name);
    return [...lifecycle, ...events].sort();
}

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function appgenTemplateMetadata(packageJson) {
    const metadata = packageJson?.['vertesia-appgen'];
    if (metadata === undefined) return undefined;
    if (!isRecord(metadata)) throw new Error('package.json vertesia-appgen must be an object');

    const { name, version, runtime_features: runtimeFeatures } = metadata;
    if (typeof name !== 'string' || !name.trim()) {
        throw new Error('package.json vertesia-appgen.name must be a non-empty string');
    }
    if (!Number.isInteger(version) || version < 1) {
        throw new Error('package.json vertesia-appgen.version must be a positive integer');
    }
    if (!isRecord(runtimeFeatures)) {
        throw new Error('package.json vertesia-appgen.runtime_features must be an object');
    }

    const normalizedFeatures = {};
    for (const [feature, protocolVersion] of Object.entries(runtimeFeatures)) {
        if (!/^[a-z][a-z0-9_]*$/.test(feature)) {
            throw new Error(`package.json vertesia-appgen.runtime_features contains invalid feature "${feature}"`);
        }
        if (!Number.isInteger(protocolVersion) || protocolVersion < 1) {
            throw new Error(`package.json vertesia-appgen.runtime_features.${feature} must be a positive integer`);
        }
        normalizedFeatures[feature] = protocolVersion;
    }

    return { name: name.trim(), version, runtime_features: normalizedFeatures };
}

export function summarizeAppPackage(pkg, packageJson) {
    const tools = names(pkg.tools, (tool) => tool.name);
    const appgenTemplate = appgenTemplateMetadata(packageJson);
    return {
        ...(appgenTemplate ? { appgen_template: appgenTemplate } : {}),
        oauth_scopes: pkg.oauth_scopes ?? [],
        ui: Boolean(pkg.ui),
        settings: Boolean(pkg.settings_schema),
        ...(pkg.settings_schema ? { settings_schema: pkg.settings_schema } : {}),
        tools: tools.filter((name) => !name.startsWith('learn_')),
        skills: tools.filter((name) => name.startsWith('learn_')),
        interactions: names(pkg.interactions, (interaction) => interaction.id || interaction.name),
        types: names(pkg.types, (type) => type.id || type.name),
        processes: names(pkg.processes, (process) => process.id || process.name),
        views: names(pkg.views, (view) => view.id || view.name),
        templates: names(pkg.templates, (template) => template.id || template.name || template.path),
        dashboards: names(pkg.dashboards, (dashboard) => dashboard.id || dashboard.name),
        widgets: Object.keys(pkg.widgets || {}).sort(),
        activities: names(pkg.activities, (activity) =>
            activity.collection ? `${activity.collection}:${activity.name}` : activity.name,
        ),
        hooks: hookNames(pkg.hooks),
        subscriptions: names(pkg.subscriptions, (subscription) => subscription.id),
    };
}
