import { log } from "@temporalio/activity";
import {
    AppInstallationWithManifest,
    AppPackage,
    DSLActivityExecutionPayload,
    RemoteActivityDefinition,
} from "@vertesia/common";
import { setupActivity } from "../dsl/setup/ActivityContext.js";

/** Prefix identifying a remote activity name in DSL workflow steps */
const REMOTE_ACTIVITY_PREFIX = "app:";

/**
 * Information about a resolved remote activity.
 */
export interface RemoteActivityInfo {
    /** The resolved execution URL for this activity */
    url: string;
    /** The activity name as known by the tool server (unprefixed) */
    activity_name: string;
    /** The app installation ID */
    app_install_id: string;
    /** The app name */
    app_name: string;
    /** The app installation settings */
    app_settings?: Record<string, any>;
    /** The activity definition from the tool server */
    definition: RemoteActivityDefinition;
}

/**
 * Map of remote activity qualified names to their remote info.
 * Key format: `app:<app_name>:<collection>:<activity_name>`
 */
export type RemoteActivityMap = Record<string, RemoteActivityInfo>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ResolveRemoteActivitiesParams {}

/**
 * Resolves remote activities from all installed apps that have the `tools` capability.
 * For each app with an endpoint, fetches `?scope=activities` to discover available activities.
 * Returns a map keyed by qualified names (`app:<app_name>:<collection>:<activity_name>`).
 */
export async function resolveRemoteActivities(
    payload: DSLActivityExecutionPayload<ResolveRemoteActivitiesParams>,
): Promise<RemoteActivityMap> {
    const ctx = await setupActivity<ResolveRemoteActivitiesParams>(payload);
    const { client } = ctx;

    const map: RemoteActivityMap = {};

    let installations: AppInstallationWithManifest[];
    try {
        installations = await client.apps.getInstalledApps("tools");
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn("Failed to fetch installed apps for remote activities", { error: message });
        return map;
    }

    for (const install of installations) {
        const manifest = install.manifest;
        if (!manifest.endpoint) {
            continue;
        }

        try {
            const pkg = await fetchActivitiesPackage(manifest.endpoint, payload.auth_token);
            if (!pkg.activities || pkg.activities.length === 0) {
                continue;
            }

            for (const activity of pkg.activities) {
                const collection = activity.collection;
                if (!collection) {
                    log.warn("Remote activity missing collection, skipping", {
                        app: manifest.name,
                        activity: activity.name,
                    });
                    continue;
                }

                // Build qualified name: app:<app_name>:<collection>:<activity_name>
                const qualifiedName = `${REMOTE_ACTIVITY_PREFIX}${manifest.name}:${collection}:${activity.name}`;

                if (map[qualifiedName]) {
                    log.warn("Duplicate remote activity name, skipping", {
                        qualifiedName,
                        existingApp: map[qualifiedName].app_name,
                        newApp: manifest.name,
                    });
                    continue;
                }

                // Resolve the activity execution URL (collection-specific endpoint)
                const activityUrl = resolveActivityUrl(manifest.endpoint, activity, collection);

                map[qualifiedName] = {
                    url: activityUrl,
                    activity_name: activity.name,
                    app_install_id: install.id,
                    app_name: manifest.name,
                    app_settings: install.settings,
                    definition: activity,
                };
            }

            log.info("Resolved remote activities from app", {
                app: manifest.name,
                count: pkg.activities.length,
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            log.warn("Failed to fetch activities from app, skipping", {
                app: manifest.name,
                endpoint: manifest.endpoint,
                error: message,
            });
        }
    }

    return map;
}

/**
 * Fetches the activities scope from a tool server package endpoint.
 */
async function fetchActivitiesPackage(endpoint: string, authToken: string): Promise<AppPackage> {
    const url = new URL(endpoint);
    url.searchParams.set('scope', 'activities');

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${authToken}`,
        },
        signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<AppPackage>;
}

/**
 * Resolves the execution URL for a remote activity.
 * If the activity has a `url` field, resolve it relative to the endpoint base.
 * Otherwise, use the collection-specific activities endpoint: `/api/activities/{collection}`.
 */
function resolveActivityUrl(endpoint: string, activity: RemoteActivityDefinition, collection: string): string {
    if (activity.url) {
        // Resolve relative URLs against the endpoint origin
        if (activity.url.startsWith('http://') || activity.url.startsWith('https://')) {
            return activity.url;
        }
        const base = new URL(endpoint);
        return new URL(activity.url, base.origin).toString();
    }
    // Default: POST to the collection-specific activities endpoint
    const base = new URL(endpoint);
    const activitiesPath = base.pathname.replace(/\/package\/?$/, `/activities/${collection}`);
    return new URL(activitiesPath, base.origin).toString();
}
