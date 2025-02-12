import { ApiTopic, ClientBase } from "@vertesia/api-fetch-client";
import { AwsConfiguration, GithubConfiguration, GladiaConfiguration, ICreateProjectPayload, MacgicPdfConfiguration, Project, ProjectIntegrationListEntry, ProjectRef, SupportedIntegrations } from "@vertesia/common";

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

    integrations: IntegrationsConfigurationApi = new IntegrationsConfigurationApi(this);

}

class IntegrationsConfigurationApi extends ApiTopic {

    constructor(parent: ClientBase) {
        super(parent, "/");
    }

    list(projectId: string): Promise<ProjectIntegrationListEntry[]> {
        return this.get(`/${projectId}/integrations`).then(res => res.integrations);
    }

    retrieve(projectId: string, integrationId: SupportedIntegrations): Promise<GladiaConfiguration | GithubConfiguration | AwsConfiguration | MacgicPdfConfiguration | undefined> {
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