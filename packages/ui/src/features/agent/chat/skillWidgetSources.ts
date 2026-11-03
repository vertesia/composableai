import { type AppManifestData, type Endpoints, normalizeToolCollection } from '@vertesia/common';
import { parseGatewayAppEndpoint, resolveAppEndpoint, resolveAppResource } from '@vertesia/studio-utils/apps';

type WidgetSourceManifest = Pick<
    AppManifestData,
    'endpoint' | 'endpoint_overrides' | 'capabilities' | 'tool_collections'
>;

/**
 * The URLs listing the skill widgets of the installed tool apps.
 *
 * App Gateway apps are mounted under a path (`/tenants/<t>/apps/<a>`) on dev branches and under their own
 * hostname on the production tiers, and do not serve `/api/widgets` unless they run a service. Their widgets
 * are read from the public package descriptor instead, whose widget URLs the gateway remounts under the app.
 * Other tool servers keep serving `/api/widgets` next to their package endpoint.
 */
export function skillWidgetSourceUrls(manifests: WidgetSourceManifest[], vars?: Endpoints): string[] {
    const urls = new Set<string>();
    for (const manifest of manifests) {
        for (const item of manifest.tool_collections ?? []) {
            const collUrl = normalizeToolCollection(item, vars).url;
            if (collUrl.startsWith('http://') || collUrl.startsWith('https://')) {
                const i = collUrl.indexOf('/api/');
                if (i > 0) {
                    addSource(urls, `${collUrl.substring(0, i)}/api/package`);
                }
            }
        }
        if (manifest.endpoint && manifest.capabilities?.includes('tools')) {
            addSource(urls, resolveAppEndpoint(manifest, { vars }));
        }
    }
    return Array.from(urls);
}

function addSource(urls: Set<string>, packageEndpoint: string | undefined): void {
    if (!packageEndpoint) return;
    try {
        if (parseGatewayAppEndpoint(packageEndpoint)) {
            const url = new URL(packageEndpoint);
            url.searchParams.set('scope', 'widgets');
            urls.add(url.toString());
        } else {
            urls.add(new URL(resolveAppResource(packageEndpoint, 'widgets')).toString());
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
