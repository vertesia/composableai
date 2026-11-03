import { type AppManifestData, type Endpoints, normalizeToolCollection } from '@vertesia/common';
import { parseGatewayAppEndpoint, resolveAppEndpoint, resolveAppResource } from '@vertesia/studio-utils/apps';

type WidgetSourceManifest = Pick<
    AppManifestData,
    'endpoint' | 'endpoint_overrides' | 'capabilities' | 'tool_collections'
>;

/** Where to read the skill widgets of an installed tool app. */
export type SkillWidgetSource =
    /**
     * An App Gateway app's package descriptor. The gateway hides private apps from anonymous callers, so the
     * request carries the user's token, but only when the descriptor is on the configured gateway origin.
     */
    | { type: 'package'; url: string; authenticated: boolean }
    /** Any other tool server: its public `/api/widgets` route. */
    | { type: 'widgets'; url: string };

/**
 * The sources listing the skill widgets of the installed tool apps.
 *
 * App Gateway apps are mounted under a path (`/tenants/<t>/apps/<a>`) on dev branches and under their own
 * hostname on the production tiers, and do not serve `/api/widgets` unless they run a service. Their widgets
 * are read from the package descriptor instead, whose widget URLs the gateway remounts under the app.
 * Other tool servers keep serving `/api/widgets` next to their package endpoint.
 */
export function skillWidgetSources(manifests: WidgetSourceManifest[], vars?: Endpoints): SkillWidgetSource[] {
    const sources = new Map<string, SkillWidgetSource>();
    for (const manifest of manifests) {
        for (const item of manifest.tool_collections ?? []) {
            const collUrl = normalizeToolCollection(item, vars).url;
            if (collUrl.startsWith('http://') || collUrl.startsWith('https://')) {
                const i = collUrl.indexOf('/api/');
                if (i > 0) {
                    addSource(sources, `${collUrl.substring(0, i)}/api/package`, vars);
                }
            }
        }
        if (manifest.endpoint && manifest.capabilities?.includes('tools')) {
            addSource(sources, resolveAppEndpoint(manifest, { vars }), vars);
        }
    }
    return Array.from(sources.values());
}

function addSource(sources: Map<string, SkillWidgetSource>, packageEndpoint: string | undefined, vars?: Endpoints) {
    if (!packageEndpoint) return;
    try {
        if (parseGatewayAppEndpoint(packageEndpoint)) {
            const url = new URL(packageEndpoint);
            url.searchParams.set('scope', 'widgets');
            const authenticated = !!vars?.gateway && url.origin === new URL(vars.gateway).origin;
            sources.set(url.toString(), { type: 'package', url: url.toString(), authenticated });
        } else {
            const url = new URL(resolveAppResource(packageEndpoint, 'widgets')).toString();
            sources.set(url, { type: 'widgets', url });
        }
    } catch {
        // An unresolved `{{placeholder}}` endpoint: this app's widgets cannot be located.
    }
}

/**
 * Maps each widget name (the code block language it renders) to an absolute module URL. Package descriptors
 * carry root-relative widget URLs, resolved here against the origin that served them.
 */
export function parseSkillWidgets(data: unknown, sourceUrl: string): Record<string, string> {
    const widgets = (data as { widgets?: Record<string, { url?: unknown } | undefined> } | undefined)?.widgets;
    const out: Record<string, string> = {};
    for (const [name, info] of Object.entries(widgets ?? {})) {
        if (typeof info?.url === 'string' && info.url) {
            out[name] = new URL(info.url, sourceUrl).toString();
        }
    }
    return out;
}
