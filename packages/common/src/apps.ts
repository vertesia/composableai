import { JSONSchema } from "@llumiverse/common";

export interface AppUIConfig {
    /**
     * The source URL of the app. The src can be a template which contain
     * a variable named `buildId` which will be replaced with the current build id.
     * For example: `/plugins/vertesia-review-center-${buildId}`
     */
    src: string;
    /**
     * The isolation strategy. If not specified it defaults to shadow 
     * - shadow - use Shadow DOM to fully isolate the plugin from the host.
     * - css - use CSS processing (like prefixing or other isolation techniques). Ligther but plugins may conflict with the host
     */
    isolation?: "shadow" | "css";
}

export interface AppManifestData {
    /**
     * The name of the app, used as the id in the system.
     * Must be in kebab case (e.g. my-app).
     */
    name: string;

    /**
     * Whether the app is private to the owner account.
     * If true the account property must be defined.
     */
    private: boolean;

    title: string;
    description: string;
    publisher: string;

    /**
     * A svg icon for the app.
     */
    icon?: string;

    status: "beta" | "stable" | "deprecated"

    ui?: AppUIConfig

    /**
     * A list of tool collections endpoints to be used by this app.
     * A tools collection endpoint is an URL which may end with a `?import` query string.
     * If the `?import` query string is used the tool will be imported as a javascript module and not executed through a POST on the collections endpoint.
     */
    tool_collections?: string[]

    /**
     * An URL providing interactions definitions in JSON format.
     * GET interactions_url should return a JSON object with the interactions definitions.
     * GET `${interactions_url}/${endpoint}` should return a JSON object with the interaction definition for the specified endpoint.
     */
    interactions?: string;

    /**
     * A JSON chema for the app installation settings.
     */
    settings_schema?: JSONSchema;
}
export interface AppManifest extends AppManifestData {
    id: string;
    account: string;
    created_at: string;
    updated_at: string;
}

export interface AppInstallation {
    id: string;
    project: string; // the project where the app is installed
    manifest: string; // the app manifest
    settings?: Record<string, any>; // settings for the app installation
    created_at: string;
    updated_at: string;
}

export interface AppInstallationWithManifest extends Omit<AppInstallation, 'manifest'> {
    manifest: AppManifest; // the app manifest data
}

export interface AppInstallationPayload {
    app_id: string,
    settings?: Record<string, any>
}

export type AppInstallationKind = 'ui' | 'tools' | 'all';

/**
 * A descriptiojn of the tools provided by an app
 */
export interface AppToolCollection {
    /**
     * The collection name
     */
    name: string;

    /**
     * Optional collection description
     */
    description?: string;

    /**
     * the tools provided by this collection
     */
    tools: { name: string, description?: string }[]
}
