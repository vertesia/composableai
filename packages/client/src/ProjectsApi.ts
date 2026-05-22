import { ApiTopic, type ClientBase, type ServerError } from "@vertesia/api-fetch-client";
import type {
    CompositeAppConfig,
    CompositeAppConfigPayload,
    CountResult,
    DeleteByIdResult,
    ICreateProjectPayload,
    InCodeProcessDefinition,
    InCodeTypeDefinition,
    Project,
    ProjectConfiguration,
    ProjectIntegrationConfigRequest,
    ProjectIntegrationConfigResponse,
    ProjectIntegrationListEntry,
    ProjectIntegrationListResponse,
    ProjectRef,
    ProjectToolInfo,
    RenderingTemplateDefinition,
    RenderingTemplateDefinitionRef,
    SupportedIntegrations,
} from "@vertesia/common";

export default class ProjectsApi extends ApiTopic {
    integrations: IntegrationsConfigurationApi;

    constructor(parent: ClientBase) {
        super(parent, "/api/v1/projects");
        this.integrations = new IntegrationsConfigurationApi(this);
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

    delete(projectId: string): Promise<DeleteByIdResult> {
        return this.del(`/${projectId}`);
    }

    updateConfiguration(projectId: string, payload: Partial<ProjectConfiguration>): Promise<ProjectConfiguration> {
        return this.put(`/${projectId}/configuration`, {
            payload
        });
    }

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
        return this.get<ProjectToolInfo>(`/${projectId}/tools/${toolName}`).catch((err: ServerError) => {
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

    listAppProcesses(projectId: string, tag?: string): Promise<InCodeProcessDefinition[]> {
        return this.get(`/${projectId}/app-processes`, {
            query: { tag }
        });
    }

    getAppProcess(projectId: string, processId: string): Promise<InCodeProcessDefinition> {
        return this.get(`/${projectId}/app-processes/${processId}`);
    }

    listAppRenderingTemplates(projectId: string, tag?: string): Promise<RenderingTemplateDefinitionRef[]> {
        return this.get(`/${projectId}/app-templates`, {
            query: { tag }
        });
    }

    getAppRenderingTemplate(projectId: string, templateUri: string): Promise<RenderingTemplateDefinition> {
        return this.get(`/${projectId}/app-templates/${templateUri}`);
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
        return this.get<ProjectIntegrationListResponse>(`/${projectId}/integrations`).then((res) => res.integrations);
    }

    retrieve(projectId: string, integrationId: SupportedIntegrations): Promise<ProjectIntegrationConfigResponse | undefined> {
        return this.get<ProjectIntegrationConfigResponse>(`/${projectId}/integrations/${integrationId}`).catch(err => {
            if (err.status === 404) {
                return undefined;
            }
            throw err;
        });
    }

    update(projectId: string, integrationId: string, payload: ProjectIntegrationConfigRequest): Promise<ProjectIntegrationConfigResponse> {
        return this.put(`/${projectId}/integrations/${integrationId}`, {
            payload
        });
    }

    updatePlugins(projectId: string, plugins: string[]): Promise<CountResult> {
        return this.post(`/${projectId}/plugins`, { payload: { plugins } });
    }

    listPlugins(projectId: string): Promise<string[]> {
        return this.get(`/${projectId}/plugins`);
    }

}
