import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import type { AppInstallation, AppInstallationKind, AppInstallationPayload, AppInstallationWithManifest, AppManifest, AppManifestData, PublishAppPayload } from "@vertesia/common";

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
     * Publish an existing app to a different environment.
     * @param payload
     * @returns
     */
    publish(payload: PublishAppPayload): Promise<AppManifest> {
        return this.post('/publish', { payload });
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
     * Get the apps installed for the given project.
     * @param projectId - the id of the project to get the installed apps for
     * @param kind - the kind of app installations to filter by (e.g., 'agent', 'tool', etc.)
     */
    getInstalledAppsForProject(projectId?: string, kind?: AppInstallationKind): Promise<AppInstallationWithManifest[]> {
        return this.get(`/installations/${projectId}`, {
            query: {
                kind,
            }
        });
    }

    /**
     * List the app installations of the current project.
     */
    listInstallations(): Promise<AppInstallation[]> {
        return this.get('/installation-refs');
    }


}
