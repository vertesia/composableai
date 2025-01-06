import { ComposableClient } from "@vertesia/client";
import { DSLActivityExecutionPayload, DSLWorkflowExecutionPayload, Project, WorkflowExecutionPayload } from "@vertesia/common";
import { log } from "@temporalio/activity";
import { NoDocumentFound, WorkflowParamNotFound } from "../../errors.js";
import { getClient } from "../../utils/client.js";
import { Vars } from "../vars.js";
import { getFetchProvider, registerFetchProviderFactory } from "./fetch/index.js";
import { DocumentProvider, DocumentTypeProvider, InteractionRunProvider } from "./fetch/providers.js";
import { getProjectFromToken } from "../../utils/auth.js";


registerFetchProviderFactory(DocumentProvider.ID, DocumentProvider.factory);
registerFetchProviderFactory(DocumentTypeProvider.ID, DocumentTypeProvider.factory);
registerFetchProviderFactory(InteractionRunProvider.ID, InteractionRunProvider.factory);

export class ActivityContext<T extends Record<string, any> = Record<string, any>> {
    client: ComposableClient;
    _project?: Promise<Project | undefined>;

    constructor(public payload: DSLActivityExecutionPayload, client: ComposableClient, public params: T) {
        this.client = client;
        this.fetchProject = this.fetchProject.bind(this);
    }

    get objectIds() {
        return this.payload.objectIds;
    }

    get objectId() {
        const objectId = this.payload.objectIds && this.payload.objectIds[0];
        if (!objectId) {
            log.error('No objectId found in payload');
            throw new WorkflowParamNotFound('objectIds[0]', (this.payload as WorkflowExecutionPayload as DSLWorkflowExecutionPayload).workflow);
        }
        return objectId;
    }

    fetchProject() {
        if (!this._project) {
            this._project = _fetchProject(this.client, this.payload);
        }
        return this._project;
    }

}


export async function setupActivity<T extends Record<string, any> = Record<string, any>>(payload: DSLActivityExecutionPayload) {

    const isDebugMode = !!payload.debug_mode;

    const vars = new Vars({
        ...payload.params, // imported params (doesn't contain expressions)
        ...payload.activity.params, // activity params (may contain expressions)
    });

    //}
    if (isDebugMode) {
        log.info(`Setting up activity ${payload.activity.name}`, { config: payload.config, activity: payload.activity, params: payload.params, vars });
    }

    const client = getClient(payload);
    const fetchSpecs = payload.activity.fetch;
    if (fetchSpecs) {

        const keys = Object.keys(fetchSpecs);
        if (keys.length > 0) {
            // create a new Vars instance to store the fetched data
            for (const key of keys) {
                let fetchSpec = fetchSpecs[key];
                let query = fetchSpec.query;
                if (query) {
                    query = vars.resolveParams(query);
                    fetchSpec = { ...fetchSpec, query };
                }

                const provider = await getFetchProvider(client, fetchSpec);

                log.info(`Fetching data for ${key} with provider ${provider.name}`, { fetchSpec });
                const result = await provider.fetch(fetchSpec);
                if (result && result.length > 0) {
                    if (fetchSpec.limit === 1) {
                        vars.setValue(key, result[0]);
                    } else {
                        vars.setValue(key, result);
                    }
                } else if (fetchSpec.on_not_found === 'throw') {
                    throw new NoDocumentFound("No documents found for: " + JSON.stringify(fetchSpec));
                } else {
                    vars.setValue(key, null);
                }
            }
        }
    }

    const params = vars.resolve() as T;
    log.info(`Activity ${payload.activity.name} setup complete`, { params });

    return new ActivityContext<T>(payload, client, params);
}


async function _fetchProject(client: ComposableClient, payload: WorkflowExecutionPayload) {
    const project = await getProjectFromToken(payload.auth_token);
    return project ? await client.projects.retrieve(project.id) : undefined;
}
