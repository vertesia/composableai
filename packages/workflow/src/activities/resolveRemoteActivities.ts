import { log } from "@temporalio/activity";
import {
    AppInstallationWithManifest,
    AppPackage,
    DSLActivityExecutionPayload,
    RemoteActivityDefinition,
} from "@vertesia/common";
import { VertesiaClient } from "@vertesia/client";
import { setupActivity } from "../dsl/setup/ActivityContext.js";
import { URLValidationError, safeFetch } from "../security/ssrf.js";

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
            const pkg = await fetchActivitiesPackage(manifest.endpoint, payload.auth_token, client);
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
                const activityUrl = await resolveActivityUrl(manifest.endpoint, activity, collection, client);

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
async function fetchActivitiesPackage(endpoint: string, authToken: string, client: VertesiaClient): Promise<AppPackage> {
    const url = new URL(endpoint);
    url.searchParams.set('scope', 'activities');

    await client.apps.validateUrl(url.toString());

    const response = await safeFetch(url.toString(), {
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
 * Resolves and validates the execution URL for a remote activity.
 * If the activity has a `url` field, resolve it relative to the endpoint base.
 * Otherwise, use the collection-specific activities endpoint: `/api/activities/{collection}`.
 * Validates the resolved URL to prevent second-hop SSRF from tool server responses.
 */
async function resolveActivityUrl(endpoint: string, activity: RemoteActivityDefinition, collection: string, client: VertesiaClient): Promise<string> {
    let resolved: string;
    if (activity.url) {
        // Absolute URLs are used as-is; relative URLs are resolved against the endpoint base
        resolved = (activity.url.startsWith('http://') || activity.url.startsWith('https://'))
            ? activity.url
            : new URL(activity.url, endpoint).toString();
    } else {
        // Default: POST to the collection-specific activities endpoint
        const base = new URL(endpoint);
        const activitiesPath = base.pathname.replace(/\/package\/?$/, `/activities/${collection}`);
        resolved = new URL(activitiesPath, base.origin).toString();
    }

    // Validate the resolved URL via Studio — safeFetch on the discovery request does NOT protect this
    // second-hop URL which comes from the tool server response body.
    try {
        await client.apps.validateUrl(resolved);
    } catch (e) {
        throw new URLValidationError(`Blocked activity URL from app response: ${(e as Error).message}`);
    }

    return resolved;
}
