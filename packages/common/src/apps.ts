
export interface AppUIConfig {
    /**
     * The source URL of the app. The src can be a template which contain
     * a variable named `buildId` which will be replaced with the current build id.
     * For example: `/plugins/vertesia-review-center-${buildId}`
     */
    src: string;
    /**
     * Whether the app should be loaded as part of the host layout
     * or in a new tab.
     */
    external?: boolean;
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

    status: "beta" | "stable" | "deprecated" | "hidden"

    ui?: AppUIConfig

    /**
     * A list of tool collections endpoints to be used by this app.
     * A tools collection endpoint is an URL which may end with a `?import` query string.
     * If the `?import` query string is used the tool will be imported as a javascript module and not executed through a POST on the collections endpoint.
     */
    tool_collections?: string[]
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
