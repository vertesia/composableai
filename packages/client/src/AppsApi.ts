import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import type { AppInstallation, AppInstallationKind, AppInstallationPayload, AppInstallationWithManifest, AppManifest, AppManifestData } from "@vertesia/common";

export interface OrphanedAppInstallation extends Omit<AppInstallation, 'manifest'> {
    manifest: null,
}

export default class AppsApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/apps")
    }

    create(manifest: AppManifestData): Promise<AppManifest> {
        return this.post('/', { payload: manifest });
    }

    update(id: string, manifest: AppManifestData): Promise<AppManifest> {
        return this.put(`/${id}`, { payload: manifest });
    }

    /**
     * @param ids - ids to filter by
     * @returns the app manifests but without the agent.tool property which can be big.
     */
    list(): Promise<AppManifest[]> {
        return this.get('/');
    }

    /**
     * Install the app with the given id in the current project.
     * @param appId - the id of the app to install
     */
    install(appId: string, settings?: Record<string, any>): Promise<AppInstallation> {
        return this.post(`/install`, {
            payload: {
                app_id: appId,
                settings
            } satisfies AppInstallationPayload
        });
    }

    /**
     * Remove the given app from the current project.
     * @param installationId - the id of the app installation
     * @returns
     */
    uninstall(installationId: string) {
        return this.del(`/install/${installationId}`);
    }

    /**
     * Get the apps installed for the current authenticated project
     * @param kind - the kind of app installations to filter by (e.g., 'agent', 'tool', etc.)
     */
    getInstalledApps(kind?: AppInstallationKind): Promise<AppInstallationWithManifest[]> {
        return this.get('/installations', {
            query: {
                kind,
            }
        });
    }

    /**
     * This operation will return an array of all the found AppInstallations in the current project
     * including orphaned installations
     * This requires project admin since access is not checked on the insytallations.
     * For a user level list of available installations (with user permission check) use getInstalledApps
     * @returns 
     */
    getAllAppInstallations(): Promise<(AppInstallationWithManifest | OrphanedAppInstallation)[]> {
        return this.get('/installations/all');
    }

    /**
     * List the app installations of the current project.
     */
    listInstallations(): Promise<AppInstallation[]> {
        return this.get('/installations/refs');
    }


}
