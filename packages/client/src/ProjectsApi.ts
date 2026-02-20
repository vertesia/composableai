import { ApiTopic, ClientBase, ServerError } from "@vertesia/api-fetch-client";
import { AwsConfiguration, CompositeAppConfig, CompositeAppConfigPayload, GithubConfiguration, GladiaConfiguration, ICreateProjectPayload, InCodeTypeDefinition, MagicPdfConfiguration, Project, ProjectConfiguration, ProjectIntegrationListEntry, ProjectRef, ProjectToolInfo, SupportedIntegrations } from "@vertesia/common";

export default class ProjectsApi extends ApiTopic {
    constructor(parent: ClientBase) {
        super(parent, "/api/v1/projects");
    }

    list(account?: string[]): Promise<ProjectRef[]> {
        return this.get('/', { query: { account } });
    }

    retrieve(projectId: string): Promise<Project> {
        return this.get(`/${projectId}`);
    }

    create(payload: ICreateProjectPayload): Promise<Project> {
        return this.post('/', {
            payload
        });
    }

    update(projectId: string, payload: Partial<Project>): Promise<Project> {
        return this.put(`/${projectId}`, {
            payload
        });
    }

    updateConfiguration(projectId: string, payload: Partial<ProjectConfiguration>): Promise<ProjectConfiguration> {
        return this.put(`/${projectId}/configuration`, {
            payload
        });
    }

    integrations: IntegrationsConfigurationApi = new IntegrationsConfigurationApi(this);

    /**
     * List all tools available in the project with their app installation info.
     * Settings are only included for agent tokens (security: may contain API keys).
     */
    getTools(projectId: string): Promise<ProjectToolInfo[]> {
        return this.get(`/${projectId}/tools`);
    }

    /**
     * Get a specific tool by name with its app installation info.
     * Returns null if the tool is not found.
     */
    getToolByName(projectId: string, toolName: string): Promise<ProjectToolInfo | null> {
        return this.get(`/${projectId}/tools/${toolName}`).catch((err: ServerError) => {
            if (err.status === 404) {
                return null;
            }
            throw err;
        });
    }

    listAppContentTypes(projectId: string, tag?: string): Promise<InCodeTypeDefinition[]> {
        return this.get(`/${projectId}/app-types`, {
            query: { tag }
        });
    }

    getAppContentType(projectId: string, typeId: string): Promise<InCodeTypeDefinition> {
        return this.get(`/${projectId}/app-types/${typeId}`);
    }

    getCompositeAppConfiguration(projectId: string): Promise<CompositeAppConfig> {
        return this.get(`/${projectId}/composite-app`);
    }

    updateCompositeAppConfiguration(projectId: string, payload: CompositeAppConfigPayload): Promise<CompositeAppConfig> {
        return this.put(`/${projectId}/composite-app`, {
            payload
        });
    }

}

class IntegrationsConfigurationApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/");
    }

    list(projectId: string): Promise<ProjectIntegrationListEntry[]> {
        return this.get(`/${projectId}/integrations`).then(res => res.integrations);
    }

    retrieve(projectId: string, integrationId: SupportedIntegrations): Promise<GladiaConfiguration | GithubConfiguration | AwsConfiguration | MagicPdfConfiguration | undefined> {
        return this.get(`/${projectId}/integrations/${integrationId}`).catch(err => {
            if (err.status === 404) {
                return undefined;
            }
            throw err;
        });
    }

    update(projectId: string, integrationId: string, payload: any): Promise<GladiaConfiguration | GithubConfiguration> {
        return this.put(`/${projectId}/integrations/${integrationId}`, {
            payload
        });
    }

}