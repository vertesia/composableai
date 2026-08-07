function names(items, selector) {
    return (items || []).map(selector).filter(Boolean).sort();
}

function hookNames(hooks) {
    if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) return [];
    const lifecycle = ['install', 'uninstall'].filter((name) => typeof hooks[name] === 'string');
    const events = names(hooks.events, (hook) => hook.name);
    return [...lifecycle, ...events].sort();
}

export function summarizeAppPackage(pkg) {
    const tools = names(pkg.tools, (tool) => tool.name);
    return {
        ui: Boolean(pkg.ui),
        settings: Boolean(pkg.settings_schema),
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
