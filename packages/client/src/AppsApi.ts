import { ApiTopic, ClientBase, ServerError } from "@vertesia/api-fetch-client";
import type { AppInstallation, AppInstallationKind, AppInstallationPayload, AppInstallationWithManifest, AppManifest, AppManifestData, AppToolCollection, ProjectRef, RequireAtLeastOne } from "@vertesia/common";

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
     * Get the list if tools provided by the given app.
     * @param appId 
     * @returns 
     */
    listAppInstallationTools(appInstallId: string): Promise<AppToolCollection[]> {
        return this.get(`/installations/${appInstallId}/tools`)
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
     * get an app unstallation given its name or null if the app is not installed
     * @returns 
     */
    getAppInstallationByName(appName: string): Promise<AppInstallationWithManifest | null> {
        return this.get(`/installations/name/${appName}`).catch((err: ServerError) => {
            if (err.status === 404) {
                return null;
            } else {
                throw err;
            }
        })
    }

    /**
     * Get the project refs where the application is visible by the current user.
     * The application is specified either by id or by name.
     * @param param0 
     * @returns 
     */
    getAppInstallationProjects(app: RequireAtLeastOne<{ id?: string, name?: string }, 'id' | 'name'>): Promise<ProjectRef[]> {
        if (!app.id && !app.name) {
            throw new Error("Invalid arguments: appId or appName must be specified");
        }
        const query = app.id ? {
            id: app.id
        } : {
            name: app.name
        }
        return this.get("/installations/projects", {
            query
        });
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

    updateInstallationSettings(settingsPayload: AppInstallationPayload): Promise<AppInstallationWithManifest> {
        return this.put(`/installations/settings/${settingsPayload.app_id}`, {
            payload: {
                app_id: settingsPayload.app_id,
                settings: settingsPayload.settings
            } satisfies AppInstallationPayload
        });
    }

}
