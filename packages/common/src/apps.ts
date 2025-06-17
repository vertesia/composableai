import { ToolDefinition } from "@llumiverse/common";

export interface AppManifestData {
    /**
     * The name of the app, used as the id in the system.
     * Must be in kebab case (e.g. my-app).
     */
    name: string;

    /**
     * Which account is ownning the app.
     * The property is defined only for customer apps.
     * THis is always undefined for vertesia apps.
     */
    account?: string;

    /**
     * Whether the app is private to the owner account.
     * If true the account property must be defined.
     */
    private: boolean;

    title: string;
    description: string;
    version: string;
    publisher: string;

    /**
     * A svg icon for the app.
     */
    icon?: string;

    status: "beta" | "stable" | "deprecated" | "hidden"


    ui?: {
        /**
         * The source URL of the app.
         */
        src: string;
        /**
         * Whether the app should be loaded as part of the host layout
         * or in a new tab.
         */
        external?: boolean;
    }

    agent?: {
        /**
         * The source URL of the agent plugin.
         */
        src: string;
        /**
         * The definitions of the tools exported by the app.
         * The definition can also be fetched form `GET src`
         */
        tools: ToolDefinition[];
    }
}
export interface AppManifest extends AppManifestData {
    id: string;
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
    manifest_data: AppManifest; // the app manifest data
}

export interface AppInstallationPayload {
    app_id: string,
    settings?: Record<string, any>
}

export type AppInstallationKind = 'ui' | 'agent' | 'all';
